/**
 * CampoTech Verification Cron Jobs
 * =================================
 *
 * Handles all verification-related scheduled tasks:
 * - checkDocumentExpiring: Send reminders for documents expiring in 30, 14, 7, 1 days
 * - checkDocumentExpired: Process expired documents and apply blocks if needed
 * - revalidateAFIP: Weekly re-check of AFIP status for all orgs
 * - checkEmployeeCompliance: Daily check for employees with expiring docs
 *
 * Schedule (Buenos Aires time = UTC-3):
 * - Document expiring: Daily at 8:00 AM (11:00 UTC)
 * - Document expired: Daily at 6:00 AM (09:00 UTC)
 * - AFIP revalidation: Weekly on Sunday at 3:00 AM (06:00 UTC)
 * - Employee compliance: Daily at 8:00 AM (11:00 UTC)
 */

import { prisma } from '@/lib/prisma';
import { TIMEZONE, LOCALE } from '@/lib/timezone';
import {
  sendDocumentExpiringEmail,
  sendDocumentExpiredEmail,
  sendEmployeeExpiringToOwnerEmail,
  sendEmployeeReminderEmail,
  sendEmployeeComplianceAlertEmail,
  sendAccountBlockedEmail,
  UserEmailData,
  OrganizationEmailData,
  DocumentEmailData,
  EmployeeEmailData,
  PendingVerificationItem,
} from '@/lib/email/verification-emails';
import {
  notifyDocumentExpiring,
  notifyDocumentExpired,
  notifyAccountBlocked,
  notifyEmployeeDocExpiring,
  notifyEmployeeComplianceAlert,
  notifyAFIPStatusChanged,
} from '@/lib/notifications/verification-notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CronJobResult {
  success: boolean;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  durationMs: number;
}

export interface VerificationCronStatus {
  documentReminders: {
    expiring30Days: number;
    expiring14Days: number;
    expiring7Days: number;
    expiring1Day: number;
  };
  expiredDocuments: number;
  employeeIssues: number;
  lastRunAt: {
    documentExpiring: Date | null;
    documentExpired: Date | null;
    afipRevalidation: Date | null;
    employeeCompliance: Date | null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getDayBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Get user email data from database
 */
async function getUserEmailData(userId: string): Promise<UserEmailData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  if (!user?.email) {
    return null;
  }

  return {
    userId: user.id,
    userName: user.name || 'Usuario',
    userEmail: user.email,
  };
}

/**
 * Get organization email data from database
 */
async function getOrganizationEmailData(organizationId: string): Promise<OrganizationEmailData | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
    },
  });

  if (!org) {
    return null;
  }

  return {
    organizationId: org.id,
    organizationName: org.name,
  };
}

/**
 * Get organization owner data
 */
async function getOwnerData(organizationId: string): Promise<{ userId: string; email: string; name: string } | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      ownerId: true,
      owner: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!org?.ownerId || !org.owner?.email) {
    return null;
  }

  return {
    userId: org.ownerId,
    email: org.owner.email,
    name: org.owner.name || 'Usuario',
  };
}

/**
 * Log verification cron event
 */
