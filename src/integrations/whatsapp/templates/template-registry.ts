/**
 * WhatsApp Template Registry
 * ==========================
 *
 * Manages WhatsApp message templates, their status, and variable mappings.
 * Templates must be pre-approved by Meta before use.
 */

import * as https from 'https';
import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';
import { WhatsAppConfig, WA_API_VERSION } from '../whatsapp.types';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateDefinition {
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED';
  components: TemplateComponent[];
  variableMapping: Record<string, string>;
}

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
    text: string;
    url?: string;
    phoneNumber?: string;
  }>;
}

export interface RegisteredTemplate {
  id: string;
  organizationId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  metaTemplateId?: string;
  components: TemplateComponent[];
  variableMapping: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULT TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Default templates for CampoTech
 * These need to be submitted to Meta for approval
 */
export const DEFAULT_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'job_scheduled',
    language: 'es_AR',
    category: 'UTILITY',
    status: 'PENDING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '📅 Visita Programada',
      },
      {
        type: 'BODY',
        text: 'Hola {{1}}, tu visita de {{2}} está programada para el {{3}} a las {{4}} hs.\n\n📍 Dirección: {{5}}\n\n¿Tenés alguna consulta?',
        example: {
          body_text: [
            ['Juan', 'fumigación', '15/01/2025', '10:00', 'Av. Libertador 1234'],
          ],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Confirmar' },
          { type: 'QUICK_REPLY', text: 'Reprogramar' },
        ],
      },
    ],
    variableMapping: {
      '1': 'customer.firstName',
      '2': 'job.serviceType',
      '3': 'job.scheduledDate',
      '4': 'job.scheduledTime',
      '5': 'job.address',
    },
  },
  {
    name: 'invoice_ready',
    language: 'es_AR',
    category: 'UTILITY',
    status: 'PENDING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '🧾 Nueva Factura',
      },
      {
        type: 'BODY',
        text: 'Hola {{1}}, tu factura {{2}} por ${{3}} ya está disponible.\n\nVencimiento: {{4}}\n\n💳 Pagá fácil con MercadoPago usando el botón de abajo.',
        example: {
          body_text: [['Juan', 'A-0001-00000123', '15.500', '20/01/2025']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Pagar ahora', url: 'https://campo.tech/pay/{{1}}' },
          { type: 'QUICK_REPLY', text: 'Ver detalle' },
        ],
      },
    ],
    variableMapping: {
      '1': 'customer.firstName',
      '2': 'invoice.number',
      '3': 'invoice.total',
      '4': 'invoice.dueDate',
    },
  },
  {
    name: 'payment_confirmed',
    language: 'es_AR',
    category: 'UTILITY',
    status: 'PENDING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '✅ Pago Recibido',
      },
      {
        type: 'BODY',
        text: 'Hola {{1}}, recibimos tu pago de ${{2}} correspondiente a la factura {{3}}.\n\n¡Gracias por tu confianza!',
        example: {
          body_text: [['Juan', '15.500', 'A-0001-00000123']],
        },
      },
    ],
    variableMapping: {
      '1': 'customer.firstName',
      '2': 'payment.amount',
      '3': 'invoice.number',
    },
  },
  {
    name: 'payment_reminder',
    language: 'es_AR',
    category: 'UTILITY',
    status: 'PENDING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '⏰ Recordatorio de Pago',
      },
      {
        type: 'BODY',
        text: 'Hola {{1}}, te recordamos que tu factura {{2}} por ${{3}} vence el {{4}}.\n\n💳 Pagá fácil con MercadoPago.',
        example: {
          body_text: [['Juan', 'A-0001-00000123', '15.500', '20/01/2025']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'URL', text: 'Pagar ahora', url: 'https://campo.tech/pay/{{1}}' },
        ],
      },
    ],
    variableMapping: {
      '1': 'customer.firstName',
      '2': 'invoice.number',
      '3': 'invoice.total',
      '4': 'invoice.dueDate',
    },
  },
  {
    name: 'welcome_customer',
    language: 'es_AR',
    category: 'MARKETING',
    status: 'PENDING',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: '👋 ¡Bienvenido!',
      },
      {
        type: 'BODY',
        text: 'Hola {{1}}, gracias por elegir {{2}}.\n\nPor este canal podrás:\n• Recibir notificaciones de visitas\n• Ver y pagar tus facturas\n• Contactarnos ante cualquier consulta\n\n¿En qué podemos ayudarte?',
        example: {
          body_text: [['Juan', 'CampoTech']],
        },
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Solicitar servicio' },
          { type: 'QUICK_REPLY', text: 'Consultar factura' },
        ],
      },
    ],
    variableMapping: {
      '1': 'customer.firstName',
      '2': 'organization.name',
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize default templates for an organization
 */
export async function initializeDefaultTemplates(
  organizationId: string
): Promise<RegisteredTemplate[]> {
  const templates: RegisteredTemplate[] = [];

  for (const template of DEFAULT_TEMPLATES) {
    const existing = await db.waTemplate.findFirst({
      where: {
        organizationId,
        name: template.name,
        language: template.language,
      },
    });

    if (!existing) {
      const created = await db.waTemplate.create({
        data: {
          organizationId,
          name: template.name,
          language: template.language,
          category: template.category,
          status: 'PENDING',
          components: template.components as object,
          variableMapping: template.variableMapping,
        },
      });

      templates.push({
        id: created.id,
        organizationId: created.organizationId,
        name: created.name,
        language: created.language,
        category: created.category,
        status: created.status,
        metaTemplateId: created.metaTemplateId || undefined,
        components: created.components as TemplateComponent[],
        variableMapping: created.variableMapping as Record<string, string>,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      });
    }
  }

  log.info('Initialized default templates', {
    organizationId,
    count: templates.length,
  });

  return templates;
}

/**
 * Get template by name for an organization
 */
export async function getTemplate(
  organizationId: string,
  templateName: string,
  language: string = 'es_AR'
): Promise<RegisteredTemplate | null> {
  const template = await db.waTemplate.findFirst({
    where: {
      organizationId,
      name: templateName,
      language,
    },
  });

  if (!template) return null;

  return {
    id: template.id,
    organizationId: template.organizationId,
    name: template.name,
    language: template.language,
    category: template.category,
    status: template.status,
    metaTemplateId: template.metaTemplateId || undefined,
    components: template.components as TemplateComponent[],
    variableMapping: template.variableMapping as Record<string, string>,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

/**
 * Get all templates for an organization
 */
export async function getOrganizationTemplates(
  organizationId: string
): Promise<RegisteredTemplate[]> {
  const templates = await db.waTemplate.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  });

  return templates.map((t: typeof templates[number]) => ({
    id: t.id,
    organizationId: t.organizationId,
    name: t.name,
    language: t.language,
    category: t.category,
    status: t.status,
    metaTemplateId: t.metaTemplateId || undefined,
    components: t.components as TemplateComponent[],
    variableMapping: t.variableMapping as Record<string, string>,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));
}

/**
 * Sync templates with Meta API
 * Fetches current template statuses from WhatsApp Business API
 */
export async function syncTemplatesFromMeta(
  config: WhatsAppConfig,
  organizationId: string
): Promise<void> {
  try {
    const templates = await fetchMetaTemplates(config);

    for (const metaTemplate of templates) {
      await db.waTemplate.updateMany({
        where: {
          organizationId,
          name: metaTemplate.name,
          language: metaTemplate.language,
        },
        data: {
          status: metaTemplate.status,
          metaTemplateId: metaTemplate.id,
          updatedAt: new Date(),
        },
      });
    }

    log.info('Synced templates from Meta', {
      organizationId,
      count: templates.length,
    });
  } catch (error) {
    log.error('Failed to sync templates from Meta', {
      organizationId,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    throw error;
  }
}

/**
 * Submit a template to Meta for approval
 */
export async function submitTemplateToMeta(
  config: WhatsAppConfig,
  template: TemplateDefinition
): Promise<{ success: boolean; templateId?: string; error?: string }> {
  try {
    const apiVersion = config.apiVersion || WA_API_VERSION;

    const payload = {
      name: template.name,
      language: template.language,
      category: template.category,
      components: template.components.map((c: typeof template.components[number]) => ({
        type: c.type,
        format: c.format,
        text: c.text,
        example: c.example,
        buttons: c.buttons?.map((b: typeof c.buttons[number]) => ({
          type: b.type,
          text: b.text,
          url: b.url,
          phone_number: b.phoneNumber,
        })),
      })),
    };

    return new Promise((resolve) => {
      const bodyString = JSON.stringify(payload);

      const options: https.RequestOptions = {
        hostname: 'graph.facebook.com',
        port: 443,
        path: `/${apiVersion}/${config.businessAccountId}/message_templates`,
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString).toString(),
        },
        timeout: 30000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode && res.statusCode >= 400) {
              resolve({
                success: false,
                error: parsed.error?.message || 'Failed to submit template',
              });
              return;
            }
            resolve({
              success: true,
              templateId: parsed.id,
            });
          } catch {
            resolve({ success: false, error: 'Failed to parse response' });
          }
        });
      });

      req.on('error', (err) =>
        resolve({ success: false, error: err.message })
      );
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });

      req.write(bodyString);
      req.end();
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
}

async function fetchMetaTemplates(config: WhatsAppConfig): Promise<MetaTemplate[]> {
  return new Promise((resolve, reject) => {
    const apiVersion = config.apiVersion || WA_API_VERSION;

    const options: https.RequestOptions = {
      hostname: 'graph.facebook.com',
      port: 443,
      path: `/${apiVersion}/${config.businessAccountId}/message_templates`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
      },
      timeout: 30000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(parsed.error?.message || 'Failed to fetch templates'));
            return;
          }
          resolve(parsed.data || []);
        } catch {
          reject(new Error('Failed to parse response'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Resolve template variables from context data
 */
export function resolveTemplateVariables(
  variableMapping: Record<string, string>,
  context: Record<string, unknown>
): Record<string, string> {
  const resolved: Record<string, string> = {};

  for (const [key, path] of Object.entries(variableMapping)) {
    const value = getNestedValue(context, path);
    resolved[key] = value !== undefined ? String(value) : '';
  }

  return resolved;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}
