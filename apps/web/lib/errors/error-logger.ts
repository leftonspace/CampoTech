/**
 * CampoTech Error Logger
 * =======================
 *
 * Centralized error logging with Sentry integration.
 * Features:
 * - Automatic context enrichment (orgId, userId, action)
 * - Error categorization and severity levels
 * - Critical error alerts
 * - PII filtering before sending to Sentry
 * - User-friendly error message mapping
 */

import * as Sentry from '@sentry/nextjs';
import { mapErrorToCode, getUserMessage, type ErrorCode } from './user-messages';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export type ErrorCategory =
  | 'authentication'
  | 'verification'
  | 'payment'
  | 'subscription'
  | 'upload'
  | 'network'
  | 'database'
  | 'external_service'
  | 'validation'
  | 'permission'
  | 'unknown';

export type SeverityLevel = 'debug' | 'info' | 'warning' | 'error' | 'fatal';

export interface ErrorContext {
  organizationId?: string;
  userId?: string;
  action?: string;
  component?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface LoggedError {
  id: string;
  code: ErrorCode;
  category: ErrorCategory;
  severity: SeverityLevel;
  message: string;
  userMessage: string;
  context: ErrorContext;
  timestamp: Date;
  stack?: string;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CONSTANTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** Sensitive fields to redact before sending to Sentry */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'cuit',
  'cbu',
  'dni',
  'cardNumber',
  'cvv',
  'pin',
  'authorization',
  'cookie',
];

/** Error category patterns */
const CATEGORY_PATTERNS: Record<ErrorCategory, RegExp[]> = {
  authentication: [/auth/i, /login/i, /session/i, /token/i, /credential/i],
  verification: [/verif/i, /cuit/i, /dni/i, /afip/i, /selfie/i, /document/i],
  payment: [/payment/i, /mercadopago/i, /billing/i, /refund/i, /card/i],
  subscription: [/subscription/i, /trial/i, /plan/i, /tier/i],
  upload: [/upload/i, /file/i, /image/i, /document/i],
  network: [/network/i, /fetch/i, /timeout/i, /connection/i, /econnrefused/i],
  database: [/prisma/i, /database/i, /query/i, /transaction/i],
  external_service: [/afip/i, /mercadopago/i, /external/i, /api/i],
  validation: [/validation/i, /invalid/i, /required/i, /format/i],
  permission: [/permission/i, /unauthorized/i, /forbidden/i, /access denied/i],
  unknown: [],
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ERROR LOGGER SERVICE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

class ErrorLogger {
  private isSentryEnabled: boolean;

  constructor() {
    this.isSentryEnabled = !!process.env.SENTRY_DSN || !!process.env.NEXT_PUBLIC_SENTRY_DSN;
  }

  /**
   * Log an error with full context
   */
  log(
    error: Error | string,
    context: ErrorContext = {},
    severityOverride?: SeverityLevel
  ): LoggedError {
    const err = typeof error === 'string' ? new Error(error) : error;
    const code = mapErrorToCode(err);
    const category = this.categorizeError(err);
    const severity = severityOverride || this.determineSeverity(category, code);
    const userMessage = getUserMessage(code);

    // Generate unique error ID
    const errorId = this.generateErrorId();

    // Sanitize context (remove PII)
    const sanitizedContext = this.sanitizeContext(context);

    // Create logged error object
    const loggedError: LoggedError = {
      id: errorId,
      code,
      category,
      severity,
      message: err.message,
      userMessage: userMessage.message,
      context: sanitizedContext,
      timestamp: new Date(),
      stack: err.stack,
    };

    // Log to console
    this.logToConsole(loggedError);

    // Send to Sentry if enabled and severity warrants it
    if (this.isSentryEnabled && severity !== 'debug') {
      this.sendToSentry(err, loggedError);
    }

    return loggedError;
  }

  /**
   * Log a critical error (always alerts)
   */
  critical(
    error: Error | string,
    context: ErrorContext = {}
  ): LoggedError {
    return this.log(error, context, 'fatal');
  }

  /**
   * Log an error that should alert admins
   */
  alert(
    error: Error | string,
    context: ErrorContext = {},
    alertMessage?: string
  ): LoggedError {
    const logged = this.log(error, context, 'error');

    // Create admin alert
    if (this.isSentryEnabled) {
      Sentry.captureMessage(alertMessage || `[ALERT] ${logged.message}`, {
        level: 'error',
        tags: {
          alert: 'true',
          category: logged.category,
          errorCode: logged.code,
        },
        extra: {
          errorId: logged.id,
          ...logged.context,
        },
      });
    }

    return logged;
  }

  /**
   * Log a warning (non-critical issue)
   */
  warn(
    message: string,
    context: ErrorContext = {}
  ): LoggedError {
    return this.log(new Error(message), context, 'warning');
  }

  /**
   * Log info (for tracking important events)
   */
  info(
    message: string,
    context: ErrorContext = {}
  ): void {
    const sanitizedContext = this.sanitizeContext(context);

    console.log(`[INFO] ${message}`, sanitizedContext);

    if (this.isSentryEnabled) {
      Sentry.addBreadcrumb({
        category: 'info',
        message,
        level: 'info',
        data: sanitizedContext,
      });
    }
  }

  /**
   * Log debug info (dev only)
   */
  debug(
    message: string,
    context: ErrorContext = {}
  ): void {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[DEBUG] ${message}`, this.sanitizeContext(context));
    }
  }

  /**
   * Capture user context for error tracking
   */
  setUserContext(user: {
    id: string;
    email?: string;
    organizationId?: string;
    role?: string;
  }): void {
    if (this.isSentryEnabled) {
      Sentry.setUser({
        id: user.id,
        email: user.email ? this.maskEmail(user.email) : undefined,
      });

      Sentry.setContext('user_context', {
        organizationId: user.organizationId,
        role: user.role,
      });
    }
  }

  /**
   * Clear user context (on logout)
   */
  clearUserContext(): void {
    if (this.isSentryEnabled) {
      Sentry.setUser(null);
    }
  }

  /**
   * Start a performance transaction
   */
  startTransaction(
    name: string,
    operation: string
  ): { finish: () => void } | null {
    if (!this.isSentryEnabled) {
      return null;
    }

    const _transaction = Sentry.startSpan({
      name,
      op: operation,
    }, () => {
      // Transaction body would go here
    });

    return {
      finish: () => {
        // Transaction auto-finishes in this pattern
      },
    };
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    if (this.isSentryEnabled) {
      Sentry.addBreadcrumb({
        category,
        message,
        level: 'info',
        data: data ? this.sanitizeData(data) : undefined,
      });
    }
  }

  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Private Methods
  // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private generateErrorId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 8);
    return `err_${timestamp}_${randomPart}`;
  }

  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const stack = (error.stack || '').toLowerCase();
    const combined = `${message} ${stack}`;

    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(combined)) {
          return category as ErrorCategory;
        }
      }
    }

    return 'unknown';
  }

  private determineSeverity(
    category: ErrorCategory,
    code: ErrorCode
  ): SeverityLevel {
    // Critical errors
    if (
      category === 'database' ||
      code === 'ORG_BLOCKED_HARD' ||
      code === 'PAYMENT_REFUND_FAILED'
    ) {
      return 'error';
    }

    // High priority
    if (
      category === 'payment' ||
      category === 'authentication' ||
      code.startsWith('AUTH_')
    ) {
      return 'error';
    }

    // Medium priority
    if (
      category === 'verification' ||
      category === 'external_service' ||
      category === 'network'
    ) {
      return 'warning';
    }

    // Lower priority
    if (category === 'validation' || category === 'upload') {
      return 'info';
    }

    return 'warning';
  }

  private sanitizeContext(context: ErrorContext): ErrorContext {
    const sanitized: ErrorContext = {};

    for (const [key, value] of Object.entries(context)) {
      if (key === 'metadata' && value) {
        sanitized.metadata = this.sanitizeData(value as Record<string, unknown>);
      } else if (key !== 'metadata') {
        (sanitized as Record<string, unknown>)[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      // Check if key contains sensitive field name
      const isSensitive = SENSITIVE_FIELDS.some((field) =>
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return '***@***.***';

    const maskedLocal = local.length > 2
      ? `${local[0]}***${local[local.length - 1]}`
      : '***';

    return `${maskedLocal}@${domain}`;
  }

  private logToConsole(loggedError: LoggedError): void {
    const prefix = `[${loggedError.severity.toUpperCase()}]`;
    const contextStr = loggedError.context.action
      ? ` [${loggedError.context.action}]`
      : '';

    const logFn = {
      debug: console.debug,
      info: console.info,
      warning: console.warn,
      error: console.error,
      fatal: console.error,
    }[loggedError.severity];

    logFn(
      `${prefix}${contextStr} ${loggedError.code}: ${loggedError.message}`,
      {
        errorId: loggedError.id,
        category: loggedError.category,
        context: loggedError.context,
      }
    );
  }

  private sendToSentry(
    error: Error,
    loggedError: LoggedError
  ): void {
    Sentry.withScope((scope) => {
      // Set tags for filtering
      scope.setTag('error_code', loggedError.code);
      scope.setTag('error_category', loggedError.category);
      scope.setTag('error_id', loggedError.id);

      // Set context
      if (loggedError.context.organizationId) {
        scope.setTag('organization_id', loggedError.context.organizationId);
      }
      if (loggedError.context.userId) {
        scope.setTag('user_id', loggedError.context.userId);
      }
      if (loggedError.context.action) {
        scope.setTag('action', loggedError.context.action);
      }

      // Set extra data
      scope.setExtra('error_details', {
        code: loggedError.code,
        category: loggedError.category,
        userMessage: loggedError.userMessage,
        timestamp: loggedError.timestamp.toISOString(),
      });

      if (loggedError.context.metadata) {
        scope.setExtra('metadata', loggedError.context.metadata);
      }

      // Set level
      scope.setLevel(this.mapSeverityToSentryLevel(loggedError.severity));

      // Capture the exception
      Sentry.captureException(error);
    });
  }

  private mapSeverityToSentryLevel(
    severity: SeverityLevel
  ): Sentry.SeverityLevel {
    const mapping: Record<SeverityLevel, Sentry.SeverityLevel> = {
      debug: 'debug',
      info: 'info',
      warning: 'warning',
      error: 'error',
      fatal: 'fatal',
    };
    return mapping[severity];
  }
}

// Export singleton
export const errorLogger = new ErrorLogger();

// Export convenience functions
export const {
  log: logError,
  critical: logCritical,
  alert: logAlert,
  warn: logWarning,
  info: logInfo,
  debug: logDebug,
} = errorLogger;
