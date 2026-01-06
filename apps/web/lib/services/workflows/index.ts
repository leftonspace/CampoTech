/**
 * Workflow System Exports
 * =======================
 *
 * Central export point for the workflow system.
 * Import from here to access all workflow functionality.
 *
 * Phase 3.1: Added InquiryWorkflow and FAQWorkflow for interactive messages.
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

export {
  InquiryWorkflow,
  getInquiryWorkflow,
} from './inquiry-workflow';

export {
  FAQWorkflow,
  getFAQWorkflow,
  handleFAQButtonClick,
} from './faq-workflow';

export {
  handleButtonClick,
  parseInteractiveResponse,
  setPendingInteraction,
  type ButtonClickContext,
  type ButtonClickResult,
} from './button-response-handler';

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

import { WorkflowRouter } from './base-workflow';
import { getBookingWorkflow } from './booking-workflow';
import { getInquiryWorkflow } from './inquiry-workflow';
import { getFAQWorkflow } from './faq-workflow';

let routerInstance: WorkflowRouter | null = null;

/**
 * Get the global workflow router with all registered workflows
 *
 * Workflow priority (first match wins):
 * 1. BookingWorkflow - handles explicit booking requests
 * 2. FAQWorkflow - handles common questions
 * 3. InquiryWorkflow - handles generic inquiries (fallback)
 */
export function getWorkflowRouter(): WorkflowRouter {
  if (!routerInstance) {
    routerInstance = new WorkflowRouter();

    // Register all workflows (order matters for priority)
    routerInstance.register(getBookingWorkflow());
    routerInstance.register(getFAQWorkflow());
    routerInstance.register(getInquiryWorkflow());

    // Future workflows can be added here:
    // routerInstance.register(getStatusCheckWorkflow());
    // routerInstance.register(getRescheduleWorkflow());
    // routerInstance.register(getCancellationWorkflow());
  }

  return routerInstance;
}

