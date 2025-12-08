/**
 * Error Handler
 * =============
 *
 * Centralized error handling with Sentry integration.
 * Provides error classification, formatting, and reporting.
 */

import { Request, Response, NextFunction } from 'express';
import { getLogger } from './logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ErrorContext {
  /** Organization ID */
  orgId?: string;
  /** User ID */
  userId?: string;
  /** Request ID for tracing */
  requestId?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
  };
}

export interface SentryConfig {
  /** Sentry DSN */
  dsn: string;
  /** Environment (production, staging, development) */
  environment: string;
  /** Release version */
  release?: string;
  /** Sample rate (0-1) */
  sampleRate?: number;
  /** Tags to add to all events */
  tags?: Record<string, string>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

export const ErrorCodes = {
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',

  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Integration errors
  AFIP_ERROR: 'AFIP_ERROR',
  AFIP_SERVICE_UNAVAILABLE: 'AFIP_SERVICE_UNAVAILABLE',
  AFIP_VALIDATION_ERROR: 'AFIP_VALIDATION_ERROR',
  MERCADOPAGO_ERROR: 'MERCADOPAGO_ERROR',
  WHATSAPP_ERROR: 'WHATSAPP_ERROR',
  OPENAI_ERROR: 'OPENAI_ERROR',

  // Business logic errors
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  RESOURCE_LOCKED: 'RESOURCE_LOCKED',

  // Capability errors
  CAPABILITY_DISABLED: 'CAPABILITY_DISABLED',
  FEATURE_NOT_AVAILABLE: 'FEATURE_NOT_AVAILABLE',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ═══════════════════════════════════════════════════════════════════════════════
// APP ERROR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Application error with code and context
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: ErrorContext;
  public readonly details?: Record<string, any>;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      statusCode?: number;
      isOperational?: boolean;
      context?: ErrorContext;
      details?: Record<string, any>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options.statusCode || this.getDefaultStatusCode(code);
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    this.details = options.details;

    if (options.cause) {
      this.cause = options.cause;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Get default HTTP status code for error code
   */
  private getDefaultStatusCode(code: ErrorCode): number {
    const statusCodes: Record<string, number> = {
      [ErrorCodes.NOT_FOUND]: 404,
      [ErrorCodes.BAD_REQUEST]: 400,
      [ErrorCodes.VALIDATION_ERROR]: 400,
      [ErrorCodes.UNAUTHORIZED]: 401,
      [ErrorCodes.FORBIDDEN]: 403,
      [ErrorCodes.TOKEN_EXPIRED]: 401,
      [ErrorCodes.INVALID_TOKEN]: 401,
      [ErrorCodes.SESSION_EXPIRED]: 401,
      [ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
      [ErrorCodes.QUOTA_EXCEEDED]: 429,
      [ErrorCodes.CONFLICT]: 409,
      [ErrorCodes.DUPLICATE_ENTRY]: 409,
      [ErrorCodes.RESOURCE_LOCKED]: 423,
      [ErrorCodes.AFIP_SERVICE_UNAVAILABLE]: 503,
    };

    return statusCodes[code] || 500;
  }

  /**
   * Convert to response format
   */
  toResponse(requestId?: string): ErrorResponse {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

export class ErrorHandler {
  private sentryClient?: any;
  private logger = getLogger();

  constructor() {}

  /**
   * Initialize Sentry integration
   */
  async initializeSentry(config: SentryConfig): Promise<void> {
    try {
      // Dynamic import to handle missing dependency
      const Sentry = await import('@sentry/node');

      Sentry.init({
        dsn: config.dsn,
        environment: config.environment,
        release: config.release,
        sampleRate: config.sampleRate || 1.0,
        integrations: [
          // Performance monitoring
          Sentry.requestDataIntegration(),
        ],
      });

      if (config.tags) {
        Sentry.setTags(config.tags);
      }

      this.sentryClient = Sentry;
      this.logger.info('Sentry initialized', { environment: config.environment });
    } catch (error) {
      this.logger.warn('Sentry not available - error reporting disabled', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle an error
   */
  handle(error: Error, context?: ErrorContext): AppError {
    // Convert to AppError if needed
    const appError = this.toAppError(error, context);

    // Log the error
    this.logError(appError);

    // Report to Sentry if non-operational
    if (!appError.isOperational) {
      this.reportToSentry(appError);
    }

    return appError;
  }

  /**
   * Convert any error to AppError
   */
  private toAppError(error: Error, context?: ErrorContext): AppError {
    if (error instanceof AppError) {
      return error;
    }

    // Check for known error patterns
    const code = this.inferErrorCode(error);
    const isOperational = this.isOperationalError(error);

    return new AppError(code, error.message, {
      isOperational,
      context,
      cause: error,
    });
  }

  /**
   * Infer error code from error
   */
  private inferErrorCode(error: Error): ErrorCode {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Validation errors
    if (name.includes('validation') || message.includes('validation')) {
      return ErrorCodes.VALIDATION_ERROR;
    }

    // Not found
    if (message.includes('not found') || message.includes('does not exist')) {
      return ErrorCodes.NOT_FOUND;
    }

    // Auth errors
    if (message.includes('unauthorized') || message.includes('unauthenticated')) {
      return ErrorCodes.UNAUTHORIZED;
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many')) {
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    }

    // Integration errors
    if (message.includes('afip')) {
      return ErrorCodes.AFIP_ERROR;
    }
    if (message.includes('mercadopago') || message.includes('payment')) {
      return ErrorCodes.MERCADOPAGO_ERROR;
    }
    if (message.includes('whatsapp')) {
      return ErrorCodes.WHATSAPP_ERROR;
    }

    return ErrorCodes.INTERNAL_ERROR;
  }

  /**
   * Check if error is operational (expected)
   */
  private isOperationalError(error: Error): boolean {
    // Known non-operational errors
    const nonOperationalPatterns = [
      'out of memory',
      'stack overflow',
      'heap',
      'segmentation fault',
      'econnreset',
      'epipe',
    ];

    const message = error.message.toLowerCase();
    return !nonOperationalPatterns.some(pattern => message.includes(pattern));
  }

  /**
   * Log the error
   */
  private logError(error: AppError): void {
    const logContext = {
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      ...error.context,
      details: error.details,
    };

    if (error.isOperational) {
      this.logger.warn(error.message, logContext);
    } else {
      this.logger.error(error.message, error, logContext);
    }
  }

  /**
   * Report error to Sentry
   */
  private reportToSentry(error: AppError): void {
    if (!this.sentryClient) {
      return;
    }

    this.sentryClient.withScope((scope: any) => {
      // Add context
      if (error.context) {
        if (error.context.orgId) {
          scope.setTag('orgId', error.context.orgId);
        }
        if (error.context.userId) {
          scope.setUser({ id: error.context.userId });
        }
        if (error.context.requestId) {
          scope.setTag('requestId', error.context.requestId);
        }
        if (error.context.metadata) {
          scope.setExtras(error.context.metadata);
        }
      }

      // Add error details
      scope.setTag('errorCode', error.code);
      scope.setLevel(error.isOperational ? 'warning' : 'error');

      this.sentryClient.captureException(error);
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPRESS MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Express error handling middleware
 */
export function errorMiddleware(errorHandler: ErrorHandler) {
  return (error: Error, req: Request, res: Response, _next: NextFunction) => {
    const requestId = (req as any).requestId || req.headers['x-request-id'];

    const context: ErrorContext = {
      orgId: (req as any).auth?.orgId,
      userId: (req as any).auth?.userId,
      requestId: requestId as string,
      metadata: {
        method: req.method,
        path: req.path,
        query: req.query,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      },
    };

    const appError = errorHandler.handle(error, context);

    // Don't expose internal errors in production
    const response = appError.toResponse(requestId as string);

    if (!appError.isOperational && process.env.NODE_ENV === 'production') {
      response.error.message = 'An unexpected error occurred';
      delete response.error.details;
    }

    res.status(appError.statusCode).json(response);
  };
}

/**
 * Not found handler middleware
 */
export function notFoundMiddleware() {
  return (req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(ErrorCodes.NOT_FOUND, `Resource not found: ${req.path}`));
  };
}

/**
 * Async handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let errorHandler: ErrorHandler | null = null;

/**
 * Initialize the global error handler
 */
export function initializeErrorHandler(sentryConfig?: SentryConfig): ErrorHandler {
  errorHandler = new ErrorHandler();

  if (sentryConfig) {
    errorHandler.initializeSentry(sentryConfig);
  }

  return errorHandler;
}

/**
 * Get the global error handler
 */
export function getErrorHandler(): ErrorHandler {
  if (!errorHandler) {
    errorHandler = new ErrorHandler();
  }
  return errorHandler;
}
