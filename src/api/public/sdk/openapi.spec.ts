/**
 * OpenAPI 3.0 Specification Generator
 * =====================================
 *
 * Generates OpenAPI 3.0 specification for the CampoTech Public API.
 */

import { API_REFERENCE } from '../developer-portal/api-reference';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OpenApiSpec {
  openapi: string;
  info: OpenApiInfo;
  servers: OpenApiServer[];
  security: OpenApiSecurityRequirement[];
  paths: Record<string, OpenApiPathItem>;
  components: OpenApiComponents;
  tags: OpenApiTag[];
  externalDocs?: OpenApiExternalDocs;
}

interface OpenApiInfo {
  title: string;
  description: string;
  version: string;
  termsOfService?: string;
  contact?: { name: string; url: string; email: string };
  license?: { name: string; url: string };
}

interface OpenApiServer {
  url: string;
  description: string;
  variables?: Record<string, { default: string; enum?: string[] }>;
}

interface OpenApiSecurityRequirement {
  [name: string]: string[];
}

interface OpenApiPathItem {
  [method: string]: OpenApiOperation;
}

interface OpenApiOperation {
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: OpenApiSecurityRequirement[];
  parameters?: any[];
  requestBody?: any;
  responses: Record<string, any>;
  deprecated?: boolean;
}

interface OpenApiComponents {
  schemas: Record<string, any>;
  securitySchemes: Record<string, any>;
  parameters?: Record<string, any>;
  responses?: Record<string, any>;
}

interface OpenApiTag {
  name: string;
  description: string;
  externalDocs?: { url: string; description: string };
}

interface OpenApiExternalDocs {
  description: string;
  url: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIFICATION GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

export function generateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'CampoTech API',
      description: `
The CampoTech API provides programmatic access to manage field service operations including customers, jobs, invoices, and payments.

## Authentication

All API requests require authentication using one of the following methods:

- **API Key**: Include your API key in the \`X-API-Key\` header
- **OAuth 2.0**: Use Bearer tokens obtained through the OAuth 2.0 flow

## Rate Limiting

API requests are rate limited based on your plan:
- Free: 1,000 requests/hour
- Pro: 10,000 requests/hour
- Enterprise: Custom limits

Rate limit headers are included in all responses.

## Pagination

List endpoints use cursor-based pagination. Use the \`cursor\` parameter with the value from \`pagination.next_cursor\` to fetch the next page.

## Webhooks

Configure webhooks to receive real-time notifications when events occur in your account.
      `.trim(),
      version: '1.0.0',
      termsOfService: 'https://campotech.com/terms',
      contact: {
        name: 'CampoTech Developer Support',
        url: 'https://developers.campotech.com',
        email: 'developers@campotech.com',
      },
      license: {
        name: 'Apache 2.0',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
      },
    },
    servers: [
      {
        url: 'https://api.campotech.com/v1',
        description: 'Production server',
      },
      {
        url: 'https://sandbox.api.campotech.com/v1',
        description: 'Sandbox server for testing',
      },
    ],
    security: [{ ApiKeyAuth: [] }],
    paths: generatePaths(),
    components: generateComponents(),
    tags: generateTags(),
    externalDocs: {
      description: 'API Documentation',
      url: 'https://developers.campotech.com/docs',
    },
  };
}

function generatePaths(): Record<string, OpenApiPathItem> {
  const paths: Record<string, OpenApiPathItem> = {};

  for (const [resource, endpoints] of Object.entries(API_REFERENCE)) {
    for (const endpoint of endpoints) {
      const path = endpoint.path;
      if (!paths[path]) {
        paths[path] = {};
      }

      paths[path][endpoint.method.toLowerCase()] = {
        operationId: endpoint.operationId,
        summary: endpoint.summary,
        description: endpoint.description,
        tags: endpoint.tags,
        security: endpoint.security?.map(s => {
          const result: Record<string, string[]> = {};
          if (s.apiKey) result.ApiKeyAuth = s.apiKey;
          if (s.oauth2) result.OAuth2 = s.oauth2;
          return result;
        }),
        parameters: endpoint.parameters,
        requestBody: endpoint.requestBody,
        responses: endpoint.responses,
        deprecated: endpoint.deprecated,
      };
    }
  }

  return paths;
}

