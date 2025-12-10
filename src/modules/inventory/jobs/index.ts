/**
 * Job-Inventory Integration Module
 * Phase 12.6: Exports for job materials management
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type {
  MaterialSource,
  JobMaterial,
  AddJobMaterialInput,
  UpdateJobMaterialInput,
  UseMaterialInput,
  ReturnMaterialInput,
  JobMaterialSummary,
  MaterialEstimate,
  JobEstimation,
  MaterialTemplate,
  MaterialTemplateItem,
  MaterialUsageReport,
  JobProfitabilityReport,
} from './job-material.types';

export { MATERIAL_SOURCE_LABELS } from './job-material.types';

// ═══════════════════════════════════════════════════════════════════════════════
// JOB MATERIAL SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // CRUD
  addJobMaterial,
  getJobMaterials,
  updateJobMaterial,
  removeJobMaterial,
  // Usage
  useMaterial,
  returnMaterial,
  // Summary
  getJobMaterialSummary,
  // Estimation
  getMaterialEstimates,
  addMaterialsFromEstimate,
  // Invoice integration
  getMaterialsForInvoice,
  markMaterialsInvoiced,
  // Reports
  generateMaterialUsageReport,
  getJobProfitabilityReport,
} from './job-material.service';
