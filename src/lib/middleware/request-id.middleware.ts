/**
 * Request ID Middleware
 * =====================
 *
 * Generates or propagates unique request IDs for tracing.
 * Essential for distributed tracing and debugging.
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface RequestIdOptions {
  /** Header to read incoming request ID from */
  headerName?: string;
  /** Header to set on response */
  responseHeader?: string;
  /** Custom ID generator */
  generator?: () => string;
  /** Attribute name on request object */
  attributeName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_HEADER = 'x-request-id';
const DEFAULT_ATTRIBUTE = 'requestId';

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a unique request ID
 * Format: timestamp-random (e.g., "1702034567890-a1b2c3d4e5f6")
 */
function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `${timestamp}-${random}`;
}

/**
 * Request ID middleware
 * Generates or propagates unique request IDs
 */
export function requestIdMiddleware(options: RequestIdOptions = {}) {
  const {
    headerName = DEFAULT_HEADER,
    responseHeader = DEFAULT_HEADER,
    generator = generateRequestId,
    attributeName = DEFAULT_ATTRIBUTE,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Get existing request ID from header or generate new one
    let requestId = req.headers[headerName] as string | undefined;

    if (!requestId || typeof requestId !== 'string') {
      requestId = generator();
    }

    // Attach to request object
    (req as any)[attributeName] = requestId;

    // Set response header
    res.setHeader(responseHeader, requestId);

    // Add to response locals for templates
    res.locals.requestId = requestId;

    next();
  };
}

/**
 * Get request ID from request object
 */
export function getRequestId(req: Request): string | undefined {
  return (req as any).requestId;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORRELATION ID MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Correlation ID middleware
 * For tracking requests across multiple services
 */
export function correlationIdMiddleware(headerName = 'x-correlation-id') {
  return (req: Request, res: Response, next: NextFunction) => {
    // Get or generate correlation ID
    let correlationId = req.headers[headerName] as string | undefined;

    if (!correlationId) {
      correlationId = generateRequestId();
    }

    // Attach to request
    (req as any).correlationId = correlationId;

    // Set response header
    res.setHeader(headerName, correlationId);

    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE AUGMENTATION
// ═══════════════════════════════════════════════════════════════════════════════

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      correlationId?: string;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { generateRequestId };
