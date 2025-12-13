/**
 * Trust Module
 * ============
 *
 * Exports for trust and verification services.
 * Phase 15: Consumer Marketplace
 */

export { VerificationService, VERIFICATION_REQUIREMENTS } from './verification.service';
export type {
  VerificationType,
  VerificationStatus,
  VerificationRequest,
  CreateVerificationInput,
  TrustScore,
  TrustSignal,
} from './verification.service';
