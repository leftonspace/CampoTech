/**
 * Account Deletion Email Templates
 * =================================
 *
 * Emails for the account deletion flow per Ley 25.326.
 *
 * - Confirmation email (30-day waiting period starts)
 * - Reminder emails (7 days, 1 day before deletion)
 * - Deletion complete notification
 */

import { getOrCreateEmailProvider, EmailResult } from '../email';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DeletionConfirmEmailData {
    userName: string;
    confirmationUrl: string;
    expiresIn: string;
}

interface DeletionScheduledEmailData {
    userName: string;
    scheduledDate: string;
    daysRemaining: number;
    cancelUrl: string;
    dataToDelete: string[];
    dataToRetain: string[];
}

interface DeletionReminderEmailData {
    userName: string;
    daysRemaining: number;
    scheduledDate: string;
    cancelUrl: string;
}

interface DeletionCompleteEmailData {
    userName: string;
    deletedItems: string[];
    retainedItems: string[];
    retentionReason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL STYLES (shared)
// ═══════════════════════════════════════════════════════════════════════════════

const baseStyles = `
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
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  padding: 30px 20px;
  text-align: center;
  border-radius: 8px 8px 0 0;
}
.header h1 { margin: 0; font-size: 24px; }
.header p { margin: 10px 0 0 0; opacity: 0.9; font-size: 14px; }
.content { padding: 30px 20px; background: #ffffff; }
.warning-box {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}
.info-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}
.button {
  display: inline-block;
  background: #dc2626;
  color: white !important;
  padding: 14px 28px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: bold;
  margin: 20px 0;
}
.button-secondary {
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
.list { margin: 10px 0; padding-left: 20px; }
.list li { margin: 5px 0; }
.highlight { color: #dc2626; font-weight: bold; }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIRMATION EMAIL (Step 1 - Click to confirm)
// ═══════════════════════════════════════════════════════════════════════════════

function generateConfirmationEmailHTML(data: DeletionConfirmEmailData): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚠️ Confirmar Eliminación de Cuenta</h1>
      <p>Esta acción es irreversible</p>
    </div>
    <div class="content">
      <p>Hola ${data.userName},</p>

      <p>Recibimos tu solicitud para eliminar tu cuenta de CampoTech.</p>

      <div class="warning-box">
        <strong>⚠️ Importante:</strong>
        <p>Para confirmar la eliminación, hace clic en el siguiente botón. Tu cuenta será eliminada <strong>30 días</strong> después de la confirmación.</p>
        <p>Podés cancelar la eliminación en cualquier momento durante esos 30 días.</p>
      </div>

      <p style="text-align: center;">
        <a href="${data.confirmationUrl}" class="button">Confirmar Eliminación</a>
      </p>

      <div class="info-box">
        <p><strong>Este enlace expira en ${data.expiresIn}.</strong></p>
        <p>Si no solicitaste esta eliminación, podés ignorar este correo de forma segura.</p>
      </div>

      <p>Si tenés preguntas, contactanos respondiendo a este correo.</p>
    </div>
    <div class="footer">
      <p>Este correo fue enviado porque solicitaste eliminar tu cuenta.</p>
      <p>© ${new Date().getFullYear()} CampoTech - Tus datos, tus derechos (Ley 25.326)</p>
    </div>
  </div>
</body>
</html>`;
}

