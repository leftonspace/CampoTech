/**
 * Developer Portal Module
 * ========================
 *
 * Exports for the Developer Portal.
 */

// Types
export type {
  DocSection,
  DocPage,
  ApiEndpoint,
  ApiParameter,
  ApiRequestBody,
  ApiResponse,
  ApiSchema,
  ApiSecurity,
  DeveloperApp,
  DeveloperApiKey,
  DeveloperOAuthClient,
  DeveloperWebhook,
  PlaygroundRequest,
  PlaygroundResponse,
  PlaygroundSession,
  PlaygroundHistoryItem,
  ChangelogEntry,
  PortalConfig,
} from './portal.types';
export { DEFAULT_PORTAL_CONFIG } from './portal.types';

// API Reference
export {
  API_REFERENCE,
  getAllEndpoints,
  getEndpointsByTag,
  getEndpointByOperationId,
  getTags,
} from './api-reference';

// Console Service
export { DeveloperConsoleService, createConsoleService } from './console.service';
export type { CreateAppOptions, AppWithCredentials } from './console.service';

// Playground Service
export { PlaygroundService, createPlaygroundService, DEFAULT_PLAYGROUND_CONFIG } from './playground.service';
export type { PlaygroundConfig } from './playground.service';
