/**
 * Base Workflow System
 * ====================
 *
 * Provides a structured way to execute multi-step operations triggered by AI.
 * Each workflow consists of discrete steps that can be executed, validated,
 * and rolled back if necessary.
 *
 * Benefits over pure AI-driven approach:
 * - Predictable execution path
 * - Proper validation at each step
 * - Rollback capability on failure
 * - Auditable step-by-step logs
 * - Business rules enforcement
 */

import { SchedulingIntelligenceResult } from '../scheduling-intelligence';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WorkflowContext {
  /** Organization running the workflow */
  organizationId: string;
  /** WhatsApp conversation ID */
  conversationId: string;
  /** Customer ID (set by FindOrCreateCustomer step) */
  customerId?: string;
  /** Customer phone number */
  customerPhone: string;
  /** Customer name (if known) */
  customerName?: string;
  /** Entities extracted by AI from the message */
  extractedEntities: ExtractedEntities;
  /** Scheduling intelligence data */
  schedulingContext?: SchedulingIntelligenceResult;
  /** Results from completed steps */
  stepResults: Map<string, StepResult>;
  /** Workflow execution metadata */
  metadata: {
    startedAt: Date;
    aiConfidence: number;
    originalMessage: string;
    messageType: 'text' | 'voice' | 'image';
  };
}

export interface ExtractedEntities {
  serviceType?: string;
  preferredDate?: string;
  preferredTime?: string;
  address?: string;
  urgency?: 'normal' | 'urgente';
  problemDescription?: string;
  customerName?: string;
  [key: string]: unknown;
}

export interface StepResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Message to include in response if step needs customer input */
  requiresInput?: {
    field: string;
    question: string;
  };
  /** Skip remaining steps and return this response */
  earlyReturn?: {
    response: string;
    action: 'respond' | 'transfer' | 'wait_input';
  };
}

export interface WorkflowResult {
  success: boolean;
  /** Which step failed (if any) */
  failedStep?: string;
  /** Error message */
  error?: string;
  /** Response to send to customer */
  response?: string;
  /** Action to take */
  action: 'respond' | 'transfer' | 'create_job' | 'wait_input' | 'error';
  /** Created job (if applicable) */
  jobCreated?: {
    id: string;
    jobNumber: string;
  };
  /** Created customer (if applicable) */
  customerCreated?: {
    id: string;
    name: string;
  };
  /** All step results for auditing */
  stepResults: Map<string, StepResult>;
}

export interface WorkflowStep {
  /** Unique identifier for this step */
  id: string;
  /** Human-readable name */
  name: string;
  /** Execute the step */
  execute: (context: WorkflowContext) => Promise<StepResult>;
  /** Rollback the step on failure (optional) */
  rollback?: (context: WorkflowContext) => Promise<void>;
  /** Whether this step is required (default: true) */
  required?: boolean;
}

export type WorkflowIntent =
  | 'booking'
  | 'status_check'
  | 'reschedule'
  | 'cancel'
  | 'question'
  | 'complaint'
  | 'human_transfer';

