/**
 * WhatsApp Integration Module
 * ===========================
 *
 * Complete WhatsApp Business API integration for CampoTech.
 * Handles inbound/outbound messaging, templates, media, and webhooks.
 */

// Types
export * from './whatsapp.types';

// Webhook handling
export * from './webhook';

// Messaging
export * from './messages';

// Customer matching
export * from './customer';

// Templates - export specific items to avoid duplicates with whatsapp.types
export {
  DEFAULT_TEMPLATES,
  initializeDefaultTemplates,
  getTemplate,
  getOrganizationTemplates,
  syncTemplatesFromMeta,
  submitTemplateToMeta,
  resolveTemplateVariables,
  ARGENTINA_TEMPLATES,
  getArgentineTemplates,
  getArgentineTemplate,
  EMPLOYEE_WELCOME,
  EMPLOYEE_VERIFICATION,
  JOB_ASSIGNED_TECH,
  JOB_REMINDER_TECH_24H,
  JOB_REMINDER_TECH_1H,
  JOB_REMINDER_TECH_30M,
  SCHEDULE_CHANGE,
  TECHNICIAN_EN_ROUTE_TRACKING,
  TECHNICIAN_ARRIVED,
  JOB_CONFIRMATION_CUSTOMER,
  JOB_COMPLETED_ADMIN,
  INVOICE_READY,
  PAYMENT_CONFIRMED,
  AFTER_HOURS_AUTO_RESPONSE,
  MESSAGE_RECEIVED_CONFIRMATION,
  AUDIO_RECEIVED_CONFIRMATION,
} from './templates';
export type { RegisteredTemplate, WhatsAppTemplate } from './templates';
