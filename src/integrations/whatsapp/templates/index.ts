/**
 * WhatsApp Templates Module
 * =========================
 */

export {
  DEFAULT_TEMPLATES,
  initializeDefaultTemplates,
  getTemplate,
  getOrganizationTemplates,
  syncTemplatesFromMeta,
  submitTemplateToMeta,
  resolveTemplateVariables,
} from './template-registry';
export type {
  TemplateDefinition,
  TemplateComponent,
  RegisteredTemplate,
} from './template-registry';

// Argentine templates (Phase 9.7)
export {
  ARGENTINA_TEMPLATES,
  getArgentineTemplates,
  getArgentineTemplate,
  // Employee templates
  EMPLOYEE_WELCOME,
  EMPLOYEE_VERIFICATION,
  // Job templates
  JOB_ASSIGNED_TECH,
  JOB_REMINDER_TECH_24H,
  JOB_REMINDER_TECH_1H,
  JOB_REMINDER_TECH_30M,
  SCHEDULE_CHANGE,
  // Tracking templates
  TECHNICIAN_EN_ROUTE_TRACKING,
  TECHNICIAN_ARRIVED,
  // Customer templates
  JOB_CONFIRMATION_CUSTOMER,
  JOB_COMPLETED_ADMIN,
  INVOICE_READY,
  PAYMENT_CONFIRMED,
  // Auto-responder templates
  AFTER_HOURS_AUTO_RESPONSE,
  MESSAGE_RECEIVED_CONFIRMATION,
  AUDIO_RECEIVED_CONFIRMATION,
} from './argentina-templates';
export type { WhatsAppTemplate } from './argentina-templates';
