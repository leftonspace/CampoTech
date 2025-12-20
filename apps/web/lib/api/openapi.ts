/**
 * CampoTech OpenAPI Specification (Phase 6.3)
 * ============================================
 *
 * OpenAPI 3.0 specification for the CampoTech API.
 * Provides documentation for all API endpoints.
 */

import { API_VERSION, SUPPORTED_VERSIONS } from './versioning';

export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    contact?: { name?: string; email?: string; url?: string };
    license?: { name: string; url?: string };
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    securitySchemes?: Record<string, unknown>;
    schemas?: Record<string, unknown>;
  };
  security?: Array<Record<string, string[]>>;
  tags?: Array<{ name: string; description: string }>;
}

/**
 * Generate OpenAPI specification
 */
export function generateOpenAPISpec(baseUrl: string = ''): OpenAPISpec {
  return {
    openapi: '3.0.3',
    info: {
      title: 'CampoTech API',
      version: API_VERSION,
      description: `
CampoTech REST API para gestión de servicios de campo.

## Versioning

API version: **${API_VERSION}**
Supported versions: ${SUPPORTED_VERSIONS.join(', ')}

All responses include the \`X-API-Version\` header.

## Authentication

Most endpoints require authentication via JWT token.
Include the token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Or use cookie-based authentication after login.

## Rate Limits

- **FREE**: 30 requests/min
- **BASICO**: 100 requests/min
- **PROFESIONAL**: 500 requests/min
- **EMPRESARIAL**: 2000 requests/min

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Remaining requests in current window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets
      `.trim(),
      contact: {
        name: 'CampoTech Support',
        email: 'soporte@campotech.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: `${baseUrl}/api/v1`,
        description: 'API v1 (Current)',
      },
      {
        url: `${baseUrl}/api`,
        description: 'API (Unversioned - for backwards compatibility)',
      },
    ],
    tags: [
      { name: 'Jobs', description: 'Gestión de trabajos y órdenes de servicio' },
      { name: 'Customers', description: 'Gestión de clientes' },
      { name: 'Employees', description: 'Gestión de empleados (técnicos, despachadores)' },
      { name: 'Invoices', description: 'Facturación y comprobantes AFIP' },
      { name: 'Inventory', description: 'Control de inventario y stock' },
      { name: 'Vehicles', description: 'Gestión de flota de vehículos' },
      { name: 'WhatsApp', description: 'Integración con WhatsApp Business' },
      { name: 'Analytics', description: 'Reportes y análisis' },
      { name: 'Notifications', description: 'Notificaciones push e in-app' },
      { name: 'Auth', description: 'Autenticación y autorización' },
    ],
    paths: {
      '/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'Listar trabajos',
          description: 'Obtiene la lista de trabajos paginada',
          operationId: 'listJobs',
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string' }, description: 'Filtrar por estado' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 }, description: 'Cantidad por página' },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Número de página' },
          ],
          responses: {
            200: { description: 'Lista de trabajos', content: { 'application/json': { schema: { $ref: '#/components/schemas/JobList' } } } },
            401: { description: 'No autorizado' },
          },
        },
        post: {
          tags: ['Jobs'],
          summary: 'Crear trabajo',
          description: 'Crea un nuevo trabajo',
          operationId: 'createJob',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/JobCreate' } } } },
          responses: {
            201: { description: 'Trabajo creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Job' } } } },
            400: { description: 'Datos inválidos' },
            401: { description: 'No autorizado' },
          },
        },
      },
      '/jobs/{id}': {
        get: {
          tags: ['Jobs'],
          summary: 'Obtener trabajo',
          operationId: 'getJob',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Detalles del trabajo' },
            404: { description: 'Trabajo no encontrado' },
          },
        },
        put: {
          tags: ['Jobs'],
          summary: 'Actualizar trabajo',
          operationId: 'updateJob',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Trabajo actualizado' },
            404: { description: 'Trabajo no encontrado' },
          },
        },
        delete: {
          tags: ['Jobs'],
          summary: 'Eliminar trabajo',
          operationId: 'deleteJob',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Trabajo eliminado' },
            404: { description: 'Trabajo no encontrado' },
          },
        },
      },
      '/customers': {
        get: {
          tags: ['Customers'],
          summary: 'Listar clientes',
          operationId: 'listCustomers',
          responses: { 200: { description: 'Lista de clientes' } },
        },
        post: {
          tags: ['Customers'],
          summary: 'Crear cliente',
          operationId: 'createCustomer',
          responses: { 201: { description: 'Cliente creado' } },
        },
      },
      '/customers/{id}': {
        get: { tags: ['Customers'], summary: 'Obtener cliente', operationId: 'getCustomer', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Detalles del cliente' } } },
        put: { tags: ['Customers'], summary: 'Actualizar cliente', operationId: 'updateCustomer', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cliente actualizado' } } },
        delete: { tags: ['Customers'], summary: 'Eliminar cliente', operationId: 'deleteCustomer', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Cliente eliminado' } } },
      },
      '/employees': {
        get: { tags: ['Employees'], summary: 'Listar empleados', operationId: 'listEmployees', responses: { 200: { description: 'Lista de empleados' } } },
        post: { tags: ['Employees'], summary: 'Crear empleado', operationId: 'createEmployee', responses: { 201: { description: 'Empleado creado' } } },
      },
      '/invoices': {
        get: { tags: ['Invoices'], summary: 'Listar facturas', operationId: 'listInvoices', responses: { 200: { description: 'Lista de facturas' } } },
        post: { tags: ['Invoices'], summary: 'Crear factura', operationId: 'createInvoice', responses: { 201: { description: 'Factura creada' } } },
      },
      '/inventory': {
        get: { tags: ['Inventory'], summary: 'Listar inventario', operationId: 'listInventory', responses: { 200: { description: 'Lista de items' } } },
        post: { tags: ['Inventory'], summary: 'Agregar item', operationId: 'createInventoryItem', responses: { 201: { description: 'Item creado' } } },
      },
      '/vehicles': {
        get: { tags: ['Vehicles'], summary: 'Listar vehículos', operationId: 'listVehicles', responses: { 200: { description: 'Lista de vehículos' } } },
        post: { tags: ['Vehicles'], summary: 'Agregar vehículo', operationId: 'createVehicle', responses: { 201: { description: 'Vehículo creado' } } },
      },
      '/whatsapp': {
        get: { tags: ['WhatsApp'], summary: 'Estado de WhatsApp', operationId: 'getWhatsAppStatus', responses: { 200: { description: 'Estado de conexión' } } },
        post: { tags: ['WhatsApp'], summary: 'Enviar mensaje', operationId: 'sendWhatsAppMessage', responses: { 200: { description: 'Mensaje enviado' } } },
      },
      '/analytics': {
        get: { tags: ['Analytics'], summary: 'Dashboard de analytics', operationId: 'getAnalytics', responses: { 200: { description: 'Datos de analytics' } } },
      },
      '/notifications': {
        get: { tags: ['Notifications'], summary: 'Listar notificaciones', operationId: 'listNotifications', responses: { 200: { description: 'Lista de notificaciones' } } },
        post: { tags: ['Notifications'], summary: 'Enviar notificación', operationId: 'sendNotification', responses: { 201: { description: 'Notificación enviada' } } },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token de autenticación',
        },
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'auth-token',
          description: 'Token en cookie',
        },
      },
      schemas: {
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            jobNumber: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'SCHEDULED', 'ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] },
            serviceType: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            scheduledDate: { type: 'string', format: 'date-time' },
            customerId: { type: 'string', format: 'uuid' },
            technicianId: { type: 'string', format: 'uuid', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        JobCreate: {
          type: 'object',
          required: ['serviceType', 'customerId'],
          properties: {
            serviceType: { type: 'string' },
            description: { type: 'string' },
            address: { type: 'string' },
            scheduledDate: { type: 'string', format: 'date-time' },
            customerId: { type: 'string', format: 'uuid' },
            technicianId: { type: 'string', format: 'uuid' },
            priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] },
          },
        },
        JobList: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            jobs: { type: 'array', items: { $ref: '#/components/schemas/Job' } },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
        Customer: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            phone: { type: 'string' },
            address: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', default: false },
            error: { type: 'string' },
            code: { type: 'string' },
            details: { type: 'object' },
          },
        },
      },
    },
    security: [
      { bearerAuth: [] },
      { cookieAuth: [] },
    ],
  };
}

/**
 * Get OpenAPI spec as JSON string
 */
export function getOpenAPISpecJson(baseUrl: string = ''): string {
  return JSON.stringify(generateOpenAPISpec(baseUrl), null, 2);
}
