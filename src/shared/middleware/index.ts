/**
 * Middleware Index
 * ================
 *
 * Export all middleware for easy importing.
 */

// Validation
export {
  ValidationError,
  validate,
  validateQuery,
  CreateUserSchema,
  UpdateUserSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  CreateJobSchema,
  TransitionJobSchema,
  CreateInvoiceSchema,
  CreatePaymentSchema,
  RefundPaymentSchema,
  CreatePriceBookItemSchema,
  CreateCategorySchema,
} from './validation.middleware';

// Authorization
export {
  ROLE_PERMISSIONS,
  hasPermission,
  canAccessResource,
  requireAuth,
  requirePermission,
  requireAnyPermission,
  requireRole,
  checkResourceAccess,
} from './authorization.middleware';
export type { AuthContext } from './authorization.middleware';

// Rate Limiting
export {
  rateLimit,
  standardLimiter,
  strictLimiter,
  authLimiter,
  searchLimiter,
  writeLimiter,
  bulkLimiter,
} from './rate-limit.middleware';

// Error Handling
export {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ValidationError as AppValidationError,
  BusinessError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
} from './error.middleware';