// ═══════════════════════════════════════════════════════════════════════════════
// BASE WORKFLOW CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export abstract class BaseWorkflow {
  /** Steps to execute in order */
  abstract steps: WorkflowStep[];

  /** Intent this workflow handles */
  abstract intent: WorkflowIntent;

  /** Check if this workflow can handle the given intent and entities */
  abstract canHandle(intent: string, entities: ExtractedEntities): boolean;

  /** Generate response message from workflow results */
  abstract generateResponse(context: WorkflowContext, result: WorkflowResult): string;

  /**
   * Execute all workflow steps
   */
  async execute(context: WorkflowContext): Promise<WorkflowResult> {
    const completedSteps: WorkflowStep[] = [];

    try {
      for (const step of this.steps) {
        console.log(`[Workflow] Executing step: ${step.id}`);

        const result = await step.execute(context);
        context.stepResults.set(step.id, result);
        completedSteps.push(step);

        // Check for early return (e.g., need customer input)
        if (result.earlyReturn) {
          return {
            success: true,
            response: result.earlyReturn.response,
            action: result.earlyReturn.action,
            stepResults: context.stepResults,
          };
        }

        // Check for step failure
        if (!result.success) {
          if (step.required !== false) {
            // Rollback completed steps
            await this.rollback(context, completedSteps);

            return {
              success: false,
              failedStep: step.id,
              error: result.error || `Step ${step.id} failed`,
              action: 'error',
              stepResults: context.stepResults,
            };
          }
          // Non-required step failed, continue
          console.log(`[Workflow] Non-required step ${step.id} failed, continuing...`);
        }
      }

      // All steps completed successfully
      const response = this.generateResponse(context, {
        success: true,
        action: 'respond',
        stepResults: context.stepResults,
      });

      // Extract created entities from step results
      const jobResult = context.stepResults.get('create_job');
      const customerResult = context.stepResults.get('find_or_create_customer');

      return {
        success: true,
        response,
        action: this.getFinalAction(context),
        jobCreated: jobResult?.data as { id: string; jobNumber: string } | undefined,
        customerCreated: customerResult?.data as { id: string; name: string } | undefined,
        stepResults: context.stepResults,
      };
    } catch (error) {
      console.error('[Workflow] Unexpected error:', error);

      // Rollback on unexpected error
      await this.rollback(context, completedSteps);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        action: 'error',
        stepResults: context.stepResults,
      };
    }
  }

  /**
   * Rollback completed steps in reverse order
   */
  private async rollback(context: WorkflowContext, completedSteps: WorkflowStep[]): Promise<void> {
    for (const step of [...completedSteps].reverse()) {
      if (step.rollback) {
        try {
          console.log(`[Workflow] Rolling back step: ${step.id}`);
          await step.rollback(context);
        } catch (rollbackError) {
          console.error(`[Workflow] Rollback failed for step ${step.id}:`, rollbackError);
        }
      }
    }
  }

  /**
   * Determine the final action based on workflow results
   */
  protected getFinalAction(context: WorkflowContext): WorkflowResult['action'] {
    // Default: respond if job was created, otherwise respond
    const jobResult = context.stepResults.get('create_job');
    if (jobResult?.success && jobResult.data) {
      return 'create_job';
    }
    return 'respond';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKFLOW ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

export class WorkflowRouter {
  private workflows: BaseWorkflow[] = [];

  /**
   * Register a workflow
   */
  register(workflow: BaseWorkflow): void {
    this.workflows.push(workflow);
  }

  /**
   * Find the appropriate workflow for an intent
   */
  findWorkflow(intent: string, entities: ExtractedEntities): BaseWorkflow | null {
    for (const workflow of this.workflows) {
      if (workflow.canHandle(intent, entities)) {
        return workflow;
      }
    }
    return null;
  }

  /**
   * Execute the appropriate workflow for an intent
   */
  async executeForIntent(
    intent: string,
    entities: ExtractedEntities,
    baseContext: Omit<WorkflowContext, 'stepResults' | 'extractedEntities'>
  ): Promise<WorkflowResult | null> {
    const workflow = this.findWorkflow(intent, entities);

    if (!workflow) {
      return null;
    }

    const context: WorkflowContext = {
      ...baseContext,
      extractedEntities: entities,
      stepResults: new Map(),
    };

    return workflow.execute(context);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a workflow context from AI analysis
 */
export function createWorkflowContext(params: {
  organizationId: string;
  conversationId: string;
  customerPhone: string;
  customerName?: string;
  extractedEntities: ExtractedEntities;
  schedulingContext?: SchedulingIntelligenceResult;
  aiConfidence: number;
  originalMessage: string;
  messageType: 'text' | 'voice' | 'image';
}): WorkflowContext {
  return {
    organizationId: params.organizationId,
    conversationId: params.conversationId,
    customerPhone: params.customerPhone,
    customerName: params.customerName || params.extractedEntities.customerName,
    extractedEntities: params.extractedEntities,
    schedulingContext: params.schedulingContext,
    stepResults: new Map(),
    metadata: {
      startedAt: new Date(),
      aiConfidence: params.aiConfidence,
      originalMessage: params.originalMessage,
      messageType: params.messageType,
    },
  };
}
