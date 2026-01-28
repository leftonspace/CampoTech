/**
 * Team Components
 * ================
 *
 * Components for team management and employee verification.
 */

// Verification components
export {
  EmployeeVerificationBadge,
  EmployeeVerificationInlineBadge,
  type EmployeeVerificationBadgeProps,
  type VerificationStatus,
} from './EmployeeVerificationBadge';

export { BulkEmployeeVerificationView } from './BulkEmployeeVerificationView';

// Team page components
export { EmployeeListTab, ROLE_CONFIG, LIVE_STATUS_CONFIG } from './EmployeeListTab';
export { TeamMemberModal } from './TeamMemberModal';
export { DeleteConfirmationModal } from './DeleteConfirmationModal';
export {
  WeeklySchedulesTab,
  MyScheduleTab,
  DisponibilidadTab,
  DAYS_OF_WEEK,
} from './AvailabilityTabs';

// Types
export type {
  TeamMember,
  TeamStats,
  TabType,
  LiveStatusType,
  UserLiveStatus,
  ScheduleEntry,
} from './types';
