/**
 * Access Control Module
 * =====================
 *
 * Unified access control for subscription AND verification checks.
 *
 * Usage:
 *
 * 1. In API routes with middleware:
 * ```typescript
 * import { withAccessControl } from '@/lib/access-control';
 *
 * export const GET = withAccessControl(
 *   async (req, context) => {
 *     const { accessStatus } = context;
 *     // Your handler code
 *   },
 *   { requireJobs: true }
 * );
 * ```
 *
 * 2. Direct access check:
 * ```typescript
 * import { checkAccess } from '@/lib/access-control';
 *
 * const status = await checkAccess(organizationId);
 * if (status.canReceiveJobs) {
 *   // Allow action
 * }
 * ```
 *
 * 3. Quick checks:
 * ```typescript
 * import { canReceiveJobs, canAssignUser } from '@/lib/access-control';
 *
 * if (await canReceiveJobs(orgId)) {
 *   // Fast check using cached DB field
 * }
 * ```
 */

// Main checker
export {
  checkAccess,
  checkUserAccess,
  canReceiveJobs,
  canAssignUser,
  isOrgMarketplaceVisible,
} from './checker';

// Types from checker
export type {
  AccessStatus,
  UserAccessStatus,
  BlockReason,
  ExpiringDoc,
  SubscriptionAccessStatus,
  VerificationAccessStatus,
} from './checker';

// Middleware
export {
  withAccessControl,
  requireAccess,
  AccessDeniedError,
} from './middleware';

// Types from middleware
export type {
  AccessControlOptions,
  AccessControlContext,
  AccessControlHandler,
} from './middleware';
