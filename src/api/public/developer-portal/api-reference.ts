/**
 * API Reference Generator
 * ========================
 *
 * Generates API reference documentation from route definitions.
 */

import { ApiEndpoint, ApiParameter, ApiSchema, ApiRequestBody } from './portal.types';

// ═══════════════════════════════════════════════════════════════════════════════
// API REFERENCE DATA
// ═══════════════════════════════════════════════════════════════════════════════

export const API_REFERENCE: Record<string, ApiEndpoint[]> = {
  customers: [
    {
      method: 'GET',
      path: '/v1/customers',
      summary: 'List customers',
      description: 'Retrieve a paginated list of customers for your organization.',
      operationId: 'listCustomers',
      tags: ['Customers'],
      parameters: [
        queryParam('cursor', 'string', 'Pagination cursor from previous response'),
        queryParam('limit', 'integer', 'Number of results to return (1-100)', false, 20),
        queryParam('search', 'string', 'Search by name, email, or phone'),
        queryParam('status', 'string', 'Filter by status (active, inactive)'),
        queryParam('sort_by', 'string', 'Sort field (created_at, name, email)'),
        queryParam('sort_order', 'string', 'Sort direction (asc, desc)'),
      ],
      responses: {
        '200': successResponse('Customer list', {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'array', items: { $ref: '#/components/schemas/Customer' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        }),
        '401': errorResponse('Unauthorized'),
        '403': errorResponse('Forbidden - insufficient scopes'),
      },
      security: [{ apiKey: ['read:customers'] }],
    },
    {
      method: 'GET',
      path: '/v1/customers/{id}',
      summary: 'Get customer',
      description: 'Retrieve a single customer by ID.',
      operationId: 'getCustomer',
      tags: ['Customers'],
      parameters: [pathParam('id', 'Customer ID')],
      responses: {
        '200': successResponse('Customer details', {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Customer' },
          },
        }),
        '404': errorResponse('Customer not found'),
      },
      security: [{ apiKey: ['read:customers'] }],
    },
    {
      method: 'POST',
      path: '/v1/customers',
      summary: 'Create customer',
      description: 'Create a new customer.',
      operationId: 'createCustomer',
      tags: ['Customers'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateCustomer' },
            example: {
              name: 'Juan García',
              email: 'juan@example.com',
              phone: '+54 11 1234-5678',
              address: {
                street: 'Av. Corrientes 1234',
                city: 'Buenos Aires',
                postal_code: 'C1043AAZ',
              },
            },
          },
        },
      },
      responses: {
        '201': successResponse('Customer created', { $ref: '#/components/schemas/Customer' }),
        '400': errorResponse('Invalid input'),
        '409': errorResponse('Customer already exists'),
      },
      security: [{ apiKey: ['write:customers'] }],
    },
    {
      method: 'PATCH',
      path: '/v1/customers/{id}',
      summary: 'Update customer',
      description: 'Update an existing customer.',
      operationId: 'updateCustomer',
      tags: ['Customers'],
      parameters: [pathParam('id', 'Customer ID')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateCustomer' },
          },
        },
      },
      responses: {
        '200': successResponse('Customer updated', { $ref: '#/components/schemas/Customer' }),
        '404': errorResponse('Customer not found'),
      },
      security: [{ apiKey: ['write:customers'] }],
    },
    {
      method: 'DELETE',
      path: '/v1/customers/{id}',
      summary: 'Delete customer',
      description: 'Delete a customer. This action cannot be undone.',
      operationId: 'deleteCustomer',
      tags: ['Customers'],
      parameters: [pathParam('id', 'Customer ID')],
      responses: {
        '200': successResponse('Customer deleted', {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                deleted: { type: 'boolean' },
              },
            },
          },
        }),
        '404': errorResponse('Customer not found'),
      },
      security: [{ apiKey: ['delete:customers'] }],
    },
  ],

  jobs: [
    {
      method: 'GET',
      path: '/v1/jobs',
      summary: 'List jobs',
      description: 'Retrieve a paginated list of jobs/work orders.',
      operationId: 'listJobs',
      tags: ['Jobs'],
      parameters: [
        queryParam('cursor', 'string', 'Pagination cursor'),
        queryParam('limit', 'integer', 'Number of results (1-100)', false, 20),
        queryParam('customer_id', 'string', 'Filter by customer'),
        queryParam('technician_id', 'string', 'Filter by assigned technician'),
        queryParam('status', 'string', 'Filter by status'),
        queryParam('priority', 'string', 'Filter by priority'),
        queryParam('scheduled_after', 'string', 'Jobs scheduled after this date'),
        queryParam('scheduled_before', 'string', 'Jobs scheduled before this date'),
        queryParam('include', 'array', 'Related data to include (customer, technician)'),
      ],
      responses: {
        '200': successResponse('Job list', {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        }),
      },
      security: [{ apiKey: ['read:jobs'] }],
    },
    {
      method: 'POST',
      path: '/v1/jobs',
      summary: 'Create job',
      description: 'Create a new job/work order.',
      operationId: 'createJob',
      tags: ['Jobs'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateJob' },
          },
        },
      },
      responses: {
        '201': successResponse('Job created', { $ref: '#/components/schemas/Job' }),
        '400': errorResponse('Invalid input'),
      },
      security: [{ apiKey: ['write:jobs'] }],
    },
    {
      method: 'POST',
      path: '/v1/jobs/{id}/assign',
      summary: 'Assign technician',
      description: 'Assign a technician to a job.',
      operationId: 'assignJob',
      tags: ['Jobs'],
      parameters: [pathParam('id', 'Job ID')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['technician_id'],
              properties: {
                technician_id: { type: 'string', format: 'uuid' },
                notify_technician: { type: 'boolean', default: true },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Job assigned', { $ref: '#/components/schemas/Job' }),
      },
      security: [{ apiKey: ['write:jobs'] }],
    },
    {
      method: 'POST',
      path: '/v1/jobs/{id}/start',
      summary: 'Start job',
      description: 'Mark a job as started/in progress.',
      operationId: 'startJob',
      tags: ['Jobs'],
      parameters: [pathParam('id', 'Job ID')],
      responses: {
        '200': successResponse('Job started', { $ref: '#/components/schemas/Job' }),
      },
      security: [{ apiKey: ['write:jobs'] }],
    },
    {
      method: 'POST',
      path: '/v1/jobs/{id}/complete',
      summary: 'Complete job',
      description: 'Mark a job as completed.',
      operationId: 'completeJob',
      tags: ['Jobs'],
      parameters: [pathParam('id', 'Job ID')],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                completion_notes: { type: 'string' },
                line_items: { type: 'array', items: { $ref: '#/components/schemas/LineItem' } },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Job completed', { $ref: '#/components/schemas/Job' }),
      },
      security: [{ apiKey: ['write:jobs'] }],
    },
  ],

  invoices: [
    {
      method: 'GET',
      path: '/v1/invoices',
      summary: 'List invoices',
      description: 'Retrieve a paginated list of invoices.',
      operationId: 'listInvoices',
      tags: ['Invoices'],
      parameters: [
        queryParam('cursor', 'string', 'Pagination cursor'),
        queryParam('limit', 'integer', 'Number of results', false, 20),
        queryParam('customer_id', 'string', 'Filter by customer'),
        queryParam('status', 'string', 'Filter by status'),
        queryParam('due_after', 'string', 'Invoices due after this date'),
        queryParam('due_before', 'string', 'Invoices due before this date'),
      ],
      responses: {
        '200': successResponse('Invoice list'),
      },
      security: [{ apiKey: ['read:invoices'] }],
    },
    {
      method: 'POST',
      path: '/v1/invoices',
      summary: 'Create invoice',
      description: 'Create a new invoice.',
      operationId: 'createInvoice',
      tags: ['Invoices'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateInvoice' },
          },
        },
      },
      responses: {
        '201': successResponse('Invoice created', { $ref: '#/components/schemas/Invoice' }),
      },
      security: [{ apiKey: ['write:invoices'] }],
    },
    {
      method: 'POST',
      path: '/v1/invoices/{id}/send',
      summary: 'Send invoice',
      description: 'Send an invoice to the customer via email.',
      operationId: 'sendInvoice',
      tags: ['Invoices'],
      parameters: [pathParam('id', 'Invoice ID')],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                email: { type: 'string', format: 'email' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Invoice sent'),
      },
      security: [{ apiKey: ['write:invoices'] }],
    },
    {
      method: 'POST',
      path: '/v1/invoices/{id}/payments',
      summary: 'Record payment',
      description: 'Record a payment against an invoice.',
      operationId: 'recordInvoicePayment',
      tags: ['Invoices', 'Payments'],
      parameters: [pathParam('id', 'Invoice ID')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RecordPayment' },
          },
        },
      },
      responses: {
        '200': successResponse('Payment recorded'),
      },
      security: [{ apiKey: ['write:invoices', 'write:payments'] }],
    },
  ],

  payments: [
    {
      method: 'GET',
      path: '/v1/payments',
      summary: 'List payments',
      description: 'Retrieve a paginated list of payments.',
      operationId: 'listPayments',
      tags: ['Payments'],
      parameters: [
        queryParam('cursor', 'string', 'Pagination cursor'),
        queryParam('limit', 'integer', 'Number of results', false, 20),
        queryParam('customer_id', 'string', 'Filter by customer'),
        queryParam('invoice_id', 'string', 'Filter by invoice'),
        queryParam('status', 'string', 'Filter by status'),
        queryParam('payment_method', 'string', 'Filter by payment method'),
      ],
      responses: {
        '200': successResponse('Payment list'),
      },
      security: [{ apiKey: ['read:payments'] }],
    },
    {
      method: 'POST',
      path: '/v1/payments',
      summary: 'Create payment',
      description: 'Record a new payment.',
      operationId: 'createPayment',
      tags: ['Payments'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreatePayment' },
          },
        },
      },
      responses: {
        '201': successResponse('Payment created'),
      },
      security: [{ apiKey: ['write:payments'] }],
    },
    {
      method: 'POST',
      path: '/v1/payments/{id}/refund',
      summary: 'Refund payment',
      description: 'Process a refund for a payment.',
      operationId: 'refundPayment',
      tags: ['Payments'],
      parameters: [pathParam('id', 'Payment ID')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['reason'],
              properties: {
                amount: { type: 'number', description: 'Refund amount (full refund if not specified)' },
                reason: { type: 'string' },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Refund processed'),
      },
      security: [{ apiKey: ['write:payments'] }],
    },
  ],

  webhooks: [
    {
      method: 'GET',
      path: '/v1/webhooks',
      summary: 'List webhooks',
      description: 'Retrieve all webhook subscriptions.',
      operationId: 'listWebhooks',
      tags: ['Webhooks'],
      responses: {
        '200': successResponse('Webhook list'),
      },
      security: [{ apiKey: ['read:webhooks'] }],
    },
    {
      method: 'POST',
      path: '/v1/webhooks',
      summary: 'Create webhook',
      description: 'Create a new webhook subscription.',
      operationId: 'createWebhook',
      tags: ['Webhooks'],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateWebhook' },
            example: {
              url: 'https://your-app.com/webhooks',
              events: ['job.completed', 'invoice.paid'],
              description: 'Production webhook',
            },
          },
        },
      },
      responses: {
        '201': successResponse('Webhook created (includes secret)'),
      },
      security: [{ apiKey: ['write:webhooks'] }],
    },
    {
      method: 'POST',
      path: '/v1/webhooks/{id}/test',
      summary: 'Test webhook',
      description: 'Send a test event to the webhook endpoint.',
      operationId: 'testWebhook',
      tags: ['Webhooks'],
      parameters: [pathParam('id', 'Webhook ID')],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['event_type'],
              properties: {
                event_type: { type: 'string', enum: ['customer.created', 'job.completed', 'invoice.paid'] },
              },
            },
          },
        },
      },
      responses: {
        '200': successResponse('Test delivery result'),
      },
      security: [{ apiKey: ['write:webhooks'] }],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function queryParam(
  name: string,
  type: string,
  description: string,
  required: boolean = false,
  defaultValue?: any
): ApiParameter {
  return {
    name,
    in: 'query',
    description,
    required,
    schema: { type, default: defaultValue },
  };
}

function pathParam(name: string, description: string): ApiParameter {
  return {
    name,
    in: 'path',
    description,
    required: true,
    schema: { type: 'string', format: 'uuid' },
  };
}

function successResponse(description: string, schema?: ApiSchema): any {
  return {
    description,
    content: schema
      ? { 'application/json': { schema } }
      : undefined,
  };
}

function errorResponse(description: string): any {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export function getAllEndpoints(): ApiEndpoint[] {
  return Object.values(API_REFERENCE).flat();
}

export function getEndpointsByTag(tag: string): ApiEndpoint[] {
  return getAllEndpoints().filter(e => e.tags.includes(tag));
}

export function getEndpointByOperationId(operationId: string): ApiEndpoint | undefined {
  return getAllEndpoints().find(e => e.operationId === operationId);
}

export function getTags(): string[] {
  const tags = new Set<string>();
  getAllEndpoints().forEach(e => e.tags.forEach(t => tags.add(t)));
  return Array.from(tags).sort();
}
