/**
 * CampoTech Subscription Email Templates and Sending Functions
 * ============================================================
 *
 * Email templates for subscription-related notifications:
 * - Trial expiring reminders (7, 3, 1 days)
 * - Trial expired
 * - Payment successful
 * - Payment failed
 * - Payment pending (cash/transfer)
 * - Subscription cancelled
 * - Subscription renewed
 * - Payment reminder (3 days before renewal)
 */

import { getOrCreateEmailProvider, EmailResult } from '@/lib/email';
import { SubscriptionTier, BillingCycle } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationEmailData {
  organizationId: string;
  organizationName: string;
  ownerName: string;
  ownerEmail: string;
}

export interface PaymentEmailData {
  paymentId: string;
  amount: number;
  currency: string;
  paymentMethod?: string;
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
}

export interface PendingPaymentInstructions {
  paymentMethod: string;
  externalResourceUrl?: string;
  barcodeContent?: string;
  expirationDate?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://campotech.com';

const TIER_NAMES: Record<SubscriptionTier, string> = {
  FREE: 'Gratis',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESA: 'Empresa',
};

const TIER_PRICES: Record<SubscriptionTier, { monthly: number; yearly: number }> = {
  FREE: { monthly: 0, yearly: 0 },
  INICIAL: { monthly: 25, yearly: 250 },
  PROFESIONAL: { monthly: 55, yearly: 550 },
  EMPRESA: { monthly: 120, yearly: 1200 },
};

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
    .price-highlight {
      font-size: 32px;
      font-weight: bold;
      margin: 10px 0;
    }
    .text-muted {
      color: #64748b;
      font-size: 14px;
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
// TRIAL EXPIRING TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

function generateTrialExpiringHTML(
  org: OrganizationEmailData,
  daysRemaining: number
): string {
  const urgencyColor = daysRemaining <= 1 ? '#dc2626' : daysRemaining <= 3 ? '#ea580c' : '#f59e0b';
  const urgencyBg = daysRemaining <= 1 ? '#fef2f2' : daysRemaining <= 3 ? '#fff7ed' : '#fffbeb';
  const urgencyBorder = daysRemaining <= 1 ? '#fecaca' : daysRemaining <= 3 ? '#fed7aa' : '#fde68a';

  const dayText = daysRemaining === 1 ? 'día' : 'días';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);">
      <h1>⏰ Tu período de prueba está por terminar</h1>
      <p>Quedan ${daysRemaining} ${dayText}</p>
    </div>
    <div class="content">
      <h2 style="color: ${urgencyColor};">Hola ${org.ownerName}!</h2>

      <p>Tu período de prueba de <strong>CampoTech</strong> para <strong>${org.organizationName}</strong> termina en <strong>${daysRemaining} ${dayText}</strong>.</p>

      <div class="info-box" style="background: ${urgencyBg}; border: 1px solid ${urgencyBorder};">
        <p style="margin: 0; font-size: 18px;">
          Para continuar usando todas las funcionalidades, elige un plan antes de que expire tu prueba.
        </p>
      </div>

      <h3>Nuestros planes:</h3>
      <table width="100%" cellpadding="15" style="border-collapse: collapse; margin: 20px 0;">
        <tr style="background: #f8fafc;">
          <td style="border: 1px solid #e2e8f0; border-radius: 8px 0 0 0;">
            <strong>Inicial</strong><br>
            <span style="font-size: 24px; color: #16a34a;">$25 USD/mes</span><br>
            <span class="text-muted">Ideal para empezar</span>
          </td>
          <td style="border: 1px solid #e2e8f0;">
            <strong>Profesional</strong><br>
            <span style="font-size: 24px; color: #16a34a;">$55 USD/mes</span><br>
            <span class="text-muted">Para equipos en crecimiento</span>
          </td>
          <td style="border: 1px solid #e2e8f0; border-radius: 0 8px 0 0;">
            <strong>Empresa</strong><br>
            <span style="font-size: 24px; color: #16a34a;">$120 USD/mes</span><br>
            <span class="text-muted">Funciones avanzadas</span>
          </td>
        </tr>
      </table>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard/settings/subscription" class="button" style="background: ${urgencyColor};">
          Elegir mi plan ahora
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Paga anualmente y ahorra 2 meses. Todos los planes incluyen soporte por WhatsApp.
      </p>
    </div>
  `);
}

function generateTrialExpiringText(
  org: OrganizationEmailData,
  daysRemaining: number
): string {
  const dayText = daysRemaining === 1 ? 'día' : 'días';
  return `
Tu período de prueba está por terminar

Hola ${org.ownerName},

Tu período de prueba de CampoTech para ${org.organizationName} termina en ${daysRemaining} ${dayText}.

Para continuar usando todas las funcionalidades, elige un plan antes de que expire tu prueba.

NUESTROS PLANES:
- Inicial: $25 USD/mes - Ideal para empezar
- Profesional: $55 USD/mes - Para equipos en crecimiento
- Empresa: $120 USD/mes - Funciones avanzadas

Elige tu plan aquí: ${APP_URL}/dashboard/settings/subscription

Paga anualmente y ahorra 2 meses. Todos los planes incluyen soporte por WhatsApp.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TRIAL EXPIRED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateTrialExpiredHTML(org: OrganizationEmailData): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h1>Tu período de prueba ha terminado</h1>
      <p>Pero no te preocupes, puedes reactivar tu cuenta fácilmente</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${org.ownerName}!</h2>

      <p>Tu período de prueba de <strong>CampoTech</strong> para <strong>${org.organizationName}</strong> ha terminado.</p>

      <div class="error-box">
        <p style="margin: 0; font-size: 16px;">
          <strong>⚠️ Tu cuenta tiene acceso limitado.</strong><br>
          No podrás crear nuevos trabajos ni acceder a funciones premium hasta que elijas un plan.
        </p>
      </div>

      <h3>Qué puedes hacer ahora:</h3>
      <ul>
        <li>Tus datos están seguros y guardados</li>
        <li>Puedes ver tu historial de trabajos</li>
        <li>Elige un plan para desbloquear todas las funciones</li>
      </ul>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard/settings/subscription" class="button" style="background: #16a34a;">
          Reactivar mi cuenta
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Necesitas más tiempo? Contactanos por WhatsApp y te ayudamos.
      </p>
    </div>
  `);
}

function generateTrialExpiredText(org: OrganizationEmailData): string {
  return `
Tu período de prueba ha terminado

Hola ${org.ownerName},

Tu período de prueba de CampoTech para ${org.organizationName} ha terminado.

Tu cuenta tiene acceso limitado. No podrás crear nuevos trabajos ni acceder a funciones premium hasta que elijas un plan.

QUÉ PUEDES HACER AHORA:
- Tus datos están seguros y guardados
- Puedes ver tu historial de trabajos
- Elige un plan para desbloquear todas las funciones

Reactivar mi cuenta: ${APP_URL}/dashboard/settings/subscription

¿Necesitas más tiempo? Contactanos por WhatsApp y te ayudamos.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT SUCCESSFUL TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generatePaymentSuccessfulHTML(
  org: OrganizationEmailData,
  payment: PaymentEmailData
): string {
  const tierName = TIER_NAMES[payment.tier];
  const cycleText = payment.billingCycle === 'YEARLY' ? 'anual' : 'mensual';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>✓ Pago confirmado</h1>
      <p>Gracias por tu pago</p>
    </div>
    <div class="content">
      <h2 style="color: #16a34a;">Hola ${org.ownerName}!</h2>

      <p>Hemos recibido tu pago correctamente. Tu suscripción a <strong>CampoTech</strong> está activa.</p>

      <div class="success-box">
        <h3 style="margin-top: 0; color: #15803d;">Detalles del pago</h3>
        <div class="info-item">
          <span class="info-label">Monto:</span>
          <span style="font-weight: bold; font-size: 18px;">$${payment.amount.toFixed(2)} ${payment.currency}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Plan:</span>
          <span>${tierName} (${cycleText})</span>
        </div>
        <div class="info-item">
          <span class="info-label">Método:</span>
          <span>${payment.paymentMethod || 'MercadoPago'}</span>
        </div>
        <div class="info-item">
          <span class="info-label">ID de pago:</span>
          <span style="font-family: monospace;">${payment.paymentId}</span>
        </div>
      </div>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard" class="button" style="background: #16a34a;">
          Ir a mi panel
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Recibirás tu próxima factura por email. Puedes ver todas tus facturas en Configuración → Suscripción.
      </p>
    </div>
  `);
}

function generatePaymentSuccessfulText(
  org: OrganizationEmailData,
  payment: PaymentEmailData
): string {
  const tierName = TIER_NAMES[payment.tier];
  const cycleText = payment.billingCycle === 'YEARLY' ? 'anual' : 'mensual';

  return `
Pago confirmado

Hola ${org.ownerName},

Hemos recibido tu pago correctamente. Tu suscripción a CampoTech está activa.

DETALLES DEL PAGO:
- Monto: $${payment.amount.toFixed(2)} ${payment.currency}
- Plan: ${tierName} (${cycleText})
- Método: ${payment.paymentMethod || 'MercadoPago'}
- ID de pago: ${payment.paymentId}

Ir a mi panel: ${APP_URL}/dashboard

Recibirás tu próxima factura por email. Puedes ver todas tus facturas en Configuración → Suscripción.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT FAILED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generatePaymentFailedHTML(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  reason: string
): string {
  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);">
      <h1>⚠️ Problema con tu pago</h1>
      <p>Necesitamos que actualices tu método de pago</p>
    </div>
    <div class="content">
      <h2 style="color: #dc2626;">Hola ${org.ownerName}!</h2>

      <p>No pudimos procesar tu pago de suscripción para <strong>${org.organizationName}</strong>.</p>

      <div class="error-box">
        <h3 style="margin-top: 0; color: #dc2626;">Motivo del error</h3>
        <p style="margin-bottom: 0;">${reason || 'El pago fue rechazado por el medio de pago.'}</p>
      </div>

      <div class="info-box" style="background: #f8fafc; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0;">Qué puedes hacer:</h3>
        <ol>
          <li>Verifica que tu tarjeta tenga fondos suficientes</li>
          <li>Asegúrate de que los datos estén correctos</li>
          <li>Intenta con otro método de pago</li>
        </ol>
      </div>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard/settings/subscription" class="button" style="background: #16a34a;">
          Reintentar pago
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Tienes 7 días para actualizar tu pago. Después, tu cuenta pasará a plan gratuito.
      </p>
    </div>
  `);
}

function generatePaymentFailedText(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  reason: string
): string {
  return `
Problema con tu pago

Hola ${org.ownerName},

No pudimos procesar tu pago de suscripción para ${org.organizationName}.

MOTIVO DEL ERROR:
${reason || 'El pago fue rechazado por el medio de pago.'}

QUÉ PUEDES HACER:
1. Verifica que tu tarjeta tenga fondos suficientes
2. Asegúrate de que los datos estén correctos
3. Intenta con otro método de pago

Reintentar pago: ${APP_URL}/dashboard/settings/subscription

Tienes 7 días para actualizar tu pago. Después, tu cuenta pasará a plan gratuito.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PENDING (CASH) TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generatePaymentPendingHTML(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  instructions: PendingPaymentInstructions
): string {
  const expirationText = instructions.expirationDate
    ? new Date(instructions.expirationDate).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'próximas 48 horas';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
      <h1>💵 Pago pendiente</h1>
      <p>Completa tu pago para activar tu suscripción</p>
    </div>
    <div class="content">
      <h2 style="color: #d97706;">Hola ${org.ownerName}!</h2>

      <p>Generamos tu pago por <strong>${instructions.paymentMethod || 'efectivo'}</strong>. Completa el pago para activar tu suscripción en <strong>${org.organizationName}</strong>.</p>

      <div class="warning-box">
        <h3 style="margin-top: 0; color: #d97706;">Monto a pagar</h3>
        <div class="price-highlight" style="color: #d97706;">$${payment.amount.toFixed(2)} ${payment.currency}</div>
        <p style="margin-bottom: 0;" class="text-muted">Vence: ${expirationText}</p>
      </div>

      ${instructions.barcodeContent ? `
      <div class="info-box" style="background: #f8fafc; border: 1px solid #e2e8f0; text-align: center;">
        <h3 style="margin-top: 0;">Código de barras</h3>
        <p style="font-family: monospace; font-size: 14px; word-break: break-all; background: white; padding: 10px; border-radius: 4px;">
          ${instructions.barcodeContent}
        </p>
      </div>
      ` : ''}

      ${instructions.externalResourceUrl ? `
      <p style="text-align: center;">
        <a href="${instructions.externalResourceUrl}" class="button" style="background: #f59e0b;">
          Ver instrucciones de pago
        </a>
      </p>
      ` : ''}

      <h3>Lugares de pago:</h3>
      <ul>
        <li>Pago Fácil</li>
        <li>Rapipago</li>
        <li>Provincia NET</li>
        <li>Red Link (cajeros automáticos)</li>
      </ul>

      <p class="text-muted" style="text-align: center;">
        Una vez que pagues, tu suscripción se activará automáticamente en unos minutos.
      </p>
    </div>
  `);
}

function generatePaymentPendingText(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  instructions: PendingPaymentInstructions
): string {
  const expirationText = instructions.expirationDate
    ? new Date(instructions.expirationDate).toLocaleDateString('es-AR')
    : 'próximas 48 horas';

  return `
Pago pendiente

Hola ${org.ownerName},

Generamos tu pago por ${instructions.paymentMethod || 'efectivo'}. Completa el pago para activar tu suscripción en ${org.organizationName}.

MONTO A PAGAR: $${payment.amount.toFixed(2)} ${payment.currency}
Vence: ${expirationText}

${instructions.barcodeContent ? `CÓDIGO DE BARRAS:\n${instructions.barcodeContent}\n` : ''}

LUGARES DE PAGO:
- Pago Fácil
- Rapipago
- Provincia NET
- Red Link (cajeros automáticos)

${instructions.externalResourceUrl ? `Ver instrucciones: ${instructions.externalResourceUrl}\n` : ''}

Una vez que pagues, tu suscripción se activará automáticamente en unos minutos.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION CANCELLED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateSubscriptionCancelledHTML(
  org: OrganizationEmailData,
  endDate?: Date
): string {
  const endDateText = endDate
    ? new Date(endDate).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'el final del período actual';

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #64748b 0%, #475569 100%);">
      <h1>Tu suscripción fue cancelada</h1>
      <p>Lamentamos verte partir</p>
    </div>
    <div class="content">
      <h2 style="color: #475569;">Hola ${org.ownerName}!</h2>

      <p>Tu suscripción de <strong>CampoTech</strong> para <strong>${org.organizationName}</strong> ha sido cancelada.</p>

      <div class="info-box" style="background: #f8fafc; border: 1px solid #e2e8f0;">
        <h3 style="margin-top: 0;">Información importante</h3>
        <ul style="margin-bottom: 0;">
          <li>Seguirás teniendo acceso hasta <strong>${endDateText}</strong></li>
          <li>Tus datos permanecerán guardados por 30 días</li>
          <li>Puedes reactivar tu suscripción en cualquier momento</li>
        </ul>
      </div>

      <p>¿Cambiaste de opinión? Siempre puedes volver.</p>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard/settings/subscription" class="button" style="background: #16a34a;">
          Reactivar suscripción
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Tuviste algún problema? Nos encantaría saber cómo podemos mejorar.
        <br>Escríbenos a soporte@campotech.com
      </p>
    </div>
  `);
}

function generateSubscriptionCancelledText(
  org: OrganizationEmailData,
  endDate?: Date
): string {
  const endDateText = endDate
    ? new Date(endDate).toLocaleDateString('es-AR')
    : 'el final del período actual';

  return `
Tu suscripción fue cancelada

Hola ${org.ownerName},

Tu suscripción de CampoTech para ${org.organizationName} ha sido cancelada.

INFORMACIÓN IMPORTANTE:
- Seguirás teniendo acceso hasta ${endDateText}
- Tus datos permanecerán guardados por 30 días
- Puedes reactivar tu suscripción en cualquier momento

¿Cambiaste de opinión? Siempre puedes volver.
Reactivar suscripción: ${APP_URL}/dashboard/settings/subscription

¿Tuviste algún problema? Nos encantaría saber cómo podemos mejorar.
Escríbenos a soporte@campotech.com

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBSCRIPTION RENEWED TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

function generateSubscriptionRenewedHTML(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  nextRenewalDate: Date
): string {
  const tierName = TIER_NAMES[payment.tier];
  const nextDateText = new Date(nextRenewalDate).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
      <h1>✓ Suscripción renovada</h1>
      <p>Tu pago se procesó correctamente</p>
    </div>
    <div class="content">
      <h2 style="color: #16a34a;">Hola ${org.ownerName}!</h2>

      <p>Tu suscripción a <strong>CampoTech</strong> ha sido renovada automáticamente.</p>

      <div class="success-box">
        <div class="info-item">
          <span class="info-label">Plan:</span>
          <span>${tierName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Monto:</span>
          <span>$${payment.amount.toFixed(2)} ${payment.currency}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Próxima renovación:</span>
          <span>${nextDateText}</span>
        </div>
      </div>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard" class="button" style="background: #16a34a;">
          Ir a mi panel
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        Gracias por seguir confiando en CampoTech para tu negocio.
      </p>
    </div>
  `);
}

function generateSubscriptionRenewedText(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  nextRenewalDate: Date
): string {
  const tierName = TIER_NAMES[payment.tier];
  const nextDateText = new Date(nextRenewalDate).toLocaleDateString('es-AR');

  return `
Suscripción renovada

Hola ${org.ownerName},

Tu suscripción a CampoTech ha sido renovada automáticamente.

DETALLES:
- Plan: ${tierName}
- Monto: $${payment.amount.toFixed(2)} ${payment.currency}
- Próxima renovación: ${nextDateText}

Ir a mi panel: ${APP_URL}/dashboard

Gracias por seguir confiando en CampoTech para tu negocio.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT REMINDER TEMPLATE (3 days before renewal)
// ═══════════════════════════════════════════════════════════════════════════════

function generatePaymentReminderHTML(
  org: OrganizationEmailData,
  tier: SubscriptionTier,
  billingCycle: BillingCycle,
  nextBillingDate: Date
): string {
  const tierName = TIER_NAMES[tier];
  const price = billingCycle === 'YEARLY' ? TIER_PRICES[tier].yearly : TIER_PRICES[tier].monthly;
  const dateText = new Date(nextBillingDate).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return emailWrapper(`
    <div class="header" style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);">
      <h1>📅 Recordatorio de pago</h1>
      <p>Tu suscripción se renueva pronto</p>
    </div>
    <div class="content">
      <h2 style="color: #2563eb;">Hola ${org.ownerName}!</h2>

      <p>Queremos recordarte que tu suscripción a <strong>CampoTech</strong> se renovará el <strong>${dateText}</strong>.</p>

      <div class="info-box" style="background: #eff6ff; border: 1px solid #bfdbfe;">
        <h3 style="margin-top: 0; color: #2563eb;">Detalles de tu suscripción</h3>
        <div class="info-item">
          <span class="info-label">Plan:</span>
          <span>${tierName}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Monto:</span>
          <span>$${price.toFixed(2)} USD</span>
        </div>
        <div class="info-item">
          <span class="info-label">Fecha de cobro:</span>
          <span>${dateText}</span>
        </div>
      </div>

      <p>Asegúrate de que tu método de pago esté actualizado para evitar interrupciones en el servicio.</p>

      <p style="text-align: center;">
        <a href="${APP_URL}/dashboard/settings/subscription" class="button" style="background: #3b82f6;">
          Verificar método de pago
        </a>
      </p>

      <p class="text-muted" style="text-align: center;">
        ¿Quieres cambiar de plan o ciclo de facturación? Hazlo antes de la renovación.
      </p>
    </div>
  `);
}

function generatePaymentReminderText(
  org: OrganizationEmailData,
  tier: SubscriptionTier,
  billingCycle: BillingCycle,
  nextBillingDate: Date
): string {
  const tierName = TIER_NAMES[tier];
  const price = billingCycle === 'YEARLY' ? TIER_PRICES[tier].yearly : TIER_PRICES[tier].monthly;
  const dateText = new Date(nextBillingDate).toLocaleDateString('es-AR');

  return `
Recordatorio de pago

Hola ${org.ownerName},

Queremos recordarte que tu suscripción a CampoTech se renovará el ${dateText}.

DETALLES DE TU SUSCRIPCIÓN:
- Plan: ${tierName}
- Monto: $${price.toFixed(2)} USD
- Fecha de cobro: ${dateText}

Asegúrate de que tu método de pago esté actualizado para evitar interrupciones en el servicio.

Verificar método de pago: ${APP_URL}/dashboard/settings/subscription

¿Quieres cambiar de plan o ciclo de facturación? Hazlo antes de la renovación.

---
CampoTech - Sistema de Gestión para Servicios de Campo
`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEND FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send trial expiring reminder email
 */
export async function sendTrialExpiringEmail(
  org: OrganizationEmailData,
  daysRemaining: number
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  const urgencyText =
    daysRemaining === 1
      ? '¡Último día!'
      : daysRemaining <= 3
      ? '¡Solo quedan días!'
      : 'Tu prueba termina pronto';

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `${urgencyText} Tu período de prueba termina en ${daysRemaining} ${daysRemaining === 1 ? 'día' : 'días'} - CampoTech`,
    html: generateTrialExpiringHTML(org, daysRemaining),
    text: generateTrialExpiringText(org, daysRemaining),
  });
}

/**
 * Send trial expired email
 */
export async function sendTrialExpiredEmail(
  org: OrganizationEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `Tu período de prueba ha terminado - CampoTech`,
    html: generateTrialExpiredHTML(org),
    text: generateTrialExpiredText(org),
  });
}

/**
 * Send payment successful email
 */
export async function sendPaymentSuccessfulEmail(
  org: OrganizationEmailData,
  payment: PaymentEmailData
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `Pago confirmado - $${payment.amount.toFixed(2)} ${payment.currency} - CampoTech`,
    html: generatePaymentSuccessfulHTML(org, payment),
    text: generatePaymentSuccessfulText(org, payment),
  });
}

/**
 * Send payment failed email
 */
export async function sendPaymentFailedEmail(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  reason: string
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `⚠️ Problema con tu pago - CampoTech`,
    html: generatePaymentFailedHTML(org, payment, reason),
    text: generatePaymentFailedText(org, payment, reason),
  });
}

