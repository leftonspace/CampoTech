/**
 * CampoTech Verification Email Templates and Sending Functions
 * =============================================================
 *
 * Email templates for verification-related notifications:
 * - Document expiring reminders (30, 14, 7, 1 days)
 * - Document expired
 * - Document approved (with optional badge earned)
 * - Document rejected (with reason)
 * - Verification complete
 * - Account blocked/unblocked
 * - Employee welcome (with verification instructions)
 * - Employee verification reminder
 * - Employee document expiring notification to owner
 * - Employee compliance alert
 */

import { getOrCreateEmailProvider, EmailResult } from '@/lib/email';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UserEmailData {
  userId: string;
  userName: string;
  userEmail: string;
}

export interface OrganizationEmailData {
  organizationId: string;
  organizationName: string;
}

export interface DocumentEmailData {
  documentId: string;
  documentName: string;
  documentType: string;
  expiresAt?: Date;
}

export interface EmployeeEmailData {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
}

export interface InviterEmailData {
  inviterName: string;
  inviterEmail?: string;
}

export interface PendingVerificationItem {
  name: string;
  description?: string;
  daysUntilExpiry?: number;
  status: 'pending' | 'expiring' | 'expired';
}

export interface BadgeEarned {
  icon: string;
  label: string;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com';
const VERIFICATION_URL = `${APP_URL}/dashboard/verificacion`;
const EMPLOYEE_VERIFICATION_URL = `${APP_URL}/dashboard/mi-verificacion`;

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL BASE STYLES
// ═══════════════════════════════════════════════════════════════════════════════

function getEmailStyles(): string {
  return `
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
      padding: 30px 20px;
      text-align: center;
      border-radius: 8px 8px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      color: white;
    }
    .header p {
      margin: 10px 0 0 0;
      opacity: 0.9;
      font-size: 16px;
      color: white;
    }
    .content {
      padding: 30px 20px;
      background: #ffffff;
    }
    .content h2 {
      margin-top: 0;
    }
    .info-box {
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-item {
      margin: 10px 0;
    }
    .info-label {
      font-weight: bold;
      min-width: 120px;
      display: inline-block;
    }
    .button {
      display: inline-block;
      padding: 14px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: bold;
      margin: 20px 0;
      color: white !important;
    }
    .footer {
      background: #f8fafc;
      padding: 20px;
      border-radius: 0 0 8px 8px;
      font-size: 12px;
      color: #64748b;
      text-align: center;
    }
    .warning-box {
      background: #fff7ed;
      border: 1px solid #fed7aa;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .success-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .error-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .info-blue-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
    }
    .badge-box {
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      border: 2px solid #16a34a;
      border-radius: 12px;
      padding: 24px;
      margin: 20px 0;
      text-align: center;
    }
    .badge-icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .badge-label {
      font-size: 20px;
      font-weight: bold;
      color: #16a34a;
    }
    .checklist-item {
      padding: 12px 0;
      border-bottom: 1px solid #e2e8f0;
    }
    .checklist-item:last-child {
      border-bottom: none;
    }
    .status-pending {
      color: #d97706;
    }
    .status-expiring {
      color: #ea580c;
    }
    .status-expired {
      color: #dc2626;
    }
    .text-muted {
      color: #64748b;
      font-size: 14px;
    }
    .urgent-text {
      color: #dc2626;
      font-weight: bold;
    }
  `;
}

function emailWrapper(content: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${getEmailStyles()}</style>
</head>
<body>
  <div class="container">
    ${content}
    <div class="footer">
      <p>Este correo fue enviado automáticamente por CampoTech.</p>
      <p>&copy; ${new Date().getFullYear()} CampoTech - Sistema de Gestión para Servicios de Campo</p>
      <p><a href="${APP_URL}/unsubscribe" style="color: #64748b;">Cancelar suscripción a emails</a></p>
    </div>
  </div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT EXPIRING TEMPLATES (30, 14, 7, 1 days)
// ═══════════════════════════════════════════════════════════════════════════════

function generateDocumentExpiringHTML(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): string {
  const urgencyColor = daysRemaining <= 1 ? '#dc2626' : daysRemaining <= 7 ? '#ea580c' : daysRemaining <= 14 ? '#f59e0b' : '#3b82f6';
  const urgencyBg = daysRemaining <= 1 ? '#fef2f2' : daysRemaining <= 7 ? '#fff7ed' : daysRemaining <= 14 ? '#fffbeb' : '#eff6ff';
  const urgencyBorder = daysRemaining <= 1 ? '#fecaca' : daysRemaining <= 7 ? '#fed7aa' : daysRemaining <= 14 ? '#fde68a' : '#bfdbfe';

  const dayText = daysRemaining === 1 ? 'día' : 'días';
  const urgencyMessage = daysRemaining <= 1
    ? '¡Actualiza tu documento hoy para evitar bloqueos!'
    : daysRemaining <= 7
    ? 'Actualiza tu documento pronto para evitar interrupciones.'
    : 'Te recomendamos renovarlo con anticipación.';

  const expirationDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'pronto';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);">
      <h1>📄 Documento por vencer</h1>
      <p>${document.documentName} vence en ${daysRemaining} ${dayText}</p>
    </div>
    <div class="content">
      <h2 style="color: ${urgencyColor};">Hola ${user.userName}!</h2>

      <p>Te informamos que el siguiente documento de <strong>${org.organizationName}</strong> está por vencer:</p>

      <div class="info-box" style="background: ${urgencyBg}; border: 1px solid ${urgencyBorder};">
        <div class="info-item">
          <span class="info-label">Documento:</span>
          <span style="font-weight: bold;">${document.documentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Vencimiento:</span>
          <span style="color: ${urgencyColor}; font-weight: bold;">${expirationDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tiempo restante:</span>
          <span style="color: ${urgencyColor}; font-weight: bold;">${daysRemaining} ${dayText}</span>
        </div>
      </div>

      <p>${urgencyMessage}</p>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}" class="button" style="background: ${urgencyColor};">
          Actualizar documento
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Si ya renovaste este documento, sube la nueva versión para mantener tu verificación activa.
      </p>
    </div>
  `);
}

function generateDocumentExpiringText(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): string {
  const dayText = daysRemaining === 1 ? 'día' : 'días';
  const expirationDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR')
    : 'pronto';

  return `
Documento por vencer

Hola ${user.userName},

Te informamos que el siguiente documento de ${org.organizationName} está por vencer:

DETALLES DEL DOCUMENTO:
- Documento: ${document.documentName}
- Vencimiento: ${expirationDate}
- Tiempo restante: ${daysRemaining} ${dayText}

${daysRemaining <= 1 ? '¡URGENTE! Actualiza tu documento hoy para evitar bloqueos.' : 'Actualiza tu documento pronto para evitar interrupciones.'}

Actualizar documento: ${VERIFICATION_URL}

Si ya renovaste este documento, sube la nueva versión para mantener tu verificación activa.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT EXPIRED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateDocumentExpiredHTML(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData
): string {
  const expiredDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'recientemente';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h1>⚠️ Documento vencido</h1>
      <p>Se requiere acción inmediata</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${user.userName}!</h2>

      <p>El siguiente documento de <strong>${org.organizationName}</strong> ha vencido:</p>

      <div class="error-box">
        <div class="info-item">
          <span class="info-label">Documento:</span>
          <span style="font-weight: bold;">${document.documentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Venció el:</span>
          <span style="color: #dc2626; font-weight: bold;">${expiredDate}</span>
        </div>
      </div>

      <div class="warning-box">
        <h3 style="margin-top: 0; color: #d97706;">⚠️ Importante</h3>
        <p style="margin-bottom: 0;">
          Un documento vencido puede afectar tu capacidad de recibir trabajos en la plataforma.
          Actualízalo lo antes posible para mantener tu perfil activo.
        </p>
      </div>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}" class="button" style="background: #16a34a;">
          Actualizar documento ahora
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Necesitas ayuda? Contactanos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateDocumentExpiredText(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData
): string {
  const expiredDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR')
    : 'recientemente';

  return `
Documento vencido - Se requiere acción inmediata

Hola ${user.userName},

El siguiente documento de ${org.organizationName} ha vencido:

DETALLES DEL DOCUMENTO:
- Documento: ${document.documentName}
- Venció el: ${expiredDate}

IMPORTANTE:
Un documento vencido puede afectar tu capacidad de recibir trabajos en la plataforma.
Actualízalo lo antes posible para mantener tu perfil activo.

Actualizar documento: ${VERIFICATION_URL}

¿Necesitas ayuda? Contactanos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT APPROVED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateDocumentApprovedHTML(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  badgeEarned?: BadgeEarned
): string {
  const expirationInfo = document.expiresAt
    ? `Este documento vence el ${new Date(document.expiresAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })}. Te avisaremos antes de su vencimiento.`
    : '';

  const badgeSection = badgeEarned ? `
    <div class="badge-box">
      <div class="badge-icon">${getBadgeEmoji(badgeEarned.icon)}</div>
      <div class="badge-label">${badgeEarned.label}</div>
      ${badgeEarned.description ? `<p class="text-muted" style="margin-bottom: 0;">${badgeEarned.description}</p>` : ''}
      <p style="margin: 15px 0 0 0; font-size: 14px;">¡Esta insignia ahora aparece en tu perfil público!</p>
    </div>
  ` : '';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>✓ Documento aprobado</h1>
      <p>${document.documentName}</p>
    </div>
    <div class="content">
      <h2 style="color: #16a34a;">¡Excelente ${user.userName}!</h2>

      <p>Tu documento ha sido verificado y aprobado correctamente.</p>

      <div class="success-box">
        <div class="info-item">
          <span class="info-label">Documento:</span>
          <span style="font-weight: bold;">${document.documentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Organización:</span>
          <span>${org.organizationName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Estado:</span>
          <span style="color: #16a34a; font-weight: bold;">✓ Aprobado</span>
        </div>
      </div>

      ${badgeSection}

      ${expirationInfo ? `<p class="text-muted">${expirationInfo}</p>` : ''}

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}" class="button" style="background: #16a34a;">
          Ver mi verificación
        </a>
      </p>
    </div>
  `);
}

function generateDocumentApprovedText(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  badgeEarned?: BadgeEarned
): string {
  return `
Documento aprobado

¡Excelente ${user.userName}!

Tu documento ha sido verificado y aprobado correctamente.

DETALLES:
- Documento: ${document.documentName}
- Organización: ${org.organizationName}
- Estado: Aprobado

${badgeEarned ? `¡INSIGNIA GANADA! ${badgeEarned.label}\n${badgeEarned.description || ''}` : ''}

Ver mi verificación: ${VERIFICATION_URL}

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT REJECTED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateDocumentRejectedHTML(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  reason: string
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h1>✗ Documento rechazado</h1>
      <p>${document.documentName}</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${user.userName}</h2>

      <p>Lamentablemente, tu documento no pudo ser aprobado en esta oportunidad.</p>

      <div class="error-box">
        <div class="info-item">
          <span class="info-label">Documento:</span>
          <span style="font-weight: bold;">${document.documentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Estado:</span>
          <span style="color: #dc2626; font-weight: bold;">✗ Rechazado</span>
        </div>
      </div>

      <div class="info-blue-box">
        <h3 style="margin-top: 0; color: #2563eb;">Motivo del rechazo</h3>
        <p style="margin-bottom: 0;">${reason}</p>
      </div>

      <h3>¿Qué puedes hacer?</h3>
      <ul>
        <li>Revisa que el documento sea legible y esté completo</li>
        <li>Asegúrate de que la información coincida con tus datos</li>
        <li>Si es necesario, solicita un nuevo documento actualizado</li>
        <li>Vuelve a subir el documento corregido</li>
      </ul>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}" class="button" style="background: #3b82f6;">
          Volver a subir documento
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Crees que esto es un error? Contactanos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateDocumentRejectedText(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  reason: string
): string {
  return `
Documento rechazado

Hola ${user.userName},

Lamentablemente, tu documento no pudo ser aprobado en esta oportunidad.

DETALLES:
- Documento: ${document.documentName}
- Estado: Rechazado

MOTIVO DEL RECHAZO:
${reason}

¿QUÉ PUEDES HACER?
1. Revisa que el documento sea legible y esté completo
2. Asegúrate de que la información coincida con tus datos
3. Si es necesario, solicita un nuevo documento actualizado
4. Vuelve a subir el documento corregido

Volver a subir documento: ${VERIFICATION_URL}

¿Crees que esto es un error? Contactanos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION COMPLETE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateVerificationCompleteHTML(
  user: UserEmailData,
  org: OrganizationEmailData
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>🎉 ¡Verificación completa!</h1>
      <p>Tu negocio está listo para operar</p>
    </div>
    <div class="content">
      <h2 style="color: #16a34a;">¡Felicitaciones ${user.userName}!</h2>

      <p>Has completado exitosamente la verificación de <strong>${org.organizationName}</strong>.</p>

      <div class="success-box" style="text-align: center;">
        <div style="font-size: 64px; margin-bottom: 15px;">✓</div>
        <h3 style="margin: 0; color: #16a34a;">Cuenta Verificada</h3>
        <p style="margin: 10px 0 0 0;">Tu negocio ahora puede recibir trabajos en la plataforma</p>
      </div>

      <h3>¿Qué significa esto?</h3>
      <ul>
        <li><strong>Visibilidad:</strong> Tu perfil aparece en el marketplace</li>
        <li><strong>Confianza:</strong> Los clientes ven que sos un profesional verificado</li>
        <li><strong>Trabajos:</strong> Podés recibir y aceptar solicitudes de trabajo</li>
        <li><strong>Insignias:</strong> Tus certificaciones aparecen en tu perfil</li>
      </ul>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard" class="button" style="background: #16a34a;">
          Ir a mi panel
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Recordá mantener tus documentos actualizados. Te avisaremos antes de que venzan.
      </p>
    </div>
  `);
}

function generateVerificationCompleteText(
  user: UserEmailData,
  org: OrganizationEmailData
): string {
  return `
¡Verificación completa!

¡Felicitaciones ${user.userName}!

Has completado exitosamente la verificación de ${org.organizationName}.

CUENTA VERIFICADA
Tu negocio ahora puede recibir trabajos en la plataforma.

¿QUÉ SIGNIFICA ESTO?
- Visibilidad: Tu perfil aparece en el marketplace
- Confianza: Los clientes ven que sos un profesional verificado
- Trabajos: Podés recibir y aceptar solicitudes de trabajo
- Insignias: Tus certificaciones aparecen en tu perfil

Ir a mi panel: ${APP_URL}/dashboard

Recordá mantener tus documentos actualizados. Te avisaremos antes de que venzan.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT BLOCKED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateAccountBlockedHTML(
  user: UserEmailData,
  org: OrganizationEmailData,
  reason: string
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
      <h1>🚫 Cuenta bloqueada</h1>
      <p>Se requiere acción para continuar</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${user.userName}</h2>

      <p>Tu cuenta de <strong>${org.organizationName}</strong> ha sido bloqueada temporalmente.</p>

      <div class="error-box">
        <h3 style="margin-top: 0; color: #dc2626;">Motivo del bloqueo</h3>
        <p style="margin-bottom: 0;">${reason}</p>
      </div>

      <div class="warning-box">
        <h3 style="margin-top: 0; color: #d97706;">¿Qué significa esto?</h3>
        <ul style="margin-bottom: 0;">
          <li>No podés recibir nuevos trabajos</li>
          <li>Tu perfil no aparece en el marketplace</li>
          <li>Los trabajos en curso no se ven afectados</li>
        </ul>
      </div>

      <h3>Para desbloquear tu cuenta:</h3>
      <ol>
        <li>Revisá los documentos pendientes en tu panel de verificación</li>
        <li>Subí o actualizá los documentos requeridos</li>
        <li>Una vez aprobados, tu cuenta se desbloqueará automáticamente</li>
      </ol>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}" class="button" style="background: #16a34a;">
          Resolver ahora
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Necesitas ayuda? Contactanos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateAccountBlockedText(
  user: UserEmailData,
  org: OrganizationEmailData,
  reason: string
): string {
  return `
Cuenta bloqueada - Se requiere acción

Hola ${user.userName},

Tu cuenta de ${org.organizationName} ha sido bloqueada temporalmente.

MOTIVO DEL BLOQUEO:
${reason}

¿QUÉ SIGNIFICA ESTO?
- No podés recibir nuevos trabajos
- Tu perfil no aparece en el marketplace
- Los trabajos en curso no se ven afectados

PARA DESBLOQUEAR TU CUENTA:
1. Revisá los documentos pendientes en tu panel de verificación
2. Subí o actualizá los documentos requeridos
3. Una vez aprobados, tu cuenta se desbloqueará automáticamente

Resolver ahora: ${VERIFICATION_URL}

¿Necesitas ayuda? Contactanos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT UNBLOCKED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateAccountUnblockedHTML(
  user: UserEmailData,
  org: OrganizationEmailData
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>✓ Cuenta desbloqueada</h1>
      <p>¡Tu cuenta está activa nuevamente!</p>
    </div>
    <div class="content">
      <h2 style="color: #16a34a;">¡Buenas noticias ${user.userName}!</h2>

      <p>Tu cuenta de <strong>${org.organizationName}</strong> ha sido desbloqueada.</p>

      <div class="success-box">
        <h3 style="margin-top: 0; color: #16a34a;">Tu cuenta está activa</h3>
        <ul style="margin-bottom: 0;">
          <li>Ya podés recibir nuevos trabajos</li>
          <li>Tu perfil está visible en el marketplace</li>
          <li>Todas las funcionalidades están disponibles</li>
        </ul>
      </div>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard" class="button" style="background: #16a34a;">
          Ir a mi panel
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Recordá mantener tus documentos actualizados para evitar futuros bloqueos.
      </p>
    </div>
  `);
}

function generateAccountUnblockedText(
  user: UserEmailData,
  org: OrganizationEmailData
): string {
  return `
Cuenta desbloqueada

¡Buenas noticias ${user.userName}!

Tu cuenta de ${org.organizationName} ha sido desbloqueada.

TU CUENTA ESTÁ ACTIVA:
- Ya podés recibir nuevos trabajos
- Tu perfil está visible en el marketplace
- Todas las funcionalidades están disponibles

Ir a mi panel: ${APP_URL}/dashboard

Recordá mantener tus documentos actualizados para evitar futuros bloqueos.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE WELCOME TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateEmployeeWelcomeHTML(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  inviter: InviterEmailData
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
      <h1>👋 ¡Bienvenido a CampoTech!</h1>
      <p>Te uniste al equipo de ${org.organizationName}</p>
    </div>
    <div class="content">
      <h2 style="color: #2563eb;">Hola ${employee.employeeName}!</h2>

      <p><strong>${inviter.inviterName}</strong> te agregó al equipo de <strong>${org.organizationName}</strong> en CampoTech.</p>

      <div class="info-blue-box">
        <h3 style="margin-top: 0; color: #2563eb;">Para empezar a trabajar, necesitás verificar tu identidad</h3>
        <p style="margin-bottom: 0;">Es un proceso simple que toma solo unos minutos.</p>
      </div>

      <h3>Pasos para completar tu verificación:</h3>
      <ol>
        <li><strong>Ingresá con tu email</strong> - Usá este correo para acceder</li>
        <li><strong>Completá tu CUIL</strong> - Lo validamos automáticamente</li>
        <li><strong>Subí tu DNI</strong> - Foto del frente del documento</li>
        <li><strong>Sacate una selfie</strong> - Con tu DNI en la mano</li>
        <li><strong>Verificá tu teléfono</strong> - Te enviamos un código por SMS</li>
      </ol>

      <p style="text-align: center;">
        <a href="${EMPLOYEE_VERIFICATION_URL}" class="button" style="background: #3b82f6;">
          Completar mi verificación
        </a>
      </p>

      <div class="info-box" style="background: #f8fafc; border: 1px solid #e2e8f0;">
        <h4 style="margin-top: 0;">¿Por qué necesitamos verificarte?</h4>
        <p style="margin-bottom: 0;">
          La verificación protege a todos: a vos, a ${org.organizationName} y a los clientes.
          Es un requisito para poder ser asignado a trabajos en la plataforma.
        </p>
      </div>

      <p class="text-muted" style="text-align: center;">
        ¿Tenés dudas? Contactá a ${inviter.inviterName}${inviter.inviterEmail ? ` (${inviter.inviterEmail})` : ''} o escribinos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateEmployeeWelcomeText(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  inviter: InviterEmailData
): string {
  return `
¡Bienvenido a CampoTech!

Hola ${employee.employeeName},

${inviter.inviterName} te agregó al equipo de ${org.organizationName} en CampoTech.

PARA EMPEZAR A TRABAJAR, NECESITÁS VERIFICAR TU IDENTIDAD

Pasos para completar tu verificación:
1. Ingresá con tu email - Usá este correo para acceder
2. Completá tu CUIL - Lo validamos automáticamente
3. Subí tu DNI - Foto del frente del documento
4. Sacate una selfie - Con tu DNI en la mano
5. Verificá tu teléfono - Te enviamos un código por SMS

Completar mi verificación: ${EMPLOYEE_VERIFICATION_URL}

¿POR QUÉ NECESITAMOS VERIFICARTE?
La verificación protege a todos: a vos, a ${org.organizationName} y a los clientes.
Es un requisito para poder ser asignado a trabajos en la plataforma.

¿Tenés dudas? Contactá a ${inviter.inviterName}${inviter.inviterEmail ? ` (${inviter.inviterEmail})` : ''} o escribinos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE VERIFICATION REMINDER TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateEmployeeReminderHTML(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  pendingItems: PendingVerificationItem[]
): string {
  const pendingCount = pendingItems.length;
  const itemsHtml = pendingItems.map(item => {
    const statusClass = item.status === 'expired' ? 'status-expired' :
                        item.status === 'expiring' ? 'status-expiring' : 'status-pending';
    const statusText = item.status === 'expired' ? 'Vencido' :
                       item.status === 'expiring' ? `Vence en ${item.daysUntilExpiry} días` : 'Pendiente';
    return `
      <div class="checklist-item">
        <strong>${item.name}</strong>
        <span class="${statusClass}" style="float: right;">${statusText}</span>
        ${item.description ? `<br><span class="text-muted">${item.description}</span>` : ''}
      </div>
    `;
  }).join('');

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
      <h1>📋 Recordatorio de verificación</h1>
      <p>Tenés ${pendingCount} ${pendingCount === 1 ? 'documento pendiente' : 'documentos pendientes'}</p>
    </div>
    <div class="content">
      <h2 style="color: #d97706;">Hola ${employee.employeeName}!</h2>

      <p>Te recordamos que tenés documentos pendientes para completar tu verificación en <strong>${org.organizationName}</strong>.</p>

      <div class="warning-box">
        <h3 style="margin-top: 0; color: #d97706;">Documentos pendientes</h3>
        ${itemsHtml}
      </div>

      <p>Completar tu verificación te permitirá ser asignado a trabajos en la plataforma.</p>

      <p style="text-align: center;">
        <a href="${EMPLOYEE_VERIFICATION_URL}" class="button" style="background: #f59e0b;">
          Completar verificación
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Necesitas ayuda? Contactá al administrador de ${org.organizationName} o escribinos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateEmployeeReminderText(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  pendingItems: PendingVerificationItem[]
): string {
  const itemsList = pendingItems.map(item => {
    const statusText = item.status === 'expired' ? '[VENCIDO]' :
                       item.status === 'expiring' ? `[Vence en ${item.daysUntilExpiry} días]` : '[Pendiente]';
    return `- ${item.name} ${statusText}`;
  }).join('\n');

  return `
Recordatorio de verificación

Hola ${employee.employeeName},

Te recordamos que tenés documentos pendientes para completar tu verificación en ${org.organizationName}.

DOCUMENTOS PENDIENTES:
${itemsList}

Completar tu verificación te permitirá ser asignado a trabajos en la plataforma.

Completar verificación: ${EMPLOYEE_VERIFICATION_URL}

¿Necesitas ayuda? Contactá al administrador de ${org.organizationName} o escribinos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE DOC EXPIRING TO OWNER TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateEmployeeExpiringToOwnerHTML(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employee: EmployeeEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): string {
  const urgencyColor = daysRemaining <= 1 ? '#dc2626' : daysRemaining <= 7 ? '#ea580c' : '#f59e0b';
  const dayText = daysRemaining === 1 ? 'día' : 'días';

  const expirationDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'pronto';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);">
      <h1>👤 Documento de empleado por vencer</h1>
      <p>${employee.employeeName} - ${document.documentName}</p>
    </div>
    <div class="content">
      <h2 style="color: ${urgencyColor};">Hola ${owner.userName}!</h2>

      <p>Te informamos que un documento de un empleado de <strong>${org.organizationName}</strong> está por vencer:</p>

      <div class="warning-box">
        <div class="info-item">
          <span class="info-label">Empleado:</span>
          <span style="font-weight: bold;">${employee.employeeName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Documento:</span>
          <span style="font-weight: bold;">${document.documentName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Vencimiento:</span>
          <span style="color: ${urgencyColor}; font-weight: bold;">${expirationDate}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Tiempo restante:</span>
          <span style="color: ${urgencyColor}; font-weight: bold;">${daysRemaining} ${dayText}</span>
        </div>
      </div>

      <p>
        ${daysRemaining <= 7
          ? '⚠️ El empleado no podrá ser asignado a trabajos una vez que el documento expire.'
          : 'Te recomendamos contactar al empleado para que actualice su documentación.'}
      </p>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}/empleados" class="button" style="background: ${urgencyColor};">
          Ver empleados
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        También enviamos un recordatorio a ${employee.employeeName} para que actualice su documento.
      </p>
    </div>
  `);
}

function generateEmployeeExpiringToOwnerText(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employee: EmployeeEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): string {
  const dayText = daysRemaining === 1 ? 'día' : 'días';
  const expirationDate = document.expiresAt
    ? new Date(document.expiresAt).toLocaleDateString('es-AR')
    : 'pronto';

  return `
Documento de empleado por vencer

Hola ${owner.userName},

Te informamos que un documento de un empleado de ${org.organizationName} está por vencer:

DETALLES:
- Empleado: ${employee.employeeName}
- Documento: ${document.documentName}
- Vencimiento: ${expirationDate}
- Tiempo restante: ${daysRemaining} ${dayText}

${daysRemaining <= 7
  ? '⚠️ El empleado no podrá ser asignado a trabajos una vez que el documento expire.'
  : 'Te recomendamos contactar al empleado para que actualice su documentación.'}

Ver empleados: ${VERIFICATION_URL}/empleados

También enviamos un recordatorio a ${employee.employeeName} para que actualice su documento.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE COMPLIANCE ALERT TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateEmployeeComplianceAlertHTML(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employees: Array<{ name: string; issues: string[] }>
): string {
  const employeeRows = employees.map(emp => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
        <strong>${emp.name}</strong>
      </td>
      <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
        <ul style="margin: 0; padding-left: 20px; color: #dc2626;">
          ${emp.issues.map(issue => `<li>${issue}</li>`).join('')}
        </ul>
      </td>
    </tr>
  `).join('');

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%);">
      <h1>⚠️ Alerta de cumplimiento</h1>
      <p>${employees.length} ${employees.length === 1 ? 'empleado requiere' : 'empleados requieren'} atención</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${owner.userName}!</h2>

      <p>Hay empleados de <strong>${org.organizationName}</strong> con problemas de verificación que requieren tu atención:</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; margin: 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f8fafc;">
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Empleado</th>
            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0;">Problemas</th>
          </tr>
        </thead>
        <tbody>
          ${employeeRows}
        </tbody>
      </table>

      <div class="error-box">
        <p style="margin: 0;">
          <strong>Importante:</strong> Los empleados con documentos vencidos o incompletos no pueden ser asignados a trabajos.
          Esto puede afectar la capacidad operativa de tu negocio.
        </p>
      </div>

      <p style="text-align: center;">
        <a href="${VERIFICATION_URL}/empleados" class="button" style="background: #dc2626;">
          Gestionar empleados
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Podés enviar recordatorios a los empleados desde el panel de verificación.
      </p>
    </div>
  `);
}

function generateEmployeeComplianceAlertText(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employees: Array<{ name: string; issues: string[] }>
): string {
  const employeeList = employees.map(emp =>
    `- ${emp.name}:\n${emp.issues.map(issue => `  * ${issue}`).join('\n')}`
  ).join('\n');

  return `
Alerta de cumplimiento

Hola ${owner.userName},

Hay empleados de ${org.organizationName} con problemas de verificación que requieren tu atención:

${employeeList}

IMPORTANTE:
Los empleados con documentos vencidos o incompletos no pueden ser asignados a trabajos.
Esto puede afectar la capacidad operativa de tu negocio.

Gestionar empleados: ${VERIFICATION_URL}/empleados

Podés enviar recordatorios a los empleados desde el panel de verificación.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getBadgeEmoji(icon: string): string {
  const iconMap: Record<string, string> = {
    'flame': '🔥',
    'zap': '⚡',
    'shield-check': '🛡️',
    'shield': '🛡️',
    'file-check': '📄',
    'building': '🏛️',
    'award': '🏆',
    'star': '⭐',
    'check-circle': '✓',
  };
  return iconMap[icon] || '🏅';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send document expiring reminder email
 */
export async function sendDocumentExpiringEmail(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const urgencyText =
    daysRemaining === 1
      ? '¡URGENTE! Tu documento vence mañana'
      : daysRemaining <= 7
      ? `⚠️ Tu documento vence en ${daysRemaining} días`
      : `📄 Recordatorio: documento vence en ${daysRemaining} días`;

  return provider.sendEmail({
    to: user.userEmail,
    subject: `${urgencyText} - ${document.documentName} - CampoTech`,
    html: generateDocumentExpiringHTML(user, org, document, daysRemaining),
    text: generateDocumentExpiringText(user, org, document, daysRemaining),
  });
}

/**
 * Send document expired email
 */
export async function sendDocumentExpiredEmail(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: user.userEmail,
    subject: `⚠️ Documento vencido: ${document.documentName} - CampoTech`,
    html: generateDocumentExpiredHTML(user, org, document),
    text: generateDocumentExpiredText(user, org, document),
  });
}

/**
 * Send document approved email
 */
export async function sendDocumentApprovedEmail(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  badgeEarned?: BadgeEarned
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const subject = badgeEarned
    ? `✓ Documento aprobado + Nueva insignia: ${badgeEarned.label} - CampoTech`
    : `✓ Documento aprobado: ${document.documentName} - CampoTech`;

  return provider.sendEmail({
    to: user.userEmail,
    subject,
    html: generateDocumentApprovedHTML(user, org, document, badgeEarned),
    text: generateDocumentApprovedText(user, org, document, badgeEarned),
  });
}

/**
 * Send document rejected email
 */
export async function sendDocumentRejectedEmail(
  user: UserEmailData,
  org: OrganizationEmailData,
  document: DocumentEmailData,
  reason: string
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: user.userEmail,
    subject: `✗ Documento rechazado: ${document.documentName} - CampoTech`,
    html: generateDocumentRejectedHTML(user, org, document, reason),
    text: generateDocumentRejectedText(user, org, document, reason),
  });
}

