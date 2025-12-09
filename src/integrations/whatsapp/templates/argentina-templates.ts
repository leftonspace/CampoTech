/**
 * Argentine WhatsApp Templates
 * ============================
 *
 * Phase 9.7: Argentine Communication Localization
 * WhatsApp templates optimized for Argentine Spanish and culture.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  components: TemplateComponent[];
}

interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  buttons?: TemplateButton[];
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
}

interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const EMPLOYEE_WELCOME: WhatsAppTemplate = {
  name: 'employee_welcome',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '👋 ¡Bienvenido al equipo!',
    },
    {
      type: 'BODY',
      text: '¡Hola {{1}}!\n\nFuiste agregado al equipo de {{2}} como {{3}}.\n\n📱 Descargá la app CampoTech para:\n• Ver tus trabajos asignados\n• Navegar a las direcciones\n• Registrar fotos y firmas\n\n🔐 Tu código de verificación: {{4}}\n\n¿Tenés alguna duda?',
      example: {
        body_text: [['Juan', 'ServiFrío', 'Técnico', '123456']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: 'Descargar app', url: 'https://campotech.com.ar/app' },
        { type: 'QUICK_REPLY', text: 'Tengo dudas' },
      ],
    },
  ],
};

export const EMPLOYEE_VERIFICATION: WhatsAppTemplate = {
  name: 'employee_verification',
  language: 'es_AR',
  category: 'AUTHENTICATION',
  components: [
    {
      type: 'BODY',
      text: '🔐 Tu código de verificación de CampoTech es: {{1}}\n\nExpira en {{2}} minutos.\n\nSi no solicitaste este código, ignorá este mensaje.',
      example: {
        body_text: [['123456', '15']],
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// JOB TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const JOB_ASSIGNED_TECH: WhatsAppTemplate = {
  name: 'job_assigned_tech',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '🔧 Nuevo trabajo asignado',
    },
    {
      type: 'BODY',
      text: '📍 {{1}}\n📅 {{2}} a las {{3}} hs\n👤 Cliente: {{4}}\n📞 {{5}}\n\nServicio: {{6}}\n\n¿Podés confirmar?',
      example: {
        body_text: [
          ['Av. Corrientes 1234, CABA', 'Lunes 9/12', '10:00', 'María López', '+54 11 5678-1234', 'Instalación split 3000 frigorías'],
        ],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Confirmar' },
        { type: 'QUICK_REPLY', text: 'No puedo' },
      ],
    },
  ],
};

export const JOB_REMINDER_TECH_24H: WhatsAppTemplate = {
  name: 'job_reminder_tech_24h',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '📅 Recordatorio: Trabajo mañana',
    },
    {
      type: 'BODY',
      text: 'Hola {{1}}, te recordamos que mañana tenés un trabajo:\n\n📍 {{2}}\n⏰ {{3}} hs\n👤 {{4}}\n\nServicio: {{5}}',
      example: {
        body_text: [['Carlos', 'Av. Santa Fe 2000', '10:00', 'Juan Pérez', 'Reparación aire acondicionado']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'OK' },
        { type: 'QUICK_REPLY', text: 'Ver detalles' },
      ],
    },
  ],
};

export const JOB_REMINDER_TECH_1H: WhatsAppTemplate = {
  name: 'job_reminder_tech_1h',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '⏰ Recordatorio: Trabajo en 1 hora\n\n📍 {{1}}\n👤 {{2}}\n\n¿Ya estás en camino?',
      example: {
        body_text: [['Av. Libertador 5000, Belgrano', 'Ana García']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'En camino' },
        { type: 'QUICK_REPLY', text: 'Ver detalles' },
      ],
    },
  ],
};

export const JOB_REMINDER_TECH_30M: WhatsAppTemplate = {
  name: 'job_reminder_tech_30m',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '🚨 ¡Ojo! Trabajo en 30 minutos\n\n📍 {{1}}\n👤 {{2}}\n📞 {{3}}',
      example: {
        body_text: [['Calle Florida 100', 'Pedro Martínez', '+54 11 1234-5678']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'Ya voy' },
        { type: 'URL', text: 'Navegar', url: 'https://maps.google.com/?q={{1}}' },
      ],
    },
  ],
};

export const SCHEDULE_CHANGE: WhatsAppTemplate = {
  name: 'schedule_change',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '📅 Cambio de horario',
    },
    {
      type: 'BODY',
      text: '{{1}}, tu trabajo en {{2}} se reprogramó:\n\n❌ Antes: {{3}}\n✅ Ahora: {{4}}\n\n¿Te queda bien?',
      example: {
        body_text: [['Carlos', 'Av. Cabildo 1500', 'Lunes 10:00', 'Martes 14:00']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'OK' },
        { type: 'QUICK_REPLY', text: 'No me sirve' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRACKING TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const TECHNICIAN_EN_ROUTE_TRACKING: WhatsAppTemplate = {
  name: 'technician_en_route_tracking',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '🔧 Tu técnico está en camino',
    },
    {
      type: 'BODY',
      text: '{{1}} salió hacia tu ubicación.\n\nLlegada estimada: ~{{2}} minutos\n\nPodés seguir su ubicación en tiempo real:',
      example: {
        body_text: [['Carlos R.', '15']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        {
          type: 'URL',
          text: '📍 Ver ubicación en vivo',
          url: 'https://campotech.com.ar/track/{{1}}',
          example: ['xK9mNp2qR5tY8wZ1'],
        },
      ],
    },
  ],
};

export const TECHNICIAN_ARRIVED: WhatsAppTemplate = {
  name: 'technician_arrived',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '✅ {{1}} llegó a tu ubicación.\n\nSi no lo ves, llamalo:',
      example: {
        body_text: [['Carlos R.']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'PHONE_NUMBER', text: '📞 Llamar', phone_number: '+5491112345678' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const JOB_CONFIRMATION_CUSTOMER: WhatsAppTemplate = {
  name: 'job_confirmation_customer',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '✅ Turno confirmado',
    },
    {
      type: 'BODY',
      text: 'Hola {{1}}, tu turno quedó confirmado:\n\n📅 {{2}} a las {{3}} hs\n🔧 {{4}}\n\nTe avisamos cuando el técnico esté en camino.\n\n¿Necesitás reprogramar?',
      example: {
        body_text: [['María', 'Lunes 9/12', '10:00', 'Instalación de aire acondicionado']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'QUICK_REPLY', text: 'OK' },
        { type: 'QUICK_REPLY', text: 'Reprogramar' },
      ],
    },
  ],
};

export const JOB_COMPLETED_ADMIN: WhatsAppTemplate = {
  name: 'job_completed_admin',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '✅ Trabajo completado\n\n👤 Cliente: {{1}}\n🔧 Servicio: {{2}}\n👷 Técnico: {{3}}\n\nDuración: {{4}} minutos',
      example: {
        body_text: [['Juan Pérez', 'Instalación split', 'Carlos R.', '45']],
      },
    },
  ],
};

export const INVOICE_READY: WhatsAppTemplate = {
  name: 'invoice_ready',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: '🧾 Tu factura está lista',
    },
    {
      type: 'BODY',
      text: 'Hola {{1}}, tu factura por el servicio de {{2}} está lista.\n\nTotal: ${{3}}\nNúmero: {{4}}\n\nPodés pagarla con MercadoPago:',
      example: {
        body_text: [['María', 'instalación aire acondicionado', '85.000', 'A-0001-00001234']],
      },
    },
    {
      type: 'BUTTONS',
      buttons: [
        { type: 'URL', text: '💳 Pagar ahora', url: 'https://campotech.com.ar/pay/{{1}}' },
        { type: 'URL', text: '📄 Ver factura', url: 'https://campotech.com.ar/invoice/{{2}}' },
      ],
    },
  ],
};

export const PAYMENT_CONFIRMED: WhatsAppTemplate = {
  name: 'payment_confirmed',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '✅ ¡Pago recibido!\n\nGracias {{1}}, recibimos tu pago de ${{2}}.\n\nComprobante: {{3}}\n\n¡Gracias por confiar en nosotros!',
      example: {
        body_text: [['María', '85.000', 'MP-123456789']],
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-RESPONDER TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

export const AFTER_HOURS_AUTO_RESPONSE: WhatsAppTemplate = {
  name: 'after_hours_auto_response',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: 'Hola! 👋 Recibimos tu mensaje.\n\nNuestro horario de atención es de {{1}} a {{2}} hs.\n\nTe respondemos a la brevedad. Si es urgente, llamanos al {{3}}.',
      example: {
        body_text: [['9:00', '18:00', '+54 11 1234-5678']],
      },
    },
  ],
};

export const MESSAGE_RECEIVED_CONFIRMATION: WhatsAppTemplate = {
  name: 'message_received_confirmation',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '✅ Recibimos tu mensaje.\n\nUn representante te va a responder en breve. Tiempo estimado: ~{{1}} minutos.',
      example: {
        body_text: [['10']],
      },
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// VOICE MESSAGE TEMPLATE
// ═══════════════════════════════════════════════════════════════════════════════

export const AUDIO_RECEIVED_CONFIRMATION: WhatsAppTemplate = {
  name: 'audio_received_confirmation',
  language: 'es_AR',
  category: 'UTILITY',
  components: [
    {
      type: 'BODY',
      text: '🎤 Recibimos tu audio.\n\nLo estamos procesando y te confirmamos tu pedido en breve.',
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export const ARGENTINA_TEMPLATES: Record<string, WhatsAppTemplate> = {
  employee_welcome: EMPLOYEE_WELCOME,
  employee_verification: EMPLOYEE_VERIFICATION,
  job_assigned_tech: JOB_ASSIGNED_TECH,
  job_reminder_tech_24h: JOB_REMINDER_TECH_24H,
  job_reminder_tech_1h: JOB_REMINDER_TECH_1H,
  job_reminder_tech_30m: JOB_REMINDER_TECH_30M,
  schedule_change: SCHEDULE_CHANGE,
  technician_en_route_tracking: TECHNICIAN_EN_ROUTE_TRACKING,
  technician_arrived: TECHNICIAN_ARRIVED,
  job_confirmation_customer: JOB_CONFIRMATION_CUSTOMER,
  job_completed_admin: JOB_COMPLETED_ADMIN,
  invoice_ready: INVOICE_READY,
  payment_confirmed: PAYMENT_CONFIRMED,
  after_hours_auto_response: AFTER_HOURS_AUTO_RESPONSE,
  message_received_confirmation: MESSAGE_RECEIVED_CONFIRMATION,
  audio_received_confirmation: AUDIO_RECEIVED_CONFIRMATION,
};

/**
 * Get all Argentine templates for registration with Meta
 */
export function getArgentineTemplates(): WhatsAppTemplate[] {
  return Object.values(ARGENTINA_TEMPLATES);
}

/**
 * Get template by name
 */
export function getArgentineTemplate(name: string): WhatsAppTemplate | undefined {
  return ARGENTINA_TEMPLATES[name];
}
