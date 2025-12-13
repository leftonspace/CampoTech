/**
 * Email Template Customization Service
 * =====================================
 *
 * Manages customizable email templates for customer portal communications.
 * Supports white-label branding and localization (Spanish for Argentina).
 */

import { prisma } from '@/lib/prisma';
import { log } from '@/lib/logger';
import { getBrandingConfig, BrandingConfig } from './theme-generator';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type EmailTemplateType =
  | 'magic_link'
  | 'otp_code'
  | 'booking_confirmation'
  | 'booking_reminder'
  | 'job_scheduled'
  | 'job_confirmed'
  | 'technician_en_route'
  | 'job_completed'
  | 'job_cancelled'
  | 'invoice_created'
  | 'payment_received'
  | 'payment_reminder'
  | 'ticket_created'
  | 'ticket_reply'
  | 'feedback_request'
  | 'welcome';

export interface EmailTemplate {
  id: string;
  organizationId: string;
  type: EmailTemplateType;
  subject: string;
  htmlBody: string;
  textBody?: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailTemplateInput {
  organizationId: string;
  type: EmailTemplateType;
  subject: string;
  htmlBody: string;
  textBody?: string;
}

export interface RenderContext {
  organizationName: string;
  organizationLogo?: string;
  primaryColor: string;
  customerName: string;
  [key: string]: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT TEMPLATES (Spanish for Argentina)
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_TEMPLATES: Record<EmailTemplateType, { subject: string; htmlBody: string; textBody: string }> = {
  magic_link: {
    subject: 'Tu link de acceso a {{organizationName}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <h2 style="color: #333333; margin-bottom: 20px;">Hola {{customerName}},</h2>
    <p style="color: #666666; font-size: 16px; line-height: 1.5;">
      Hacé clic en el siguiente botón para acceder a tu portal de cliente:
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{magicLink}}" style="background-color: {{primaryColor}}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
        Acceder al portal
      </a>
    </div>
    <p style="color: #999999; font-size: 14px;">
      Este enlace expira en {{expiresIn}}. Si no solicitaste este acceso, podés ignorar este email.
    </p>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}} | {{organizationAddress}}
  </div>
</div>`,
    textBody: `Hola {{customerName}},

Accedé a tu portal de cliente usando este link: {{magicLink}}

Este enlace expira en {{expiresIn}}.

{{organizationName}}`,
  },

  otp_code: {
    subject: 'Tu código de verificación - {{organizationName}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff; text-align: center;">
    <h2 style="color: #333333; margin-bottom: 20px;">Tu código de verificación</h2>
    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: {{primaryColor}};">{{otpCode}}</span>
    </div>
    <p style="color: #666666; font-size: 14px;">
      Este código expira en {{expiresIn}}. No compartas este código con nadie.
    </p>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}}
  </div>
</div>`,
    textBody: `Tu código de verificación es: {{otpCode}}

Este código expira en {{expiresIn}}.

{{organizationName}}`,
  },

  booking_confirmation: {
    subject: 'Reserva confirmada - {{serviceName}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <h2 style="color: #333333;">¡Reserva confirmada!</h2>
    <p style="color: #666666;">Hola {{customerName}}, tu reserva ha sido confirmada:</p>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>Servicio:</strong> {{serviceName}}</p>
      <p style="margin: 10px 0;"><strong>Fecha:</strong> {{scheduledDate}}</p>
      <p style="margin: 10px 0;"><strong>Hora:</strong> {{scheduledTime}}</p>
      <p style="margin: 10px 0;"><strong>Dirección:</strong> {{address}}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{portalUrl}}/jobs/{{jobId}}" style="background-color: {{primaryColor}}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Ver detalles
      </a>
    </div>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}} | Tel: {{organizationPhone}}
  </div>
</div>`,
    textBody: `¡Reserva confirmada!

Hola {{customerName}}, tu reserva ha sido confirmada:

Servicio: {{serviceName}}
Fecha: {{scheduledDate}}
Hora: {{scheduledTime}}
Dirección: {{address}}

Ver detalles: {{portalUrl}}/jobs/{{jobId}}

