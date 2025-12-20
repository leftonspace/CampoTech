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
