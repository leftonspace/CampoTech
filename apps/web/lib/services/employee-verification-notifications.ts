/**
 * Employee Verification Notification Service
 * ===========================================
 *
 * Handles notifications related to employee verification:
 * - Verification reminder to employees
 * - Notifications to owners about employee status
 * - Automatic reminders based on verification state
 */

import { prisma } from '@/lib/prisma';
import { getOrCreateEmailProvider } from '@/lib/email';
import type { EmailResult } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationReminderResult {
  success: boolean;
  emailSent: boolean;
  error?: string;
  lastReminderAt?: Date;
}

export interface EmployeeVerificationStatusForOwner {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  verificationStatus: 'not_started' | 'pending' | 'in_review' | 'verified' | 'suspended';
  canBeAssignedJobs: boolean;
  pendingDocuments: number;
  expiringDocuments: number;
  lastReminderSentAt?: Date;
  joinedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

function generateVerificationReminderEmailHTML(data: {
  employeeName: string;
  organizationName: string;
  ownerName?: string;
  verificationUrl: string;
  pendingItems: string[];
}): string {
  const pendingItemsHtml = data.pendingItems
    .map((item) => `<li style="margin: 8px 0;">${item}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #ffffff;
    }
    .header {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .content {
      padding: 30px 20px;
    }
    .alert-box {
      background: #fef3c7;
      border: 1px solid #fcd34d;
      border-radius: 8px;
      padding: 16px;
      margin: 20px 0;
    }
    .button {
      display: inline-block;
      background: #16a34a;
      color: white !important;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Completá tu verificación</h1>
    </div>
    <div class="content">
      <p>Hola ${data.employeeName},</p>

      <p>${data.ownerName ? `${data.ownerName} de ` : ''}${data.organizationName} te pide que completes tu verificación de identidad para poder asignarte trabajos.</p>

      <div class="alert-box">
        <strong>Pasos pendientes:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          ${pendingItemsHtml}
        </ul>
      </div>

      <p>La verificación solo toma unos minutos y es necesaria para que puedas recibir trabajos.</p>

      <p style="text-align: center;">
        <a href="${data.verificationUrl}" class="button">Completar verificación</a>
      </p>
    </div>
    <div class="footer">
      <p>CampoTech - Sistema de Gestión para Servicios de Campo</p>
    </div>
  </div>
</body>
</html>`;
}

function generateOwnerNotificationEmailHTML(data: {
  ownerName: string;
  employeeName: string;
  notificationType: 'verified' | 'expired' | 'blocked';
  details: string;
  actionUrl: string;
}): string {
  const config = {
    verified: {
      color: '#16a34a',
      icon: '✓',
      title: 'Verificación completada',
    },
    expired: {
      color: '#f59e0b',
      icon: '⚠️',
      title: 'Documento vencido',
    },
    blocked: {
      color: '#dc2626',
      icon: '🚫',
      title: 'Empleado bloqueado',
    },
  };

  const c = config[data.notificationType];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #fff; }
    .header { background: ${c.color}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { padding: 20px; }
    .button { display: inline-block; background: #16a34a; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; }
    .footer { background: #f8fafc; padding: 16px; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${c.icon} ${c.title}</h2>
    </div>
    <div class="content">
      <p>Hola ${data.ownerName},</p>
      <p><strong>${data.employeeName}</strong>: ${data.details}</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${data.actionUrl}" class="button">Ver detalles</a>
      </p>
    </div>
    <div class="footer">
      <p>CampoTech - Notificaciones de equipo</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send verification reminder to an employee
 */
export async function sendVerificationReminder(
  employeeId: string,
  organizationId: string,
  senderId: string
): Promise<VerificationReminderResult> {
  try {
    // Get employee details
    const employee = await prisma.user.findFirst({
      where: { id: employeeId, organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        verificationReminderSentAt: true,
      },
    });

    if (!employee) {
      return { success: false, emailSent: false, error: 'Empleado no encontrado' };
    }

    // Check if reminder was sent recently (within 24 hours)
    if (employee.verificationReminderSentAt) {
      const hoursSinceLastReminder =
        (Date.now() - employee.verificationReminderSentAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastReminder < 24) {
        return {
          success: false,
          emailSent: false,
          error: 'Ya se envió un recordatorio en las últimas 24 horas',
          lastReminderAt: employee.verificationReminderSentAt,
        };
      }
    }

    // Get organization and sender details
    const [organization, sender] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      }),
      prisma.user.findUnique({
        where: { id: senderId },
        select: { name: true },
      }),
    ]);

    // Get pending verification items
    const pendingItems = await getPendingVerificationItems(employeeId, organizationId);

    // Send email if email is available
    let emailSent = false;
    if (employee.email) {
      const provider = getOrCreateEmailProvider();
      const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com'}/dashboard/mi-verificacion`;

      const result = await provider.sendEmail({
        to: employee.email,
        subject: `Completá tu verificación - ${organization?.name || 'CampoTech'}`,
        html: generateVerificationReminderEmailHTML({
          employeeName: employee.name,
          organizationName: organization?.name || 'CampoTech',
          ownerName: sender?.name,
          verificationUrl,
          pendingItems,
        }),
      });

      emailSent = result.success;
    }

    // Update last reminder sent timestamp
    await prisma.user.update({
      where: { id: employeeId },
      data: { verificationReminderSentAt: new Date() },
    });

    // Log the action
    console.log('[Verification Reminder] Sent to:', employee.name, {
      emailSent,
      senderId,
    });

    return {
      success: true,
      emailSent,
      lastReminderAt: new Date(),
    };
  } catch (error) {
    console.error('[Verification Reminder] Error:', error);
    return {
      success: false,
      emailSent: false,
      error: error instanceof Error ? error.message : 'Error al enviar recordatorio',
    };
  }
}

/**
 * Get pending verification items for an employee
 */
async function getPendingVerificationItems(
  userId: string,
  organizationId: string
): Promise<string[]> {
  const items: string[] = [];

  try {
    // Get employee's verification submissions
    const submissions = await prisma.verificationSubmission.findMany({
      where: {
        organizationId,
        userId,
      },
      include: {
        requirement: true,
      },
    });

    // Get all employee requirements
    const requirements = await prisma.verificationRequirement.findMany({
      where: {
        appliesTo: { in: ['employee', 'both'] },
        tier: 3,
        isRequired: true,
      },
    });

    // Check which requirements are not completed
    type SubmissionEntry = (typeof submissions)[number];
    for (const req of requirements) {
      const submission = submissions.find((s: SubmissionEntry) => s.requirementId === req.id);
      if (!submission || submission.status !== 'approved') {
        items.push(req.name);
      }
    }
  } catch (error) {
    console.error('[Pending Items] Error:', error);
    items.push('Verificación de identidad');
  }

  return items.length > 0 ? items : ['Verificación de identidad'];
}

/**
 * Send notification to owner about employee verification status
 */
export async function notifyOwnerAboutEmployee(
  ownerId: string,
  employeeId: string,
  notificationType: 'verified' | 'expired' | 'blocked'
): Promise<EmailResult> {
  try {
    const [owner, employee] = await Promise.all([
      prisma.user.findUnique({
        where: { id: ownerId },
        select: { name: true, email: true, organizationId: true },
      }),
      prisma.user.findUnique({
        where: { id: employeeId },
        select: { name: true },
      }),
    ]);

    if (!owner?.email || !employee) {
      return { success: false, error: 'Usuario no encontrado' };
    }

    const details = {
      verified: 'completó su verificación y puede recibir trabajos',
      expired: 'tiene documentos vencidos que necesitan renovación',
      blocked: 'no puede trabajar debido a documentación pendiente o vencida',
    };

    const provider = getOrCreateEmailProvider();
    const actionUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com'}/dashboard/settings/team`;

    return await provider.sendEmail({
      to: owner.email,
      subject: `${employee.name} - ${notificationType === 'verified' ? 'Verificación completada' : 'Requiere atención'}`,
      html: generateOwnerNotificationEmailHTML({
        ownerName: owner.name,
        employeeName: employee.name,
        notificationType,
        details: details[notificationType],
        actionUrl,
      }),
    });
  } catch (error) {
    console.error('[Owner Notification] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al notificar',
    };
  }
}

/**
 * Get employees with verification status for owner view
 */
export async function getEmployeesWithVerificationStatus(
  organizationId: string
): Promise<EmployeeVerificationStatusForOwner[]> {
  const employees = await prisma.user.findMany({
    where: {
      organizationId,
      role: { in: ['TECHNICIAN', 'DISPATCHER'] },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      role: true,
      verificationStatus: true,
      verificationReminderSentAt: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  // Get verification submissions for all employees
  const submissions = await prisma.verificationSubmission.findMany({
    where: {
      organizationId,
      userId: { in: employees.map((e: { id: string }) => e.id) },
    },
    include: {
      requirement: true,
    },
  });

  // Group submissions by user
  const submissionsByUser = new Map<string, typeof submissions>();
  for (const sub of submissions) {
    const existing = submissionsByUser.get(sub.userId) || [];
    existing.push(sub);
    submissionsByUser.set(sub.userId, existing);
  }

  // Calculate status for each employee
  type EmployeeEntry = (typeof employees)[number];
  type UserSubmissionEntry = (typeof submissions)[number];
  return employees.map((emp: EmployeeEntry) => {
    const userSubs = submissionsByUser.get(emp.id) || [];

    // Count pending and expiring documents
    const pendingDocuments = userSubs.filter(
      (s: UserSubmissionEntry) => s.status === 'pending' || s.status === 'in_review'
    ).length;

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringDocuments = userSubs.filter(
      (s: UserSubmissionEntry) =>
        s.status === 'approved' &&
        s.expiresAt &&
        s.expiresAt <= thirtyDaysFromNow
    ).length;

    // Determine verification status
    let verificationStatus: EmployeeVerificationStatusForOwner['verificationStatus'] = 'not_started';
    const status = emp.verificationStatus?.toUpperCase();

    if (status === 'VERIFIED') {
      verificationStatus = 'verified';
    } else if (status === 'SUSPENDED') {
      verificationStatus = 'suspended';
    } else if (status === 'IN_REVIEW') {
      verificationStatus = 'in_review';
    } else if (userSubs.length > 0) {
      verificationStatus = 'pending';
    }

    // Check if can be assigned jobs
    const canBeAssignedJobs = verificationStatus === 'verified';

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      email: emp.email || undefined,
      role: emp.role,
      verificationStatus,
      canBeAssignedJobs,
      pendingDocuments,
      expiringDocuments,
      lastReminderSentAt: emp.verificationReminderSentAt || undefined,
      joinedAt: emp.createdAt,
    };
  });
}

/**
 * Check if employee can be assigned jobs
 */
export async function canEmployeeBeAssignedJobs(
  employeeId: string,
  organizationId: string
): Promise<{ canAssign: boolean; reason?: string }> {
  const employee = await prisma.user.findFirst({
    where: { id: employeeId, organizationId },
    select: {
      name: true,
      verificationStatus: true,
      isActive: true,
    },
  });

  if (!employee) {
    return { canAssign: false, reason: 'Empleado no encontrado' };
  }

  if (!employee.isActive) {
    return { canAssign: false, reason: 'El empleado está inactivo' };
  }

  const status = employee.verificationStatus?.toUpperCase();

  if (status !== 'VERIFIED') {
    const statusMessages: Record<string, string> = {
      NOT_STARTED: 'no ha comenzado su verificación',
      PENDING: 'tiene verificación pendiente',
      IN_REVIEW: 'tiene verificación en revisión',
      SUSPENDED: 'tiene verificación suspendida',
    };

    const reason = statusMessages[status || 'NOT_STARTED'] || 'no está verificado';
    return {
      canAssign: false,
      reason: `${employee.name} ${reason}. Verificación requerida.`,
    };
  }

  return { canAssign: true };
}
