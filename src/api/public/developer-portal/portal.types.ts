/**
 * Developer Portal Types
 * =======================
 *
 * Type definitions for the Developer Portal.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface DocSection {
  id: string;
  title: string;
  slug: string;
  order: number;
  content: string; // Markdown content
  children?: DocSection[];
}

export interface DocPage {
  id: string;
  title: string;
  slug: string;
  section_id: string;
  content: string; // Markdown content
  metadata?: {
    description?: string;
    keywords?: string[];
    updated_at?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════

export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  summary: string;
  description?: string;
  operationId: string;
  tags: string[];
  parameters?: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: Record<string, ApiResponse>;
  security?: ApiSecurity[];
  deprecated?: boolean;
}

export interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  description?: string;
  required?: boolean;
  schema: ApiSchema;
  example?: any;
}

export interface ApiRequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, { schema: ApiSchema; example?: any }>;
}

export interface ApiResponse {
  description: string;
  content?: Record<string, { schema: ApiSchema; example?: any }>;
  headers?: Record<string, { description: string; schema: ApiSchema }>;
}

export interface ApiSchema {
  type?: string;
  format?: string;
  description?: string;
  properties?: Record<string, ApiSchema>;
  items?: ApiSchema;
  enum?: any[];
  required?: string[];
  nullable?: boolean;
  default?: any;
  example?: any;
  $ref?: string;
}

export interface ApiSecurity {
  apiKey?: string[];
  oauth2?: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEVELOPER CONSOLE
// ═══════════════════════════════════════════════════════════════════════════════

export interface DeveloperApp {
  id: string;
  org_id: string;
  name: string;
  description?: string;
  type: 'personal' | 'organization';
  api_keys: DeveloperApiKey[];
  oauth_clients: DeveloperOAuthClient[];
  webhooks: DeveloperWebhook[];
  created_at: Date;
  updated_at: Date;
}

export interface DeveloperApiKey {
  id: string;
  app_id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit?: number;
  expires_at?: Date;
  last_used_at?: Date;
  is_active: boolean;
  created_at: Date;
}

export interface DeveloperOAuthClient {
  id: string;
  app_id: string;
  name: string;
  client_id: string;
  redirect_uris: string[];
  allowed_grant_types: string[];
  scopes: string[];
  is_active: boolean;
  created_at: Date;
}

export interface DeveloperWebhook {
  id: string;
  app_id: string;
  url: string;
  events: string[];
  enabled: boolean;
  last_delivery_at?: Date;
  last_delivery_status?: 'delivered' | 'failed';
  created_at: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API PLAYGROUND
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlaygroundRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  queryParams: Record<string, string>;
  body?: any;
}

export interface PlaygroundResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: any;
  duration: number;
}

export interface PlaygroundSession {
  id: string;
  user_id: string;
  environment: 'sandbox' | 'live';
  api_key?: string;
  requests: PlaygroundHistoryItem[];
  created_at: Date;
}

export interface PlaygroundHistoryItem {
  id: string;
  request: PlaygroundRequest;
  response: PlaygroundResponse;
  timestamp: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHANGELOG
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChangelogEntry {
  id: string;
  version: string;
  date: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix' | 'deprecation' | 'breaking';
  tags?: string[];
  details?: string; // Markdown content
}

// ═══════════════════════════════════════════════════════════════════════════════
// PORTAL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface PortalConfig {
  title: string;
  description: string;
  logo_url: string;
  primary_color: string;
  api_base_url: string;
  sandbox_base_url: string;
  support_email: string;
  github_url?: string;
  status_page_url?: string;
  features: {
    playground: boolean;
    webhooks: boolean;
    oauth: boolean;
    sdk_downloads: boolean;
  };
}

export const DEFAULT_PORTAL_CONFIG: PortalConfig = {
  title: 'CampoTech Developer Portal',
  description: 'Build powerful integrations with the CampoTech API',
  logo_url: '/logo.svg',
  primary_color: '#2563eb',
  api_base_url: 'https://api.campotech.com',
  sandbox_base_url: 'https://sandbox.api.campotech.com',
  support_email: 'developers@campotech.com',
  github_url: 'https://github.com/campotech',
  status_page_url: 'https://status.campotech.com',
  features: {
    playground: true,
    webhooks: true,
    oauth: true,
    sdk_downloads: true,
  },
};