function generateComponents(): OpenApiComponents {
  return {
    schemas: {
      // Common
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Invalid input data' },
              details: { type: 'object' },
            },
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          has_more: { type: 'boolean' },
          next_cursor: { type: 'string', nullable: true },
          limit: { type: 'integer' },
        },
      },
      Address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          state: { type: 'string' },
          postal_code: { type: 'string' },
          country: { type: 'string', default: 'Argentina' },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
        },
      },

      // Customer
      Customer: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          org_id: { type: 'string', format: 'uuid' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
          status: { type: 'string', enum: ['active', 'inactive'] },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateCustomer: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      },
      UpdateCustomer: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          address: { $ref: '#/components/schemas/Address' },
          status: { type: 'string', enum: ['active', 'inactive'] },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' },
        },
      },

      // Job
      Job: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          org_id: { type: 'string', format: 'uuid' },
          customer_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          service_type: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'scheduled', 'assigned', 'en_route', 'in_progress', 'paused', 'completed', 'cancelled'],
          },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          scheduled_start: { type: 'string', format: 'date-time' },
          scheduled_end: { type: 'string', format: 'date-time' },
          address: { $ref: '#/components/schemas/Address' },
          assigned_technician_id: { type: 'string', format: 'uuid' },
          line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
          total: { type: 'number' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateJob: {
        type: 'object',
        required: ['customer_id', 'title', 'service_type'],
        properties: {
          customer_id: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          service_type: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          scheduled_start: { type: 'string', format: 'date-time' },
          scheduled_end: { type: 'string', format: 'date-time' },
          address: { $ref: '#/components/schemas/Address' },
          assigned_technician_id: { type: 'string', format: 'uuid' },
          line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
        },
      },
      LineItem: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          quantity: { type: 'number' },
          unit_price: { type: 'number' },
          tax_rate: { type: 'number' },
          discount: { type: 'number' },
        },
      },

      // Invoice
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          org_id: { type: 'string', format: 'uuid' },
          customer_id: { type: 'string', format: 'uuid' },
          invoice_number: { type: 'string' },
          status: {
            type: 'string',
            enum: ['draft', 'pending', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'cancelled', 'refunded'],
          },
          line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
          subtotal: { type: 'number' },
          tax_total: { type: 'number' },
          total: { type: 'number' },
          amount_paid: { type: 'number' },
          amount_due: { type: 'number' },
          due_date: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
          updated_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateInvoice: {
        type: 'object',
        required: ['customer_id', 'line_items'],
        properties: {
          customer_id: { type: 'string', format: 'uuid' },
          job_id: { type: 'string', format: 'uuid' },
          line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
          payment_terms: { type: 'string', enum: ['due_on_receipt', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60'] },
          due_date: { type: 'string', format: 'date-time' },
          notes: { type: 'string' },
        },
      },

      // Payment
      Payment: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          org_id: { type: 'string', format: 'uuid' },
          customer_id: { type: 'string', format: 'uuid' },
          invoice_id: { type: 'string', format: 'uuid' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'] },
          payment_method: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'check', 'mercadopago', 'other'] },
          payment_date: { type: 'string', format: 'date-time' },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreatePayment: {
        type: 'object',
        required: ['customer_id', 'amount', 'payment_method'],
        properties: {
          customer_id: { type: 'string', format: 'uuid' },
          invoice_id: { type: 'string', format: 'uuid' },
          amount: { type: 'number' },
          payment_method: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'check', 'mercadopago', 'other'] },
          reference: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      RecordPayment: {
        type: 'object',
        required: ['amount', 'payment_method'],
        properties: {
          amount: { type: 'number' },
          payment_method: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'check', 'mercadopago', 'other'] },
          payment_date: { type: 'string', format: 'date-time' },
          reference: { type: 'string' },
          notes: { type: 'string' },
        },
      },

      // Webhook
      Webhook: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          url: { type: 'string', format: 'uri' },
          events: { type: 'array', items: { type: 'string' } },
          enabled: { type: 'boolean' },
          last_delivery_at: { type: 'string', format: 'date-time' },
          last_delivery_status: { type: 'string', enum: ['delivered', 'failed'] },
          created_at: { type: 'string', format: 'date-time' },
        },
      },
      CreateWebhook: {
        type: 'object',
        required: ['url', 'events'],
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'customer.created', 'customer.updated', 'customer.deleted',
                'job.created', 'job.updated', 'job.scheduled', 'job.assigned',
                'job.started', 'job.completed', 'job.cancelled',
                'invoice.created', 'invoice.sent', 'invoice.paid', 'invoice.overdue',
                'payment.created', 'payment.completed', 'payment.refunded',
              ],
            },
          },
          description: { type: 'string' },
        },
      },
    },
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
      OAuth2: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://api.campotech.com/oauth/authorize',
            tokenUrl: 'https://api.campotech.com/oauth/token',
            scopes: {
              'read:customers': 'Read customer data',
              'write:customers': 'Create and update customers',
              'delete:customers': 'Delete customers',
              'read:jobs': 'Read job data',
              'write:jobs': 'Create and update jobs',
              'delete:jobs': 'Delete jobs',
              'read:invoices': 'Read invoice data',
              'write:invoices': 'Create and update invoices',
              'read:payments': 'Read payment data',
              'write:payments': 'Create and update payments',
              'read:webhooks': 'Read webhook configurations',
              'write:webhooks': 'Create and update webhooks',
              'offline_access': 'Obtain refresh tokens',
            },
          },
          clientCredentials: {
            tokenUrl: 'https://api.campotech.com/oauth/token',
            scopes: {
              'read:customers': 'Read customer data',
              'read:jobs': 'Read job data',
              'read:invoices': 'Read invoice data',
              'read:payments': 'Read payment data',
            },
          },
        },
      },
    },
  };
}

