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
