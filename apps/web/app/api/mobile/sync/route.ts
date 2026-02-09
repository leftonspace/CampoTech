import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Sync API
 * ===============
 *
 * Handles bidirectional sync between mobile app and server.
 * Supports incremental sync with conflict resolution.
 * 
 * PHASE 5 SECURITY HARDENING:
 * - Terminal state immutability (COMPLETED/CANCELLED cannot be modified)
 * - COMPLETED status requires payment verification
 * - Full audit logging via SyncOperation model
 * - Payment variance detection and fraud alerts
 */

interface SyncOperation {
  id: string;
  table: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
  clientId: string;
}

interface SyncRequest {
  lastSyncAt?: string;
  operations: SyncOperation[];
  deviceId: string;
}

interface SyncResponse {
  serverChanges: {
    jobs: unknown[];
    customers: unknown[];
    products: unknown[];
  };
  conflicts: Array<{
    operationId: string;
    resolution: 'server_wins' | 'client_wins' | 'merged';
    serverData?: unknown;
  }>;
  syncedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNC AUDIT CONTEXT (passed through operation processing)
// ═══════════════════════════════════════════════════════════════════════════════
interface SyncAuditContext {
  organizationId: string;
  userId: string;
  deviceId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: SyncRequest = await request.json();
    const { lastSyncAt, operations, deviceId } = body;

    const lastSync = lastSyncAt ? new Date(lastSyncAt) : new Date(0);
    const now = new Date();

    // Build audit context
    const auditContext: SyncAuditContext = {
      organizationId: session.organizationId,
      userId: session.userId,
      deviceId: deviceId,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };

    const conflicts: SyncResponse['conflicts'] = [];
    const processedOperations: string[] = [];
    let terminalStateBlocked = false;
    let paymentVarianceDetected = false;

    // Process client operations
    for (const op of operations || []) {
      try {
        const result = await processOperation(session.organizationId, op, session.userId, auditContext);
        if (result.conflict) {
          conflicts.push({
            operationId: op.id,
            resolution: result.resolution || 'server_wins',
            serverData: result.serverData,
          });

          // Track security events
          if (result.terminalStateBlocked) terminalStateBlocked = true;
          if (result.paymentVariance) paymentVarianceDetected = true;
        }
        processedOperations.push(op.id);
      } catch (error) {
        console.error('Error processing sync operation:', op.id, error);

        // Log failed operation
        await logSyncOperation(auditContext, {
          operationType: 'push',
          entityType: op.table,
          entityId: op.data.id as string,
          success: false,
          severity: 'ERROR',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Fetch server changes since last sync
    const [jobs, customers, products] = await Promise.all([
      prisma.job.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
          OR: [
            { technicianId: session.userId },
            { technicianId: null },
          ],
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              address: true,
            },
          },
          materials: true,
        },
      }),
      prisma.customer.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
        take: 100, // Limit for performance
      }),
      prisma.product.findMany({
        where: {
          organizationId: session.organizationId,
          updatedAt: { gt: lastSync },
        },
      }),
    ]);

    // ═══════════════════════════════════════════════════════════════════════════════
    // PHASE 5 FIX: Sync operation audit logging
    // ═══════════════════════════════════════════════════════════════════════════════
    await logSyncOperation(auditContext, {
      operationType: 'bidirectional',
      operationCount: processedOperations.length,
      conflictCount: conflicts.length,
      terminalStateBlocked,
      success: true,
      severity: terminalStateBlocked || paymentVarianceDetected ? 'WARN' : 'INFO',
      details: {
        pulledJobs: jobs.length,
        pulledCustomers: customers.length,
        pulledProducts: products.length,
        pushedOperations: operations?.length || 0,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        serverChanges: {
          jobs: jobs.map(formatJobForMobile),
          customers,
          products,
        },
        conflicts,
        syncedAt: now.toISOString(),
        processedOperations,
      } as SyncResponse,
    });
  } catch (error) {
    console.error('Mobile sync error:', error);
    return NextResponse.json(
      { success: false, error: 'Error syncing data' },
      { status: 500 }
    );
  }
}

type ResolutionType = 'server_wins' | 'client_wins' | 'merged';

interface OperationResult {
  conflict?: boolean;
  resolution?: ResolutionType;
  serverData?: unknown;
  terminalStateBlocked?: boolean;
  paymentVariance?: number;
}

