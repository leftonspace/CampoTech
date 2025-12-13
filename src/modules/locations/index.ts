/**
 * Locations Module
 * ================
 *
 * Zones support for CampoTech.
 * Enables organizations to manage service zones and technician coverage areas.
 */

// Types
export * from './location.types';

// Validation
export * from './location.validation';

// Services
export { LocationService, LocationError, getLocationService } from './location.service';
export { ZoneManager, getZoneManager } from './zone-manager';
export { CoverageCalculator, getCoverageCalculator } from './coverage-calculator';

// Billing
export * from './billing';

// Resources (Team & Resource Management) - explicit exports to avoid LocationCapacity conflict
export {
  LocationAssignmentService,
  getLocationAssignmentService,
  AssignmentError,
  CapacityManager,
  getCapacityManager,
  CapacityError,
} from './resources';
export type {
  TechnicianAssignment,
  LocationTeam,
  AssignmentRecommendation,
  AssignmentReason,
  BulkAssignmentResult,
  TeamBalanceReport,
  TimeSlotCapacity,
  CapacityForecast,
  CapacityForecastDay,
  OrganizationCapacitySummary,
  CapacityBottleneck,
  BottleneckType,
  CapacityAdjustment,
  WorkloadDistribution,
} from './resources';
// Note: LocationCapacity is exported from location.types, not re-exported from resources
