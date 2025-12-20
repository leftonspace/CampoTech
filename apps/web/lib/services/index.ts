/**
 * Services Module Index
 * =====================
 *
 * Central export point for all service modules.
 */

// Verification Services
export { verificationManager } from './verification-manager';
export { autoVerifier } from './auto-verifier';
export type {
  RequirementWithStatus,
  CombinedStatus,
  OrgVerificationSummary,
  UserVerificationSummary,
  Badge,
  SubmissionInput,
  AutoVerifyResult,
  CUITVerifyResult,
  PhoneVerifyResult,
} from './verification-types';

// Acknowledgment Services
export { acknowledgmentService } from './acknowledgment-service';
export type {
  AcknowledgmentInput,
  AcknowledgmentStatus,
  MissingAcknowledgment,
} from './acknowledgment-service';

// Block Management Services
export { blockManager, BLOCK_REASON_CODES } from './block-manager';
export type {
  CreateBlockInput,
  BlockSummary,
  AutoBlockResult,
  BlockReasonCode,
} from './block-manager';
