/**
 * Verification Types
 * ==================
 *
 * Type definitions for the verification system.
 */

import type {
  VerificationSubmissionStatus,
  OrgVerificationStatus,
  UserVerificationStatus,
} from '@/lib/types';

// These types are used from Prisma models - using minimal local definitions
interface VerificationRequirement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  tier: number;
  isRequired: boolean;
  isActive: boolean;
  displayOrder: number;
  icon: string | null;
  badgeLabel: string | null;
  appliesTo: string;
  validationRules: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

interface VerificationSubmission {
  id: string;
  organizationId: string;
  userId: string | null;
  requirementId: string;
  status: VerificationSubmissionStatus;
  submittedValue: string | null;
  documentUrl: string | null;
  expiresAt: Date | null;
  verificationData: Record<string, unknown> | null;
  reviewedBy: string | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUIREMENT WITH STATUS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Combined status for a requirement and its submission
 */
export type CombinedStatus =
  | 'not_started'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

/**
 * Requirement with its current submission status
 */
export interface RequirementWithStatus {
  /** The verification requirement */
  requirement: VerificationRequirement;
  /** The current submission (if any) */
  submission: VerificationSubmission | null;
  /** Combined status */
  status: CombinedStatus;
  /** When the submission expires (if applicable) */
  expiresAt: Date | null;
  /** Days until expiry (null if no expiry) */
  daysUntilExpiry: number | null;
  /** True if expiring within 30 days */
  isExpiringSoon: boolean;
  /** Whether user can upload a document for this requirement */
  canUpload: boolean;
  /** Whether user can update an existing submission */
  canUpdate: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION STATUS SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Summary of verification status for an organization
 */
export interface OrgVerificationSummary {
  /** Overall verification status */
  status: OrgVerificationStatus;
  /** Whether the organization can receive jobs */
  canReceiveJobs: boolean;
  /** Whether the organization is visible in marketplace */
  marketplaceVisible: boolean;
  /** Compliance score (0-100) */
  complianceScore: number;
  /** Date verification was completed (if applicable) */
  verificationCompletedAt: Date | null;
  /** Tier 2 requirements progress */
  tier2: {
    total: number;
    completed: number;
    pending: number;
    inReview: number;
    rejected: number;
  };
  /** Tier 4 badges progress */
  tier4: {
    total: number;
    earned: number;
  };
  /** Active compliance blocks */
  activeBlocks: number;
  /** Requirements that need attention */
  requiresAttention: RequirementWithStatus[];
}

/**
 * Summary of verification status for a user/employee
 */
export interface UserVerificationSummary {
  /** Overall verification status */
  status: UserVerificationStatus;
  /** Whether the user can be assigned jobs */
  canBeAssignedJobs: boolean;
  /** Whether identity is verified */
  identityVerified: boolean;
  /** Date verification was completed (if applicable) */
  verificationCompletedAt: Date | null;
  /** Tier 3 requirements progress */
  tier3: {
    total: number;
    completed: number;
    pending: number;
    inReview: number;
    rejected: number;
  };
  /** Requirements that need attention */
  requiresAttention: RequirementWithStatus[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// BADGES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * An earned verification badge
 */
export interface Badge {
  /** Requirement code */
  code: string;
  /** Display name */
  name: string;
  /** Icon name */
  icon: string | null;
  /** Display label */
  label: string | null;
  /** When the badge was earned */
  earnedAt: Date;
  /** When the badge expires (if applicable) */
  expiresAt: Date | null;
  /** Whether the badge is currently valid */
  isValid: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUBMISSION INPUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Input for submitting a verification
 */
export interface SubmissionInput {
  /** Organization ID */
  organizationId: string;
  /** Requirement code */
  requirementCode: string;
  /** User ID (required for employee requirements) */
  userId?: string;
  /** Submitted value (for text-based verifications) */
  submittedValue?: string;
  /** Document URL (for document-based verifications) */
  documentUrl?: string;
  /** Document MIME type */
  documentType?: string;
  /** Document filename */
  documentFilename?: string;
  /** Expiration date (if required) */
  expiresAt?: Date;
  /** Auto-verification response data */
  autoVerifyResponse?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of auto-verification attempt
 */
export interface AutoVerifyResult {
  /** Whether auto-verification succeeded */
  success: boolean;
  /** Whether the submission should be approved */
  shouldApprove: boolean;
  /** Whether the submission needs manual review */
  needsReview: boolean;
  /** Verification data to store */
  verificationData?: Record<string, unknown>;
  /** Reason for the result */
  reason?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * CUIT/CUIL verification result
 */
export interface CUITVerifyResult extends AutoVerifyResult {
  /** Whether the CUIT/CUIL is valid */
  isValid: boolean;
  /** Whether the CUIT/CUIL exists in AFIP */
  exists: boolean;
  /** Whether the entity is active */
  isActive: boolean;
  /** Business/person name */
  razonSocial?: string;
  /** Tax category */
  categoriaTributaria?: string;
}

/**
 * Phone verification result
 */
export interface PhoneVerifyResult extends AutoVerifyResult {
  /** Whether the code matched */
  codeMatched: boolean;
  /** Phone number verified */
  phoneNumber?: string;
}