async function processOperation(
  organizationId: string,
  operation: SyncOperation,
  userId: string,
  auditContext: SyncAuditContext
): Promise<OperationResult> {
  const { table, action, data, timestamp } = operation;
  const clientTimestamp = new Date(timestamp);

  switch (table) {
    case 'jobs': {
      if (action === 'update' && data.id) {
        const existing = await prisma.job.findFirst({
          where: { id: data.id as string, organizationId },
          include: {
            lineItems: {
              select: { total: true, taxAmount: true },
            },
          },
        });

        if (!existing) {
          return { conflict: true, resolution: 'server_wins', serverData: { error: 'Job not found' } };
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // PHASE 5 FIX: Terminal state immutability check
        // Jobs in COMPLETED or CANCELLED status cannot be modified via sync
        // ═══════════════════════════════════════════════════════════════════════════════
        const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
        if (TERMINAL_STATES.includes(existing.status)) {
          console.error(
            `[Security] ❌ TERMINAL STATE MODIFICATION BLOCKED. ` +
            `jobId=${data.id}, currentStatus=${existing.status}, userId=${userId}. ` +
            `Jobs in terminal state cannot be modified via sync.`
          );

          // Log security event
          await logSyncOperation(auditContext, {
            operationType: 'push',
            entityType: 'job',
            entityId: data.id as string,
            statusTransition: `${existing.status}->BLOCKED`,
            terminalStateBlocked: true,
            success: false,
            severity: 'CRITICAL',
            errorMessage: `Attempt to modify ${existing.status} job blocked`,
          });

          return {
            conflict: true,
            resolution: 'server_wins',
            serverData: { error: `No se puede modificar un trabajo ${existing.status === 'COMPLETED' ? 'completado' : 'cancelado'}` },
            terminalStateBlocked: true,
          };
        }

        if (existing.updatedAt > clientTimestamp) {
          // Server has newer data - conflict
          return {
            conflict: true,
            resolution: 'server_wins',
            serverData: existing,
          };
        }

        // ═══════════════════════════════════════════════════════════════════════════════
        // SECURITY: Server-side payment validation
        // ═══════════════════════════════════════════════════════════════════════════════
        // 
        // CRITICAL: Never trust client-sent payment amounts or status!
        // The server must calculate the real balance and decide if job is paid.
        // ═══════════════════════════════════════════════════════════════════════════════

        if (data.paymentAmount !== undefined || data.paymentMethod !== undefined) {
          const result = await processPaymentSync(
            data.id as string,
            organizationId,
            userId,
            {
              paymentAmount: data.paymentAmount as number | undefined,
              paymentMethod: data.paymentMethod as string | undefined,
            },
            auditContext
          );

          if (result.conflict) {
            return result;
          }

          // Payment processed - don't allow client to set status
          // Remove payment and status fields from the update (server handles these)
          delete data.paymentAmount;
          delete data.paymentMethod;
          delete data.paymentCollectedAt;
          delete data.status;
        }

        // Apply client update (with payment fields removed if applicable)
        type JobStatusType = 'PENDING' | 'ASSIGNED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
        const updateData: {
          status?: JobStatusType;
          resolution?: string;
          completedAt?: Date;
          updatedAt: Date;
        } = {
          updatedAt: new Date(),
        };

        // ═══════════════════════════════════════════════════════════════════════════════
        // PHASE 5 FIX: Enhanced status field validation with payment verification
        // ═══════════════════════════════════════════════════════════════════════════════
        if (data.status) {
          const clientStatus = data.status as string;
          const allowedClientStatuses = ['EN_ROUTE', 'IN_PROGRESS'];

          if (allowedClientStatuses.includes(clientStatus)) {
            updateData.status = clientStatus as JobStatusType;

            // Log status transition
            await logSyncOperation(auditContext, {
              operationType: 'push',
              entityType: 'job',
              entityId: data.id as string,
              statusTransition: `${existing.status}->${clientStatus}`,
              success: true,
              severity: 'INFO',
            });
          } else if (clientStatus === 'CANCELLED') {
            // CANCELLED is allowed but logged with higher severity
            updateData.status = 'CANCELLED';
            console.warn(
              `[Security] Job cancelled via mobile sync. ` +
              `jobId=${data.id}, userId=${userId}.`
            );

            await logSyncOperation(auditContext, {
              operationType: 'push',
              entityType: 'job',
              entityId: data.id as string,
              statusTransition: `${existing.status}->CANCELLED`,
              success: true,
              severity: 'WARN',
            });
          } else if (clientStatus === 'COMPLETED') {
            // ═══════════════════════════════════════════════════════════════════════════════
            // PHASE 5 FIX: COMPLETED requires payment verification
            // ═══════════════════════════════════════════════════════════════════════════════

            // Calculate server balance
            const lineItemsTotal = existing.lineItems.reduce((sum: number, item: { total: unknown; taxAmount: unknown }) => {
              const itemTotal = Number(item.total) + Number(item.taxAmount || 0);
              return sum + itemTotal;
            }, 0);

            const serverBalance = existing.finalTotal
              ? Number(existing.finalTotal)
              : (lineItemsTotal > 0 ? lineItemsTotal : Number(existing.estimatedTotal || 0));

            const depositPaid = existing.depositAmount ? Number(existing.depositAmount) : 0;
            const remainingBalance = serverBalance - depositPaid;
            const paymentCollected = existing.paymentAmount ? Number(existing.paymentAmount) : 0;

            // Check if payment requirement is satisfied
            const VARIANCE_THRESHOLD = 0.01;
            const isFullyPaid = remainingBalance <= VARIANCE_THRESHOLD ||
              Math.abs(paymentCollected - remainingBalance) <= VARIANCE_THRESHOLD;

            if (isFullyPaid || serverBalance <= 0) {
              // Payment verified - allow COMPLETED
              updateData.status = 'COMPLETED';
              updateData.completedAt = new Date();

              await logSyncOperation(auditContext, {
                operationType: 'push',
                entityType: 'job',
                entityId: data.id as string,
                statusTransition: `${existing.status}->COMPLETED`,
                success: true,
                severity: 'INFO',
                details: { paymentVerified: true, balance: remainingBalance, collected: paymentCollected },
              });
            } else {
              // Payment NOT verified - reject COMPLETED status
              console.error(
                `[Security] ❌ COMPLETED STATUS REJECTED - Payment not verified. ` +
                `jobId=${data.id}, userId=${userId}, balance=$${remainingBalance.toFixed(2)}, ` +
                `collected=$${paymentCollected.toFixed(2)}.`
              );

              await logSyncOperation(auditContext, {
                operationType: 'push',
                entityType: 'job',
                entityId: data.id as string,
                statusTransition: `${existing.status}->COMPLETED_REJECTED`,
                terminalStateBlocked: true,
                success: false,
                severity: 'CRITICAL',
                errorMessage: `COMPLETED rejected: payment not collected. Balance: $${remainingBalance.toFixed(2)}`,
              });

              return {
                conflict: true,
                resolution: 'server_wins',
                serverData: {
                  error: `No se puede completar el trabajo sin cobro. Saldo pendiente: $${remainingBalance.toFixed(2)}`,
                  remainingBalance,
                },
                terminalStateBlocked: true,
              };
            }
          }
        }

        if (data.resolution) {
          updateData.resolution = data.resolution as string;
        }
        if (data.completedAt && updateData.status === 'COMPLETED') {
          updateData.completedAt = new Date(data.completedAt as string);
        }

        await prisma.job.update({
          where: { id: data.id as string },
          data: updateData,
        });
      }
      break;
    }

    case 'job_photos': {
      if (action === 'create' && data.jobId) {
        type PhotoTypeEnum = 'BEFORE' | 'DURING' | 'AFTER' | 'SIGNATURE' | 'DOCUMENT';
        await prisma.jobPhoto.create({
          data: {
            jobId: data.jobId as string,
            photoUrl: data.photoUrl as string,
            photoType: (data.photoType as PhotoTypeEnum) || 'AFTER',
            takenAt: data.takenAt ? new Date(data.takenAt as string) : new Date(),
          },
        });
      }
      break;
    }

    case 'payments': {
      // Direct payment sync - always validate server-side
      if (action === 'create' && data.jobId) {
        const result = await processPaymentSync(
          data.jobId as string,
          organizationId,
          userId,
          {
            paymentAmount: data.amount as number | undefined,
            paymentMethod: data.method as string | undefined,
          },
          auditContext
        );
        return result;
      }
      break;
    }

    // Add more table handlers as needed
  }

  return {};
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY: Server-Side Payment Validation
// ═══════════════════════════════════════════════════════════════════════════════
//
// This function is the SINGLE SOURCE OF TRUTH for payment processing.
// It calculates the real job balance and validates against client-sent amounts.
//
// NEVER trust the client to dictate:
// - The payment amount (could be manipulated)
// - The job status (could mark as "paid" without full payment)
//
// ═══════════════════════════════════════════════════════════════════════════════

interface PaymentSyncData {
  paymentAmount?: number;
  paymentMethod?: string;
}

async function processPaymentSync(
  jobId: string,
  organizationId: string,
  userId: string,
  paymentData: PaymentSyncData,
  auditContext: SyncAuditContext
): Promise<OperationResult> {

  // Step 1: Fetch the job with line items to calculate real balance
  const job = await prisma.job.findFirst({
    where: { id: jobId, organizationId },
    include: {
      lineItems: {
        select: {
          total: true,
          taxAmount: true,
        },
      },
    },
  });

  if (!job) {
    console.error(`[Payment Sync] Job not found: ${jobId}`);
    return { conflict: true, resolution: 'server_wins', serverData: { error: 'Job not found' } };
  }

  // Step 2: Calculate the REAL total from line items (server-side truth)
  const lineItemsTotal = job.lineItems.reduce((sum: number, item: { total: unknown; taxAmount: unknown }) => {
    const itemTotal = Number(item.total) + Number(item.taxAmount || 0);
    return sum + itemTotal;
  }, 0);

  // Use finalTotal if locked, otherwise use line items total or estimatedTotal
  const serverCalculatedBalance = job.finalTotal
    ? Number(job.finalTotal)
    : (lineItemsTotal > 0 ? lineItemsTotal : Number(job.estimatedTotal || 0));

  // Subtract any deposit already paid
  const depositPaid = job.depositAmount ? Number(job.depositAmount) : 0;
  const remainingBalance = serverCalculatedBalance - depositPaid;

  // Step 3: Get the client-claimed payment amount
  const clientPaymentAmount = paymentData.paymentAmount ?? 0;

  // Step 4: Compare and decide
  const VARIANCE_THRESHOLD = 0.01; // Allow 1 cent variance for rounding
  const variance = Math.abs(clientPaymentAmount - remainingBalance);
  const isExactMatch = variance <= VARIANCE_THRESHOLD;

  console.log(
    `[Payment Sync] Job ${jobId}: ` +
    `serverBalance=${remainingBalance.toFixed(2)}, ` +
    `clientAmount=${clientPaymentAmount.toFixed(2)}, ` +
    `variance=${variance.toFixed(2)}, ` +
    `match=${isExactMatch}`
  );

  if (isExactMatch) {
    // ✅ EXACT MATCH: Process payment normally
    await prisma.job.update({
      where: { id: jobId },
      data: {
        paymentAmount: clientPaymentAmount,
        paymentMethod: paymentData.paymentMethod || 'CASH',
        paymentCollectedAt: new Date(),
        paymentCollectedById: userId,
        status: 'COMPLETED', // Server decides status
        updatedAt: new Date(),
      },
    });

    console.log(`[Payment Sync] ✅ Payment processed for job ${jobId}: $${clientPaymentAmount}`);

    // Log successful payment
    await logSyncOperation(auditContext, {
      operationType: 'payment_sync',
      entityType: 'job',
      entityId: jobId,
      clientClaimedAmount: clientPaymentAmount,
      serverActualAmount: remainingBalance,
      paymentVariance: 0,
      success: true,
      severity: 'INFO',
      details: { paymentMethod: paymentData.paymentMethod || 'CASH' },
    });

    return {};

  } else if (clientPaymentAmount > 0 && clientPaymentAmount < remainingBalance) {
    // ⚠️ PARTIAL PAYMENT: Record it but don't mark as fully paid
    await prisma.job.update({
      where: { id: jobId },
      data: {
        paymentAmount: clientPaymentAmount,
        paymentMethod: paymentData.paymentMethod || 'CASH',
        paymentCollectedAt: new Date(),
        paymentCollectedById: userId,
        // DO NOT set status to COMPLETED - partial payment
        resolution: `PARTIAL_PAYMENT: Collected $${clientPaymentAmount} of $${remainingBalance.toFixed(2)}`,
        updatedAt: new Date(),
      },
    });

    console.warn(
      `[Payment Sync] ⚠️ PARTIAL PAYMENT for job ${jobId}: ` +
      `Collected $${clientPaymentAmount} of $${remainingBalance.toFixed(2)} owed. ` +
      `userId=${userId}. Flagging for dispatcher review.`
    );

    // Log partial payment
    await logSyncOperation(auditContext, {
      operationType: 'payment_sync',
      entityType: 'job',
      entityId: jobId,
      clientClaimedAmount: clientPaymentAmount,
      serverActualAmount: remainingBalance,
      paymentVariance: remainingBalance - clientPaymentAmount,
      success: true,
      severity: 'WARN',
      details: {
        type: 'PARTIAL_PAYMENT',
        collected: clientPaymentAmount,
        owed: remainingBalance,
      },
    });

    return {
      conflict: true,
      resolution: 'server_wins',
      serverData: {
        warning: 'PARTIAL_PAYMENT',
        collected: clientPaymentAmount,
        owed: remainingBalance,
        message: `Solo se registró $${clientPaymentAmount} de $${remainingBalance.toFixed(2)} adeudados`,
      },
      paymentVariance: remainingBalance - clientPaymentAmount,
    };

  } else if (clientPaymentAmount > remainingBalance) {
    // ❌ OVERPAYMENT CLAIMED: Potential fraud, log and reject
    console.error(
      `[Security] ❌ PAYMENT MISMATCH ALERT for job ${jobId}: ` +
      `Client claimed $${clientPaymentAmount} but balance is only $${remainingBalance.toFixed(2)}. ` +
      `userId=${userId}. Possible manipulation attempt!`
    );

    // Log fraud attempt with CRITICAL severity
    await logSyncOperation(auditContext, {
      operationType: 'payment_sync',
      entityType: 'job',
      entityId: jobId,
      clientClaimedAmount: clientPaymentAmount,
      serverActualAmount: remainingBalance,
      paymentVariance: clientPaymentAmount - remainingBalance,
      success: false,
      severity: 'CRITICAL',
      errorMessage: `FRAUD ALERT: Client claimed $${clientPaymentAmount}, server balance $${remainingBalance.toFixed(2)}`,
      details: {
        type: 'OVERPAYMENT_REJECTED',
        suspectedFraud: true,
      },
    });

    // Record the discrepancy but use the SERVER balance
    await prisma.job.update({
      where: { id: jobId },
      data: {
        paymentAmount: remainingBalance, // Use server-calculated amount
        paymentMethod: paymentData.paymentMethod || 'CASH',
        paymentCollectedAt: new Date(),
        paymentCollectedById: userId,
        status: 'COMPLETED',
        resolution: `PAYMENT_VARIANCE: Client claimed $${clientPaymentAmount}, server balance was $${remainingBalance.toFixed(2)}`,
        updatedAt: new Date(),
      },
    });

    return {
      conflict: true,
      resolution: 'server_wins',
      serverData: {
        warning: 'PAYMENT_VARIANCE',
        claimed: clientPaymentAmount,
        actual: remainingBalance,
        message: `Monto corregido a $${remainingBalance.toFixed(2)} (monto correcto según sistema)`,
      },
      paymentVariance: clientPaymentAmount - remainingBalance,
    };

  } else {
    // No payment amount provided
    console.warn(`[Payment Sync] No payment amount provided for job ${jobId}`);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 5: Sync Operation Audit Logging
// ═══════════════════════════════════════════════════════════════════════════════

interface SyncLogData {
  operationType: string;
  entityType?: string;
  entityId?: string;
  operationCount?: number;
  conflictCount?: number;
  paymentVariance?: number;
  clientClaimedAmount?: number;
  serverActualAmount?: number;
  statusTransition?: string;
  terminalStateBlocked?: boolean;
  success: boolean;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  errorMessage?: string;
  details?: Record<string, unknown>;
}

async function logSyncOperation(
  context: SyncAuditContext,
  data: SyncLogData
): Promise<void> {
  try {
    await prisma.syncOperation.create({
      data: {
        organizationId: context.organizationId,
        userId: context.userId,
        deviceId: context.deviceId,
        operationType: data.operationType,
        entityType: data.entityType,
        entityId: data.entityId,
        operationCount: data.operationCount ?? 0,
        conflictCount: data.conflictCount ?? 0,
        paymentVariance: data.paymentVariance,
        clientClaimedAmount: data.clientClaimedAmount,
        serverActualAmount: data.serverActualAmount,
        statusTransition: data.statusTransition,
        terminalStateBlocked: data.terminalStateBlocked ?? false,
        severity: data.severity,
        success: data.success,
        errorMessage: data.errorMessage,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: data.details,
      },
    });
  } catch (error) {
    // Log error but don't fail the sync
    console.error('[SyncAudit] Failed to log sync operation:', error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatJobForMobile(job: any) {
  return {
    id: job.id,
    status: job.status,
    scheduledDate: job.scheduledDate,
    scheduledTimeSlot: job.scheduledTimeSlot,
    description: job.description,
    urgency: job.urgency,
    customer: job.customer,
    materials: job.materials,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