/**
 * Send verification complete email
 */
export async function sendVerificationCompleteEmail(
  user: UserEmailData,
  org: OrganizationEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: user.userEmail,
    subject: `🎉 ¡Verificación completa! Tu negocio está listo - CampoTech`,
    html: generateVerificationCompleteHTML(user, org),
    text: generateVerificationCompleteText(user, org),
  });
}

/**
 * Send account blocked email
 */
export async function sendAccountBlockedEmail(
  user: UserEmailData,
  org: OrganizationEmailData,
  reason: string
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: user.userEmail,
    subject: `🚫 Cuenta bloqueada - Acción requerida - CampoTech`,
    html: generateAccountBlockedHTML(user, org, reason),
    text: generateAccountBlockedText(user, org, reason),
  });
}

/**
 * Send account unblocked email
 */
export async function sendAccountUnblockedEmail(
  user: UserEmailData,
  org: OrganizationEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: user.userEmail,
    subject: `✓ Cuenta desbloqueada - ¡Ya podés operar! - CampoTech`,
    html: generateAccountUnblockedHTML(user, org),
    text: generateAccountUnblockedText(user, org),
  });
}

/**
 * Send employee welcome email with verification instructions
 */
export async function sendEmployeeWelcomeEmail(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  inviter: InviterEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: employee.employeeEmail,
    subject: `👋 ¡Bienvenido al equipo de ${org.organizationName}! - CampoTech`,
    html: generateEmployeeWelcomeHTML(employee, org, inviter),
    text: generateEmployeeWelcomeText(employee, org, inviter),
  });
}

