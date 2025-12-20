/**
 * Dashboard Components
 * ====================
 *
 * Components for the main dashboard including alerts, onboarding, and status cards.
 */

// Existing widgets
export { StockAlerts } from './StockAlerts';
export { FleetStatus } from './FleetStatus';
export { TodaySchedule } from './TodaySchedule';
export { UsageWidget } from './UsageWidget';

// Alerts
export { DashboardAlerts, type DashboardAlertsProps } from './DashboardAlerts';

// Onboarding
export {
  OnboardingChecklist,
  OnboardingChecklistCompact,
  type OnboardingChecklistProps,
} from './OnboardingChecklist';

// Account Status
export {
  AccountStatusCard,
  AccountStatusCardCompact,
  type AccountStatusCardProps,
} from './AccountStatusCard';