async function logCronEvent(
  eventType: string,
  result: CronJobResult,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.subscriptionEvent.create({
      data: {
        id: `vcron_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        organizationId: 'system',
        subscriptionId: 'verification_cron',
        eventType: `verification_cron_${eventType}`,
        eventData: {
          processed: result.processed,
          succeeded: result.succeeded,
          failed: result.failed,
          durationMs: result.durationMs,
          ...details,
        },
        actorType: 'system',
      },
    });
  } catch (error) {
    console.error('[VerificationCron] Error logging cron event:', error);
  }
}

/**
 * Log verification reminder in the reminders table
 */
async function logVerificationReminder(
  submissionId: string,
  recipientUserId: string,
  reminderType: 'expiring_soon' | 'expired' | 'action_required' | 'renewal_due',
  daysUntilExpiry: number | null,
  channel: 'email' | 'in_app'
): Promise<void> {
  try {
    await prisma.verificationReminder.create({
      data: {
        submissionId,
        recipientUserId,
        reminderType,
        daysUntilExpiry,
        channel,
      },
    });
  } catch (error) {
    console.error('[VerificationCron] Error logging reminder:', error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK DOCUMENT EXPIRING (30, 14, 7, 1 days)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send document expiring reminder emails
 * Runs daily at 8:00 AM Buenos Aires time
 */
export async function checkDocumentExpiring(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[VerificationCron] Starting document expiring check...');

  try {
    // Process for each reminder day (30, 14, 7, 1)
    const reminderDays = [30, 14, 7, 1];

    for (const days of reminderDays) {
      const targetDate = addDays(now, days);
      const { start, end } = getDayBoundaries(targetDate);

      // Find documents expiring on this day
      const expiringDocs = await prisma.verificationSubmission.findMany({
        where: {
          status: 'approved',
          expiresAt: {
            gte: start,
            lte: end,
          },
        },
        include: {
          requirement: {
            select: {
              name: true,
              code: true,
              reminderDaysBefore: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      console.log(`[VerificationCron] Found ${expiringDocs.length} documents expiring in ${days} days`);

      for (const submission of expiringDocs) {
        // Check if this reminder day is configured for this requirement
        if (!submission.requirement.reminderDaysBefore.includes(days)) {
          continue;
        }

        processed++;

        try {
          // Check if we already sent a reminder for this day
          const existingReminder = await prisma.verificationReminder.findFirst({
            where: {
              submissionId: submission.id,
              reminderType: 'expiring_soon',
              daysUntilExpiry: days,
              sentAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000), // Last 24 hours
              },
            },
          });

          if (existingReminder) {
            console.log(
              `[VerificationCron] Skipping ${days}-day reminder for submission ${submission.id} - already sent`
            );
            continue;
          }

          // Determine the recipient (user or org owner)
          const recipientId = submission.userId || submission.organization.ownerId;
          const recipientUser = submission.user || (await prisma.user.findUnique({
            where: { id: submission.organization.ownerId! },
            select: { id: true, name: true, email: true },
          }));

          if (!recipientUser?.email) {
            errors.push({
              id: submission.id,
              error: 'Could not get recipient email',
            });
            continue;
          }

          const userEmailData: UserEmailData = {
            userId: recipientId!,
            userName: recipientUser.name || 'Usuario',
            userEmail: recipientUser.email,
          };

          const orgEmailData: OrganizationEmailData = {
            organizationId: submission.organization.id,
            organizationName: submission.organization.name,
          };

          const documentEmailData: DocumentEmailData = {
            documentId: submission.id,
            documentName: submission.requirement.name,
            documentType: submission.requirement.code,
            expiresAt: submission.expiresAt ? new Date(submission.expiresAt) : undefined,
          };

          // Send the reminder email
          const emailResult = await sendDocumentExpiringEmail(
            userEmailData,
            orgEmailData,
            documentEmailData,
            days
          );

          if (emailResult.success) {
            succeeded++;

            // Send in-app notification
            await notifyDocumentExpiring(
              submission.organizationId,
              recipientId!,
              submission.requirement.name,
              days
            );

            // Log the reminder
            await logVerificationReminder(
              submission.id,
              recipientId!,
              'expiring_soon',
              days,
              'email'
            );

            console.log(
              `[VerificationCron] Sent ${days}-day expiring reminder for ${submission.requirement.name} to ${recipientUser.email}`
            );
          } else {
            errors.push({
              id: submission.id,
              error: emailResult.error || 'Email sending failed',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[VerificationCron] Error processing expiring doc ${submission.id}:`, error);
          errors.push({
            id: submission.id,
            error: errorMessage,
          });
        }
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[VerificationCron] Document expiring check complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('document_expiring', result, { reminderDays });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[VerificationCron] Fatal error in checkDocumentExpiring:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK DOCUMENT EXPIRED
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Process expired documents and apply blocks if needed
 * Runs daily at 6:00 AM Buenos Aires time
 */
export async function checkDocumentExpired(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[VerificationCron] Starting document expired check...');

  try {
    // Find all approved documents that have expired
    const expiredDocs = await prisma.verificationSubmission.findMany({
      where: {
        status: 'approved',
        expiresAt: {
          lt: now,
        },
      },
      include: {
        requirement: {
          select: {
            name: true,
            code: true,
            isRequired: true,
            gracePeriodDays: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`[VerificationCron] Found ${expiredDocs.length} expired documents to process`);

    for (const submission of expiredDocs) {
      processed++;

      try {
        // Determine the recipient (user or org owner)
        const recipientId = submission.userId || submission.organization.ownerId;
        const recipientUser = submission.user || (await prisma.user.findUnique({
          where: { id: submission.organization.ownerId! },
          select: { id: true, name: true, email: true },
        }));

        // Update submission status to expired
        await prisma.verificationSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'expired',
            expiryNotifiedAt: now,
          },
        });

        // Check if we need to apply a block (for required documents)
        if (submission.requirement.isRequired) {
          // Check grace period
          const expirationDate = new Date(submission.expiresAt!);
          const gracePeriodEnd = addDays(expirationDate, submission.requirement.gracePeriodDays);

          if (now > gracePeriodEnd) {
            // Grace period has ended, apply a soft block
            const existingBlock = await prisma.complianceBlock.findFirst({
              where: {
                organizationId: submission.organizationId,
                userId: submission.userId,
                relatedSubmissionId: submission.id,
                unblockedAt: null,
              },
            });

            if (!existingBlock) {
              await prisma.complianceBlock.create({
                data: {
                  organizationId: submission.organizationId,
                  userId: submission.userId,
                  blockType: 'soft_block',
                  reason: `Documento requerido vencido: ${submission.requirement.name}`,
                  reasonCode: 'DOCUMENT_EXPIRED',
                  relatedSubmissionId: submission.id,
                  createdBy: 'system',
                },
              });

              // Send account blocked notification
              if (recipientUser?.email) {
                const ownerData = await getOwnerData(submission.organizationId);
                if (ownerData) {
                  await sendAccountBlockedEmail(
                    {
                      userId: ownerData.userId,
                      userName: ownerData.name,
                      userEmail: ownerData.email,
                    },
                    {
                      organizationId: submission.organizationId,
                      organizationName: submission.organization.name,
                    },
                    `Documento requerido vencido: ${submission.requirement.name}`
                  );

                  await notifyAccountBlocked(
                    submission.organizationId,
                    ownerData.userId,
                    `Documento requerido vencido: ${submission.requirement.name}`
                  );
                }
              }
            }
          }
        }

        // Send expired notification
        if (recipientUser?.email) {
          const emailResult = await sendDocumentExpiredEmail(
            {
              userId: recipientId!,
              userName: recipientUser.name || 'Usuario',
              userEmail: recipientUser.email,
            },
            {
              organizationId: submission.organizationId,
              organizationName: submission.organization.name,
            },
            {
              documentId: submission.id,
              documentName: submission.requirement.name,
              documentType: submission.requirement.code,
              expiresAt: submission.expiresAt ? new Date(submission.expiresAt) : undefined,
            }
          );

          if (emailResult.success) {
            // Send in-app notification
            await notifyDocumentExpired(
              submission.organizationId,
              recipientId!,
              submission.requirement.name
            );

            // Log the reminder
            await logVerificationReminder(
              submission.id,
              recipientId!,
              'expired',
              0,
              'email'
            );
          }
        }

        succeeded++;
        console.log(`[VerificationCron] Processed expired document ${submission.requirement.name} for org ${submission.organizationId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VerificationCron] Error processing expired doc ${submission.id}:`, error);
        errors.push({
          id: submission.id,
          error: errorMessage,
        });
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[VerificationCron] Document expired check complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('document_expired', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[VerificationCron] Fatal error in checkDocumentExpired:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REVALIDATE AFIP STATUS (Weekly)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Re-check AFIP status for all organizations
 * Runs weekly on Sunday at 3:00 AM Buenos Aires time
 */
export async function revalidateAFIP(): Promise<CronJobResult> {
  const startTime = Date.now();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[VerificationCron] Starting AFIP revalidation...');

  try {
    // Find all organizations with AFIP-verified CUIT submissions
    const afipSubmissions = await prisma.verificationSubmission.findMany({
      where: {
        requirement: {
          code: { in: ['owner_cuit', 'afip_status'] },
        },
        status: 'approved',
        verifiedBy: 'auto',
        autoVerifyResponse: { not: null },
      },
      include: {
        requirement: {
          select: {
            code: true,
            name: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            ownerId: true,
          },
        },
      },
      distinct: ['organizationId'],
    });

    console.log(`[VerificationCron] Found ${afipSubmissions.length} organizations to revalidate AFIP status`);

    for (const submission of afipSubmissions) {
      processed++;

      try {
        const previousResponse = submission.autoVerifyResponse as Record<string, unknown>;
        const previousStatus = previousResponse?.isActive as boolean | undefined;

        // Note: In a real implementation, we would call the AFIP API here
        // For now, we'll just log that this would happen
        // const afipResult = await afipClient.checkActiveStatus(previousResponse.cuit);

        // Simulated: Check if the stored AFIP status is still valid
        // In production, this would be replaced with actual AFIP API call
        const isStillActive = true; // Placeholder - replace with actual AFIP check

        if (previousStatus === true && !isStillActive) {
          // Status changed from active to inactive
          console.log(`[VerificationCron] AFIP status changed to inactive for org ${submission.organizationId}`);

          // Update the submission
          await prisma.verificationSubmission.update({
            where: { id: submission.id },
            data: {
              status: 'expired',
              autoVerifyCheckedAt: new Date(),
              autoVerifyResponse: {
                ...previousResponse,
                isActive: false,
                lastChecked: new Date().toISOString(),
                statusChangeDetected: true,
              },
            },
          });

          // Notify the owner
          const ownerData = await getOwnerData(submission.organizationId);
          if (ownerData) {
            await notifyAFIPStatusChanged(
              submission.organizationId,
              ownerData.userId,
              'inactive',
              'active'
            );
          }
        } else {
          // Update last checked timestamp
          await prisma.verificationSubmission.update({
            where: { id: submission.id },
            data: {
              autoVerifyCheckedAt: new Date(),
              autoVerifyResponse: {
                ...previousResponse,
                lastChecked: new Date().toISOString(),
              },
            },
          });
        }

        succeeded++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[VerificationCron] Error revalidating AFIP for org ${submission.organizationId}:`, error);
        errors.push({
          id: submission.organizationId,
          error: errorMessage,
        });
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[VerificationCron] AFIP revalidation complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('afip_revalidation', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[VerificationCron] Fatal error in revalidateAFIP:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK EMPLOYEE COMPLIANCE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check for employees with expiring documents
 * Notifies both the employee AND the owner
 * Runs daily at 8:00 AM Buenos Aires time
 */
export async function checkEmployeeCompliance(): Promise<CronJobResult> {
  const startTime = Date.now();
  const now = new Date();
  const errors: Array<{ id: string; error: string }> = [];
  let processed = 0;
  let succeeded = 0;

  console.log('[VerificationCron] Starting employee compliance check...');

  try {
    // Find all employee documents expiring in 30, 14, 7, 1 days
    const reminderDays = [30, 14, 7, 1];
    const ownerAlerts: Map<string, Array<{ name: string; issues: string[] }>> = new Map();

    for (const days of reminderDays) {
      const targetDate = addDays(now, days);
      const { start, end } = getDayBoundaries(targetDate);

      const expiringEmployeeDocs = await prisma.verificationSubmission.findMany({
        where: {
          status: 'approved',
          userId: { not: null },
          expiresAt: {
            gte: start,
            lte: end,
          },
          requirement: {
            appliesTo: 'employee',
          },
        },
        include: {
          requirement: {
            select: {
              name: true,
              code: true,
            },
          },
          organization: {
            select: {
              id: true,
              name: true,
              ownerId: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      for (const submission of expiringEmployeeDocs) {
        if (!submission.user) continue;

        processed++;

        try {
          // Check if we already sent a reminder
          const existingReminder = await prisma.verificationReminder.findFirst({
            where: {
              submissionId: submission.id,
              reminderType: 'expiring_soon',
              daysUntilExpiry: days,
              sentAt: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
              },
            },
          });

          if (existingReminder) {
            continue;
          }

          const employee: EmployeeEmailData = {
            employeeId: submission.user.id,
            employeeName: submission.user.name || 'Empleado',
            employeeEmail: submission.user.email || '',
          };

          const org: OrganizationEmailData = {
            organizationId: submission.organization.id,
            organizationName: submission.organization.name,
          };

          // Send reminder to employee
          if (employee.employeeEmail) {
            const pendingItems: PendingVerificationItem[] = [{
              name: submission.requirement.name,
              status: days <= 1 ? 'expiring' : 'pending',
              daysUntilExpiry: days,
            }];

            await sendEmployeeReminderEmail(employee, org, pendingItems);
          }

          // Notify owner
          const ownerData = await getOwnerData(submission.organizationId);
          if (ownerData) {
            // Collect issues for batch notification
            const orgIssues = ownerAlerts.get(submission.organizationId) || [];
            const employeeIssue = orgIssues.find(e => e.name === employee.employeeName);

            if (employeeIssue) {
              employeeIssue.issues.push(`${submission.requirement.name} vence en ${days} días`);
            } else {
              orgIssues.push({
                name: employee.employeeName,
                issues: [`${submission.requirement.name} vence en ${days} días`],
              });
            }
            ownerAlerts.set(submission.organizationId, orgIssues);

            // Send individual notification to owner
            await sendEmployeeExpiringToOwnerEmail(
              {
                userId: ownerData.userId,
                userName: ownerData.name,
                userEmail: ownerData.email,
              },
              org,
              employee,
              {
                documentId: submission.id,
                documentName: submission.requirement.name,
                documentType: submission.requirement.code,
                expiresAt: submission.expiresAt ? new Date(submission.expiresAt) : undefined,
              },
              days
            );

            // In-app notification for owner
            await notifyEmployeeDocExpiring(
              submission.organizationId,
              ownerData.userId,
              employee.employeeName,
              submission.requirement.name,
              days
            );
          }

          // Log the reminder
          await logVerificationReminder(
            submission.id,
            submission.user.id,
            'expiring_soon',
            days,
            'email'
          );

          succeeded++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[VerificationCron] Error processing employee doc ${submission.id}:`, error);
          errors.push({
            id: submission.id,
            error: errorMessage,
          });
        }
      }
    }

    // Send compliance alert emails to owners with multiple employee issues
    for (const [orgId, employees] of ownerAlerts) {
      if (employees.length >= 2) {
        try {
          const ownerData = await getOwnerData(orgId);
          const orgData = await getOrganizationEmailData(orgId);

          if (ownerData && orgData) {
            await sendEmployeeComplianceAlertEmail(
              {
                userId: ownerData.userId,
                userName: ownerData.name,
                userEmail: ownerData.email,
              },
              orgData,
              employees
            );

            await notifyEmployeeComplianceAlert(orgId, ownerData.userId, employees.length);
          }
        } catch (error) {
          console.error(`[VerificationCron] Error sending compliance alert for org ${orgId}:`, error);
        }
      }
    }

    const result: CronJobResult = {
      success: errors.length === 0,
      processed,
      succeeded,
      failed: errors.length,
      errors,
      durationMs: Date.now() - startTime,
    };

    console.log(
      `[VerificationCron] Employee compliance check complete. Processed: ${processed}, Succeeded: ${succeeded}, Failed: ${errors.length}`
    );

    await logCronEvent('employee_compliance', result);

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown fatal error';
    console.error('[VerificationCron] Fatal error in checkEmployeeCompliance:', error);

    return {
      success: false,
      processed,
      succeeded,
      failed: 1,
      errors: [{ id: 'N/A', error: errorMessage }],
      durationMs: Date.now() - startTime,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS AND MONITORING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current status of verification cron jobs
 */
export async function getVerificationCronStatus(): Promise<VerificationCronStatus> {
  const now = new Date();

  try {
    // Count documents expiring in 30, 14, 7, 1 days
    const countExpiring = async (days: number): Promise<number> => {
      const targetDate = addDays(now, days);
      const { start, end } = getDayBoundaries(targetDate);
      return prisma.verificationSubmission.count({
        where: {
          status: 'approved',
          expiresAt: { gte: start, lte: end },
        },
      });
    };

    const [expiring30Days, expiring14Days, expiring7Days, expiring1Day] = await Promise.all([
      countExpiring(30),
      countExpiring(14),
      countExpiring(7),
      countExpiring(1),
    ]);

    // Count expired documents not yet processed
    const expiredDocuments = await prisma.verificationSubmission.count({
      where: {
        status: 'approved',
        expiresAt: { lt: now },
      },
    });

    // Count employees with issues
    const employeeIssues = await prisma.verificationSubmission.count({
      where: {
        requirement: { appliesTo: 'employee' },
        OR: [
          { status: 'pending' },
          { status: 'rejected' },
          {
            status: 'approved',
            expiresAt: { lt: addDays(now, 7) },
          },
        ],
      },
    });

    // Get last run times
    const getLastRunTime = async (eventType: string): Promise<Date | null> => {
      const event = await prisma.subscriptionEvent.findFirst({
        where: {
          eventType: `verification_cron_${eventType}`,
          organizationId: 'system',
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      return event?.createdAt || null;
    };

    const [lastDocExpiring, lastDocExpired, lastAfip, lastEmployee] = await Promise.all([
      getLastRunTime('document_expiring'),
      getLastRunTime('document_expired'),
      getLastRunTime('afip_revalidation'),
      getLastRunTime('employee_compliance'),
    ]);

    return {
      documentReminders: {
        expiring30Days,
        expiring14Days,
        expiring7Days,
        expiring1Day,
      },
      expiredDocuments,
      employeeIssues,
      lastRunAt: {
        documentExpiring: lastDocExpiring,
        documentExpired: lastDocExpired,
        afipRevalidation: lastAfip,
        employeeCompliance: lastEmployee,
      },
    };
  } catch (error) {
    console.error('[VerificationCron] Error getting status:', error);
    return {
      documentReminders: { expiring30Days: 0, expiring14Days: 0, expiring7Days: 0, expiring1Day: 0 },
      expiredDocuments: 0,
      employeeIssues: 0,
      lastRunAt: {
        documentExpiring: null,
        documentExpired: null,
        afipRevalidation: null,
        employeeCompliance: null,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RUN ALL VERIFICATION CRONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Run all verification cron jobs
 * Convenience function for running all jobs in sequence
 */
export async function runAllVerificationCrons(): Promise<{
  documentExpiring: CronJobResult;
  documentExpired: CronJobResult;
  employeeCompliance: CronJobResult;
}> {
  console.log('[VerificationCron] Running all verification cron jobs...');

  const [documentExpiring, documentExpired, employeeCompliance] = await Promise.all([
    checkDocumentExpiring(),
    checkDocumentExpired(),
    checkEmployeeCompliance(),
  ]);

  return {
    documentExpiring,
    documentExpired,
    employeeCompliance,
  };
}
