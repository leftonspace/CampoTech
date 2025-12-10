/**
 * SDK Module
 * ===========
 *
 * Exports for SDK generation and OpenAPI specification.
 */

// OpenAPI Specification
export {
  generateOpenApiSpec,
  getOpenApiJson,
  getOpenApiYaml,
} from './openapi.spec';

// TypeScript SDK (client is in separate file for distribution)
export * from './typescript/client';