{{organizationName}}`,
  },

  technician_en_route: {
    subject: '🚗 Tu técnico está en camino',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 20px;">🚗</div>
    <h2 style="color: #333333;">¡Tu técnico está en camino!</h2>
    <p style="color: #666666; font-size: 16px;">
      {{technicianName}} está yendo a tu ubicación.
    </p>
    <div style="background-color: {{primaryColor}}; color: white; padding: 15px 20px; border-radius: 8px; margin: 20px auto; display: inline-block;">
      <span style="font-size: 24px; font-weight: bold;">{{etaMinutes}} min</span>
      <br>
      <span style="font-size: 12px;">tiempo estimado de llegada</span>
    </div>

    <div style="margin: 30px 0;">
      <a href="{{portalUrl}}/track/{{jobId}}" style="background-color: {{primaryColor}}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Seguir en tiempo real
      </a>
    </div>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}}
  </div>
</div>`,
    textBody: `¡Tu técnico está en camino!

{{technicianName}} llegará en aproximadamente {{etaMinutes}} minutos.

Seguí en tiempo real: {{portalUrl}}/track/{{jobId}}

{{organizationName}}`,
  },

  job_completed: {
    subject: '✅ Servicio completado - {{serviceName}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <div style="text-align: center; font-size: 48px; margin-bottom: 20px;">✅</div>
    <h2 style="color: #333333; text-align: center;">¡Servicio completado!</h2>
    <p style="color: #666666; text-align: center;">
      Esperamos que el servicio haya sido de tu satisfacción.
    </p>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>Servicio:</strong> {{serviceName}}</p>
      <p style="margin: 10px 0;"><strong>Técnico:</strong> {{technicianName}}</p>
      <p style="margin: 10px 0;"><strong>Completado:</strong> {{completedAt}}</p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{portalUrl}}/jobs/{{jobId}}/feedback" style="background-color: {{primaryColor}}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Dejá tu opinión
      </a>
    </div>

    <p style="color: #999999; font-size: 14px; text-align: center;">
      Tu opinión nos ayuda a mejorar 🙏
    </p>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}}
  </div>
</div>`,
    textBody: `¡Servicio completado!

Servicio: {{serviceName}}
Técnico: {{technicianName}}
Completado: {{completedAt}}

Dejá tu opinión: {{portalUrl}}/jobs/{{jobId}}/feedback

