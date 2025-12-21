/**
 * Workflow System Exports
 * =======================
 *
 * Central export point for the workflow system.
 * Import from here to access all workflow functionality.
 */

// Base classes and types
export {
  BaseWorkflow,
  WorkflowRouter,
  createWorkflowContext,
  type WorkflowContext,
  type WorkflowResult,
  type WorkflowStep,
  type StepResult,
  type ExtractedEntities,
  type WorkflowIntent,
} from './base-workflow';

// Specific workflows
export {
  BookingWorkflow,
  getBookingWorkflow,
} from './booking-workflow';

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

import { WorkflowRouter } from './base-workflow';
import { getBookingWorkflow } from './booking-workflow';

let routerInstance: WorkflowRouter | null = null;

/**
 * Get the global workflow router with all registered workflows
 */
export function getWorkflowRouter(): WorkflowRouter {
  if (!routerInstance) {
    routerInstance = new WorkflowRouter();

    // Register all workflows
    routerInstance.register(getBookingWorkflow());

    // Future workflows can be added here:
    // routerInstance.register(getStatusCheckWorkflow());
    // routerInstance.register(getRescheduleWorkflow());
    // routerInstance.register(getCancellationWorkflow());
  }

  return routerInstance;
}