function generateConfirmationEmailText(data: DeletionConfirmEmailData): string {
    return `
Confirmar Eliminación de Cuenta - CampoTech

Hola ${data.userName},

Recibimos tu solicitud para eliminar tu cuenta de CampoTech.

IMPORTANTE:
Para confirmar la eliminación, visita el siguiente enlace:
${data.confirmationUrl}

Tu cuenta será eliminada 30 días después de la confirmación.
Podés cancelar la eliminación en cualquier momento durante esos 30 días.

Este enlace expira en ${data.expiresIn}.

Si no solicitaste esta eliminación, podés ignorar este correo.

---
CampoTech - Tus datos, tus derechos (Ley 25.326)
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULED EMAIL (Step 2 - Confirmed, 30-day countdown)
// ═══════════════════════════════════════════════════════════════════════════════

function generateScheduledEmailHTML(data: DeletionScheduledEmailData): string {
    const deleteList = data.dataToDelete.map(item => `<li>${item}</li>`).join('');
    const retainList = data.dataToRetain.map(item => `<li>${item}</li>`).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🗓️ Eliminación Programada</h1>
      <p>Tu cuenta será eliminada en ${data.daysRemaining} días</p>
    </div>
    <div class="content">
      <p>Hola ${data.userName},</p>

      <p>Confirmaste la eliminación de tu cuenta. La eliminación está programada para:</p>

      <div class="warning-box" style="text-align: center;">
        <p class="highlight" style="font-size: 24px; margin: 0;">📅 ${data.scheduledDate}</p>
        <p style="margin: 10px 0 0 0;">(en ${data.daysRemaining} días)</p>
      </div>

      <h3>¿Qué se eliminará?</h3>
      <ul class="list">${deleteList}</ul>

      <h3>¿Qué se conservará? (requerimiento legal)</h3>
      <ul class="list">${retainList}</ul>

      <div class="info-box">
        <p><strong>¿Cambiaste de opinión?</strong></p>
        <p>Podés cancelar la eliminación en cualquier momento antes del ${data.scheduledDate}.</p>
        <p style="text-align: center;">
          <a href="${data.cancelUrl}" class="button-secondary">Cancelar Eliminación</a>
        </p>
      </div>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CampoTech - Tus datos, tus derechos (Ley 25.326)</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REMINDER EMAIL (7 days, 1 day before)
// ═══════════════════════════════════════════════════════════════════════════════

function generateReminderEmailHTML(data: DeletionReminderEmailData): string {
    const urgency = data.daysRemaining <= 1 ? '🚨' : '⏰';
    const urgencyText = data.daysRemaining <= 1 ? 'MAÑANA' : `en ${data.daysRemaining} días`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${urgency} Recordatorio: Eliminación de Cuenta</h1>
      <p>Tu cuenta será eliminada ${urgencyText}</p>
    </div>
    <div class="content">
      <p>Hola ${data.userName},</p>

      <p>Te recordamos que tu cuenta de CampoTech será eliminada el:</p>

      <div class="warning-box" style="text-align: center;">
        <p class="highlight" style="font-size: 24px; margin: 0;">📅 ${data.scheduledDate}</p>
        <p style="margin: 10px 0 0 0;">(${urgencyText})</p>
      </div>

      <p>Si cambiaste de opinión, todavía estás a tiempo de cancelar la eliminación:</p>

      <p style="text-align: center;">
        <a href="${data.cancelUrl}" class="button-secondary">Cancelar Eliminación</a>
      </p>

      <p style="color: #666; font-size: 14px;">
        Si no hacés nada, tu cuenta será eliminada automáticamente el ${data.scheduledDate}.
      </p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CampoTech - Tus datos, tus derechos (Ley 25.326)</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETION COMPLETE EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

function generateDeletionCompleteEmailHTML(data: DeletionCompleteEmailData): string {
    const deleteList = data.deletedItems.map(item => `<li>✓ ${item}</li>`).join('');
    const retainList = data.retainedItems.map(item => `<li>${item}</li>`).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${baseStyles}</style>
</head>
<body>
  <div class="container">
    <div class="header" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%);">
      <h1>✅ Cuenta Eliminada</h1>
      <p>Tu solicitud ha sido procesada</p>
    </div>
    <div class="content">
      <p>Hola ${data.userName},</p>

      <p>Tu cuenta de CampoTech ha sido eliminada exitosamente.</p>

      <h3>Datos eliminados:</h3>
      <ul class="list" style="color: #16a34a;">${deleteList}</ul>

      <h3>Datos conservados (requerimiento legal):</h3>
      <ul class="list">${retainList}</ul>

      <div class="info-box">
        <p><strong>¿Por qué se conservan algunos datos?</strong></p>
        <p>${data.retentionReason}</p>
      </div>

      <p>Gracias por haber usado CampoTech. Si decidís volver en el futuro, serás bienvenido.</p>
    </div>
    <div class="footer">
      <p>© ${new Date().getFullYear()} CampoTech - Tus datos, tus derechos (Ley 25.326)</p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL SENDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send account deletion confirmation email
 */
export async function sendDeletionConfirmationEmail(
    email: string,
    userName: string,
    confirmationToken: string
): Promise<EmailResult> {
    const provider = getOrCreateEmailProvider();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const confirmationUrl = `${appUrl}/account/confirm-deletion?token=${confirmationToken}`;

    const data: DeletionConfirmEmailData = {
        userName,
        confirmationUrl,
        expiresIn: '24 horas',
    };

    return provider.sendEmail({
        to: email,
        subject: '⚠️ Confirma la eliminación de tu cuenta - CampoTech',
        html: generateConfirmationEmailHTML(data),
        text: generateConfirmationEmailText(data),
    });
}

/**
 * Send deletion scheduled confirmation email
 */
export async function sendDeletionScheduledEmail(
    email: string,
    userName: string,
    scheduledDate: Date,
    dataToDelete: string[],
    dataToRetain: string[]
): Promise<EmailResult> {
    const provider = getOrCreateEmailProvider();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cancelUrl = `${appUrl}/dashboard/settings/privacy`;

    const daysRemaining = Math.ceil(
        (scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    const data: DeletionScheduledEmailData = {
        userName,
        scheduledDate: scheduledDate.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires',
        }),
        daysRemaining,
        cancelUrl,
        dataToDelete,
        dataToRetain,
    };

    return provider.sendEmail({
        to: email,
        subject: `🗓️ Tu cuenta será eliminada en ${daysRemaining} días - CampoTech`,
        html: generateScheduledEmailHTML(data),
    });
}

/**
 * Send deletion reminder email (7 days, 1 day before)
 */
export async function sendDeletionReminderEmail(
    email: string,
    userName: string,
    scheduledDate: Date,
    daysRemaining: number
): Promise<EmailResult> {
    const provider = getOrCreateEmailProvider();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const cancelUrl = `${appUrl}/dashboard/settings/privacy`;

    const data: DeletionReminderEmailData = {
        userName,
        daysRemaining,
        scheduledDate: scheduledDate.toLocaleDateString('es-AR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires',
        }),
        cancelUrl,
    };

    const urgencyEmoji = daysRemaining <= 1 ? '🚨' : '⏰';

    return provider.sendEmail({
        to: email,
        subject: `${urgencyEmoji} Recordatorio: Tu cuenta será eliminada en ${daysRemaining} día${daysRemaining === 1 ? '' : 's'} - CampoTech`,
        html: generateReminderEmailHTML(data),
    });
}

/**
 * Send deletion complete notification email
 */
export async function sendDeletionCompleteEmail(
    email: string,
    userName: string,
    deletedItems: string[],
    retainedItems: string[],
    retentionReason: string
): Promise<EmailResult> {
    const provider = getOrCreateEmailProvider();

    const data: DeletionCompleteEmailData = {
        userName,
        deletedItems,
        retainedItems,
        retentionReason,
    };

    return provider.sendEmail({
        to: email,
        subject: '✅ Tu cuenta ha sido eliminada - CampoTech',
        html: generateDeletionCompleteEmailHTML(data),
    });
}