{{organizationName}}`,
  },

  invoice_created: {
    subject: 'Nueva factura #{{invoiceNumber}} - {{organizationName}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff;">
    <h2 style="color: #333333;">Nueva factura disponible</h2>
    <p style="color: #666666;">Hola {{customerName}}, tenés una nueva factura:</p>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 10px 0;"><strong>Factura:</strong> #{{invoiceNumber}}</p>
      <p style="margin: 10px 0;"><strong>Fecha:</strong> {{issuedDate}}</p>
      <p style="margin: 10px 0;"><strong>Vencimiento:</strong> {{dueDate}}</p>
      <p style="margin: 10px 0; font-size: 24px;"><strong>Total: {{total}}</strong></p>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="{{portalUrl}}/payments/pay/{{invoiceId}}" style="background-color: {{primaryColor}}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">
        Pagar ahora
      </a>
    </div>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}}
  </div>
</div>`,
    textBody: `Nueva factura disponible

Hola {{customerName}}, tenés una nueva factura:

Factura: #{{invoiceNumber}}
Fecha: {{issuedDate}}
Vencimiento: {{dueDate}}
Total: {{total}}

Pagar: {{portalUrl}}/payments/pay/{{invoiceId}}

{{organizationName}}`,
  },

  payment_received: {
    subject: '✅ Pago recibido - Factura #{{invoiceNumber}}',
    htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 20px; background-color: {{primaryColor}};">
    {{#if organizationLogo}}<img src="{{organizationLogo}}" alt="{{organizationName}}" style="max-height: 50px;">{{/if}}
  </div>
  <div style="padding: 30px; background-color: #ffffff; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 20px;">✅</div>
    <h2 style="color: #333333;">¡Pago recibido!</h2>
    <p style="color: #666666;">Gracias por tu pago.</p>

    <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: left;">
      <p style="margin: 10px 0;"><strong>Factura:</strong> #{{invoiceNumber}}</p>
      <p style="margin: 10px 0;"><strong>Monto:</strong> {{amount}}</p>
      <p style="margin: 10px 0;"><strong>Método:</strong> {{paymentMethod}}</p>
      <p style="margin: 10px 0;"><strong>Fecha:</strong> {{paymentDate}}</p>
    </div>
  </div>
  <div style="padding: 20px; text-align: center; background-color: #f9fafb; color: #999999; font-size: 12px;">
    {{organizationName}}
  </div>
</div>`,
    textBody: `¡Pago recibido!

Gracias por tu pago.

Factura: #{{invoiceNumber}}
Monto: {{amount}}
Método: {{paymentMethod}}
Fecha: {{paymentDate}}

{{organizationName}}`,
  },

  // Simplified templates for other types
  booking_reminder: {
    subject: '📅 Recordatorio: Tu servicio es mañana',
    htmlBody: '<p>Recordatorio de tu servicio programado para mañana.</p>',
    textBody: 'Recordatorio de tu servicio programado para mañana.',
  },

  job_scheduled: {
    subject: '📅 Servicio programado - {{serviceName}}',
    htmlBody: '<p>Tu servicio ha sido programado.</p>',
    textBody: 'Tu servicio ha sido programado.',
  },

  job_confirmed: {
    subject: '✅ Servicio confirmado - {{serviceName}}',
    htmlBody: '<p>Tu servicio ha sido confirmado.</p>',
    textBody: 'Tu servicio ha sido confirmado.',
  },

  job_cancelled: {
    subject: '❌ Servicio cancelado - {{serviceName}}',
    htmlBody: '<p>Lamentamos informarte que tu servicio ha sido cancelado.</p>',
    textBody: 'Lamentamos informarte que tu servicio ha sido cancelado.',
  },

  payment_reminder: {
    subject: '⏰ Recordatorio de pago - Factura #{{invoiceNumber}}',
    htmlBody: '<p>Tenés un pago pendiente.</p>',
    textBody: 'Tenés un pago pendiente.',
  },

  ticket_created: {
    subject: '🎫 Ticket #{{ticketNumber}} creado',
    htmlBody: '<p>Tu ticket de soporte ha sido creado.</p>',
    textBody: 'Tu ticket de soporte ha sido creado.',
  },

  ticket_reply: {
    subject: '💬 Nueva respuesta en ticket #{{ticketNumber}}',
    htmlBody: '<p>Hay una nueva respuesta en tu ticket de soporte.</p>',
    textBody: 'Hay una nueva respuesta en tu ticket de soporte.',
  },

  feedback_request: {
    subject: '⭐ ¿Cómo fue tu experiencia?',
    htmlBody: '<p>Nos gustaría conocer tu opinión sobre el servicio.</p>',
    textBody: 'Nos gustaría conocer tu opinión sobre el servicio.',
  },

  welcome: {
    subject: '👋 Bienvenido/a a {{organizationName}}',
    htmlBody: '<p>¡Gracias por registrarte!</p>',
    textBody: '¡Gracias por registrarte!',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get email template for an organization
 */
export async function getEmailTemplate(
  organizationId: string,
  type: EmailTemplateType
): Promise<EmailTemplate | null> {
  try {
    const template = await prisma.emailTemplate.findUnique({
      where: {
        organizationId_type: {
          organizationId,
          type,
        },
      },
    });

    if (template) {
      return {
        id: template.id,
        organizationId: template.organizationId,
        type: template.type as EmailTemplateType,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody || undefined,
        variables: template.variables as string[],
        isActive: template.isActive,
        createdAt: template.createdAt,
        updatedAt: template.updatedAt,
      };
    }

    // Return default template
    const defaultTemplate = DEFAULT_TEMPLATES[type];
    if (!defaultTemplate) return null;

    return {
      id: `default-${type}`,
      organizationId,
      type,
      subject: defaultTemplate.subject,
      htmlBody: defaultTemplate.htmlBody,
      textBody: defaultTemplate.textBody,
      variables: extractVariables(defaultTemplate.htmlBody),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    log.error('Error getting email template', { organizationId, type, error });
    return null;
  }
}

/**
 * Save custom email template
 */
export async function saveEmailTemplate(input: EmailTemplateInput): Promise<EmailTemplate> {
  try {
    const variables = extractVariables(input.htmlBody);

    const result = await prisma.emailTemplate.upsert({
      where: {
        organizationId_type: {
          organizationId: input.organizationId,
          type: input.type,
        },
      },
      create: {
        organizationId: input.organizationId,
        type: input.type,
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        variables,
        isActive: true,
      },
      update: {
        subject: input.subject,
        htmlBody: input.htmlBody,
        textBody: input.textBody,
        variables,
        updatedAt: new Date(),
      },
    });

    log.info('Saved email template', { organizationId: input.organizationId, type: input.type });

    return {
      id: result.id,
      organizationId: result.organizationId,
      type: result.type as EmailTemplateType,
      subject: result.subject,
      htmlBody: result.htmlBody,
      textBody: result.textBody || undefined,
      variables: result.variables as string[],
      isActive: result.isActive,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    log.error('Error saving email template', { organizationId: input.organizationId, type: input.type, error });
    throw error;
  }
}

/**
 * Reset template to default
 */
export async function resetEmailTemplate(
  organizationId: string,
  type: EmailTemplateType
): Promise<void> {
  try {
    await prisma.emailTemplate.delete({
      where: {
        organizationId_type: {
          organizationId,
          type,
        },
      },
    });
    log.info('Reset email template to default', { organizationId, type });
  } catch (error) {
    // Template might not exist, which is fine
    log.debug('Template not found for reset', { organizationId, type });
  }
}

/**
 * Render email template with context
 */
export async function renderEmailTemplate(
  organizationId: string,
  type: EmailTemplateType,
  context: RenderContext
): Promise<{ subject: string; html: string; text?: string } | null> {
  const template = await getEmailTemplate(organizationId, type);
  if (!template || !template.isActive) return null;

  // Get branding for color
  const branding = await getBrandingConfig(organizationId);
  const fullContext = {
    ...context,
    primaryColor: branding?.primaryColor || '#16a34a',
    organizationLogo: branding?.logoUrl,
  };

  return {
    subject: interpolate(template.subject, fullContext),
    html: interpolate(template.htmlBody, fullContext),
    text: template.textBody ? interpolate(template.textBody, fullContext) : undefined,
  };
}

/**
 * Get all templates for an organization
 */
export async function getAllEmailTemplates(organizationId: string): Promise<EmailTemplate[]> {
  const customTemplates = await prisma.emailTemplate.findMany({
    where: { organizationId },
  });

  const customTypes = new Set(customTemplates.map((t: typeof customTemplates[number]) => t.type));
  const allTemplates: EmailTemplate[] = [];

  // Add custom templates
  for (const t of customTemplates as typeof customTemplates) {
    allTemplates.push({
      id: t.id,
      organizationId: t.organizationId,
      type: t.type as EmailTemplateType,
      subject: t.subject,
      htmlBody: t.htmlBody,
      textBody: t.textBody || undefined,
      variables: t.variables as string[],
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });
  }

  // Add defaults for missing types
  for (const [type, defaultTemplate] of Object.entries(DEFAULT_TEMPLATES) as [EmailTemplateType, { subject: string; htmlBody: string; textBody: string }][]) {
    if (!customTypes.has(type)) {
      allTemplates.push({
        id: `default-${type}`,
        organizationId,
        type: type as EmailTemplateType,
        subject: defaultTemplate.subject,
        htmlBody: defaultTemplate.htmlBody,
        textBody: defaultTemplate.textBody,
        variables: extractVariables(defaultTemplate.htmlBody),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  return allTemplates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract variable names from template string
 */
function extractVariables(template: string): string[] {
  const matches = template.match(/\{\{(\w+)\}\}/g) || [];
  const variables = new Set(matches.map((m: string) => m.replace(/\{\{|\}\}/g, '')));
  return Array.from(variables);
}

/**
 * Simple template interpolation
 */
function interpolate(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match: string, key: string) => {
    return context[key] !== undefined ? String(context[key]) : match;
  });
}