/**
 * Send payment pending (cash) email with instructions
 */
export async function sendPaymentPendingEmail(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  instructions: PendingPaymentInstructions
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `Completa tu pago de $${payment.amount.toFixed(2)} ${payment.currency} - CampoTech`,
    html: generatePaymentPendingHTML(org, payment, instructions),
    text: generatePaymentPendingText(org, payment, instructions),
  });
}

/**
 * Send subscription cancelled email
 */
export async function sendSubscriptionCancelledEmail(
  org: OrganizationEmailData,
  endDate?: Date
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `Tu suscripción fue cancelada - CampoTech`,
    html: generateSubscriptionCancelledHTML(org, endDate),
    text: generateSubscriptionCancelledText(org, endDate),
  });
}

/**
 * Send subscription renewed email
 */
export async function sendSubscriptionRenewedEmail(
  org: OrganizationEmailData,
  payment: PaymentEmailData,
  nextRenewalDate: Date
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `Suscripción renovada - CampoTech`,
    html: generateSubscriptionRenewedHTML(org, payment, nextRenewalDate),
    text: generateSubscriptionRenewedText(org, payment, nextRenewalDate),
  });
}

/**
 * Send payment reminder email (3 days before renewal)
 */
export async function sendPaymentReminderEmail(
  org: OrganizationEmailData,
  tier: SubscriptionTier,
  billingCycle: BillingCycle,
  nextBillingDate: Date
): Promise<EmailResult> {
  const provider = getOrCreateEmailProvider();

  return provider.sendEmail({
    to: org.ownerEmail,
    subject: `📅 Recordatorio: Tu suscripción se renueva pronto - CampoTech`,
    html: generatePaymentReminderHTML(org, tier, billingCycle, nextBillingDate),
    text: generatePaymentReminderText(org, tier, billingCycle, nextBillingDate),
  });
}
