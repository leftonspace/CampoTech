/**
 * Error Handling Middleware
 * =========================
 *
 * Centralized error handling with secure error responses.
 * Prevents information disclosure in production.
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Base application error
 * Operational errors are expected and safe to expose to clients
 */
export class AppError extends Error {
  code: string;
  statusCode: number;
  isOperational: boolean;
  details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode: number = 400,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super('NOT_FOUND', `${resource} not found`, 404);
  }
}

/**
 * Unauthorized Error
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super('UNAUTHORIZED', message, 401);
  }
}

/**
 * Forbidden Error
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied') {
    super('FORBIDDEN', message, 403);
  }
}

/**
 * Conflict Error (duplicate, etc.)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

/**
 * Validation Error
 */
export class ValidationError extends AppError {
  constructor(message: string, fields?: Record<string, string>) {
    super('VALIDATION_ERROR', message, 400, { fields });
  }
}

/**
 * Business Logic Error
 */
export class BusinessError extends AppError {
  constructor(code: string, message: string) {
    super(code, message, 400);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR MAPPING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Map common error messages to safe responses
 */
const ERROR_MAPPINGS: Record<string, { code: string; statusCode: number }> = {
  'not found': { code: 'NOT_FOUND', statusCode: 404 },
  'already exists': { code: 'CONFLICT', statusCode: 409 },
  'duplicate': { code: 'CONFLICT', statusCode: 409 },
  'invalid': { code: 'VALIDATION_ERROR', statusCode: 400 },
  'unauthorized': { code: 'UNAUTHORIZED', statusCode: 401 },
  'forbidden': { code: 'FORBIDDEN', statusCode: 403 },
};

/**
 * Determine if error message is safe to expose
 */
function isSafeMessage(message: string): boolean {
  const safePhrases = [
    'not found',
    'already exists',
    'invalid',
    'must be',
    'required',
    'cannot',
    'failed to',
  ];
  const lower = message.toLowerCase();
  return safePhrases.some(phrase => lower.includes(phrase));
}

/**
 * Map error to safe response
 */
function mapErrorToResponse(error: Error): {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
} {
  // Handle operational errors
  if (error instanceof AppError) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      details: error.details,
    };
  }

  // Check for known error patterns
  const lowerMessage = error.message.toLowerCase();
  for (const [pattern, mapping] of Object.entries(ERROR_MAPPINGS)) {
    if (lowerMessage.includes(pattern)) {
      return {
        code: mapping.code,
        message: isSafeMessage(error.message) ? error.message : 'Operation failed',
        statusCode: mapping.statusCode,
      };
    }
  }

  // Database constraint violations
  if (error.message.includes('violates') || error.message.includes('constraint')) {
    return {
      code: 'CONSTRAINT_VIOLATION',
      message: 'Operation violates data constraints',
      statusCode: 400,
    };
  }

  // Default: internal error (don't expose details)
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    statusCode: 500,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Map error to safe response
  const { code, message, statusCode, details } = mapErrorToResponse(err);

  // Log error (always log full error server-side)
  const isOperational = err instanceof AppError && err.isOperational;

  if (statusCode >= 500 || !isOperational) {
    log.error('Unhandled error', err, {
      requestId: (req as any).requestId,
      path: req.path,
      method: req.method,
      userId: req.auth?.userId,
      orgId: req.auth?.orgId,
    });
  } else {
    log.warn('Request error', {
      code,
      message: err.message,
      path: req.path,
      method: req.method,
      userId: req.auth?.userId,
    });
  }

  // Build response
  const response: Record<string, any> = {
    error: {
      code,
      message,
    },
  };

  // Include details for validation errors
  if (details) {
    response.error.details = details;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
}

/**
 * Async handler wrapper - catches async errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
