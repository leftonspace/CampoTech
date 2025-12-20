/**
 * Verification Types
 * ==================
 *
 * Core type definitions for verification functionality.
 * These types are used throughout the application and should match the Prisma schema.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════════

export type VerificationSubmissionStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'expired';

export type OrgVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'partial'
  | 'in_review'
  | 'verified'
  | 'rejected'
  | 'suspended';

export type UserVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'in_review'
  | 'verified'
  | 'suspended';

export type VerificationTier = 1 | 2 | 3;

export type DocumentType =
  | 'cuit'
  | 'afip_status'
  | 'activity_code'
  | 'dni_front'
  | 'dni_back'
  | 'selfie'
  | 'driver_license'
  | 'insurance'
  | 'vehicle_registration'
  | 'professional_license'
  | 'other';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationRequirement {
  id: string;
  code: string;
  name: string;
  description: string;
  documentType: DocumentType;
  tier: VerificationTier;
  isRequired: boolean;
  validityPeriodDays?: number | null;
  autoVerify: boolean;
  verificationInstructions?: string | null;
  acceptedFormats: string[];
  maxFileSizeMB: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationSubmission {
  id: string;
  organizationId: string;
  userId: string;
  requirementId: string;
  status: VerificationSubmissionStatus;
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  extractedData?: Record<string, unknown> | null;
  validationResult?: Record<string, unknown> | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  expiresAt?: Date | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface VerificationProgress {
  tier: VerificationTier;
  total: number;
  completed: number;
  pending: number;
  inReview: number;
  rejected: number;
  percentage: number;
}

export interface UserVerificationSummary {
  userId: string;
  organizationId: string;
  status: UserVerificationStatus;
  identityVerified: boolean;
  canBeAssignedJobs: boolean;
  verificationCompletedAt?: Date | null;
  tier3Progress: VerificationProgress;
  pendingRequirements: string[];
  expiringDocuments: ExpiringDocument[];
}

export interface ExpiringDocument {
  requirementId: string;
  requirementCode: string;
  expiresAt: Date;
  daysUntilExpiry: number;
}

export interface VerificationResult {
  success: boolean;
  submissionId?: string;
  status?: VerificationSubmissionStatus;
  error?: string;
}
