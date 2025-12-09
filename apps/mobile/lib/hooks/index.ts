/**
 * Mobile Hooks
 * ============
 *
 * Phase 9.10: Mobile-First Architecture
 * Custom hooks for mobile app functionality
 */

// Sync and offline hooks
export { useSyncStatus } from './use-sync-status';
export {
  useOfflineData,
  useOfflineJobs,
  useOfflineCustomers,
  useOfflineEntity,
} from './use-offline-data';
export type { EntityType } from './use-offline-data';