function generateTags(): OpenApiTag[] {
  return [
    {
      name: 'Customers',
      description: 'Manage customer records',
      externalDocs: { url: 'https://developers.campotech.com/docs/customers', description: 'Customer documentation' },
    },
    {
      name: 'Jobs',
      description: 'Manage jobs and work orders',
      externalDocs: { url: 'https://developers.campotech.com/docs/jobs', description: 'Jobs documentation' },
    },
    {
      name: 'Invoices',
      description: 'Manage invoices and billing',
      externalDocs: { url: 'https://developers.campotech.com/docs/invoices', description: 'Invoices documentation' },
    },
    {
      name: 'Payments',
      description: 'Process and track payments',
      externalDocs: { url: 'https://developers.campotech.com/docs/payments', description: 'Payments documentation' },
    },
    {
      name: 'Webhooks',
      description: 'Configure webhook subscriptions',
      externalDocs: { url: 'https://developers.campotech.com/docs/webhooks', description: 'Webhooks documentation' },
    },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getOpenApiJson(): string {
  return JSON.stringify(generateOpenApiSpec(), null, 2);
}

export function getOpenApiYaml(): string {
  // Simple YAML conversion (for production, use a proper YAML library)
  const spec = generateOpenApiSpec();
  return jsonToYaml(spec);
}

function jsonToYaml(obj: any, indent: number = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          yaml += `${spaces}- ${jsonToYaml(item, indent + 1).trimStart()}`;
        } else {
          yaml += `${spaces}- ${item}\n`;
        }
      }
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 1)}`;
    } else if (typeof value === 'string' && value.includes('\n')) {
      yaml += `${spaces}${key}: |\n`;
      for (const line of value.split('\n')) {
        yaml += `${spaces}  ${line}\n`;
      }
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}
