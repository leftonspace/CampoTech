/**
 * Resources Module
 * ================
 *
 * Team and resource management for zone operations.
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