/**
 * Send employee verification reminder email
 */
export async function sendEmployeeReminderEmail(
  employee: EmployeeEmailData,
  org: OrganizationEmailData,
  pendingItems: PendingVerificationItem[]
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const pendingCount = pendingItems.length;
  const hasExpired = pendingItems.some(item => item.status === 'expired');

  const subject = hasExpired
    ? `⚠️ Documentos vencidos - Acción requerida - CampoTech`
    : `📋 Recordatorio: ${pendingCount} ${pendingCount === 1 ? 'documento pendiente' : 'documentos pendientes'} - CampoTech`;

  return provider.sendEmail({
    to: employee.employeeEmail,
    subject,
    html: generateEmployeeReminderHTML(employee, org, pendingItems),
    text: generateEmployeeReminderText(employee, org, pendingItems),
  });
}

/**
 * Send employee document expiring notification to owner
 */
export async function sendEmployeeExpiringToOwnerEmail(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employee: EmployeeEmailData,
  document: DocumentEmailData,
  daysRemaining: number
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const dayText = daysRemaining === 1 ? 'mañana' : `en ${daysRemaining} días`;

  return provider.sendEmail({
    to: owner.userEmail,
    subject: `👤 Documento de ${employee.employeeName} vence ${dayText} - CampoTech`,
    html: generateEmployeeExpiringToOwnerHTML(owner, org, employee, document, daysRemaining),
    text: generateEmployeeExpiringToOwnerText(owner, org, employee, document, daysRemaining),
  });
}

/**
 * Send employee compliance alert to owner
 */
export async function sendEmployeeComplianceAlertEmail(
  owner: UserEmailData,
  org: OrganizationEmailData,
  employees: Array<{ name: string; issues: string[] }>
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: owner.userEmail,
    subject: `⚠️ Alerta de cumplimiento: ${employees.length} ${employees.length === 1 ? 'empleado requiere' : 'empleados requieren'} atención - CampoTech`,
    html: generateEmployeeComplianceAlertHTML(owner, org, employees),
    text: generateEmployeeComplianceAlertText(owner, org, employees),
  });
}
