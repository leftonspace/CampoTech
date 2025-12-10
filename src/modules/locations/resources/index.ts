/**
 * Resources Module
 * ================
 *
 * Team and resource management for multi-location operations.
 */

// Location Assignment
export {
  LocationAssignmentService,
  getLocationAssignmentService,
  AssignmentError,
  type TechnicianAssignment,
  type LocationTeam,
  type AssignmentRecommendation,
  type AssignmentReason,
  type BulkAssignmentResult,
  type TeamBalanceReport,
} from './location-assignment.service';

// Resource Sharing
export {
  ResourceSharingService,
  getResourceSharingService,
  ResourceSharingError,
  type ResourceType,
  type SharedResource,
  type ResourceAvailability,
  type SharingRequest,
  type SharingMetrics,
  type LocationResourceSummary,
} from './resource-sharing';

// Capacity Manager
export {
  CapacityManager,
  getCapacityManager,
  CapacityError,
  type LocationCapacity,
  type TimeSlotCapacity,
  type CapacityForecast,
  type CapacityForecastDay,
  type OrganizationCapacitySummary,
  type CapacityBottleneck,
  type BottleneckType,
  type CapacityAdjustment,
  type WorkloadDistribution,
} from './capacity-manager';

// Inter-Location Dispatch
export {
  InterLocationDispatchService,
  getInterLocationDispatchService,
  DispatchError,
  type DispatchCandidate,
  type DispatchRecommendation,
  type CrossLocationDispatch,
  type TravelTimeMatrix,
  type DispatchOptimizationResult,
  type AvailabilityWindow,
} from './inter-location-dispatch';
