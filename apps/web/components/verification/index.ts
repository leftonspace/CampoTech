/**
 * Verification Components
 * =======================
 *
 * Components for document upload, identity verification, and compliance management.
 */

// Document handling
export { DocumentUpload, type DocumentUploadProps, type UploadResult } from './DocumentUpload';
export {
  DocumentViewer,
  DocumentViewerModal,
  type DocumentViewerProps,
  type DocumentViewerModalProps,
} from './DocumentViewer';

// Identity verification
export { SelfieCapture, type SelfieCaptureProps } from './SelfieCapture';
export {
  SelfieVerification,
  type SelfieVerificationProps,
  type VerificationResult,
} from './SelfieVerification';

// Acknowledgments
export {
  AcknowledgmentModal,
  InlineAcknowledgment,
  type AcknowledgmentModalProps,
  type AcknowledgmentResult,
  type InlineAcknowledgmentProps,
} from './AcknowledgmentModal';

// Verification dashboard components
export {
  RequirementsTable,
  type Requirement,
  type RequirementsTableProps,
} from './RequirementsTable';

export {
  BadgesGrid,
  type Badge,
  type BadgesGridProps,
} from './BadgesGrid';

export {
  EmployeeComplianceTable,
  type EmployeeVerification,
  type EmployeeComplianceTableProps,
} from './EmployeeComplianceTable';
