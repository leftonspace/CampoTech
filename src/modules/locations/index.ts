/**
 * Locations Module
 * ================
 *
 * Multi-location support for CampoTech.
 * Enables organizations to manage multiple branches, service areas, and zones.
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
  ResourceSharingService,
  getResourceSharingService,
  ResourceSharingError,
  CapacityManager,
  getCapacityManager,
  CapacityError,
  InterLocationDispatchService,
  getInterLocationDispatchService,
  DispatchError,
} from './resources';
export type {
  TechnicianAssignment,
  LocationTeam,
  AssignmentRecommendation,
  AssignmentReason,
  BulkAssignmentResult,
  TeamBalanceReport,
  ResourceType,
  SharedResource,
  ResourceAvailability,
  SharingRequest,
  SharingMetrics,
  LocationResourceSummary,
  TimeSlotCapacity,
  CapacityForecast,
  CapacityForecastDay,
  OrganizationCapacitySummary,
  CapacityBottleneck,
  BottleneckType,
  CapacityAdjustment,
  WorkloadDistribution,
  DispatchCandidate,
  DispatchRecommendation,
  CrossLocationDispatch,
  TravelTimeMatrix,
  DispatchOptimizationResult,
  AvailabilityWindow,
} from './resources';
// Note: LocationCapacity is exported from location.types, not re-exported from resources
