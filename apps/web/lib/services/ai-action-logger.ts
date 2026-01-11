/**
 * AI Action Logger
 * =================
 *
 * Logs AI actions as system messages in WhatsApp conversations.
 * These messages appear as distinct notifications showing what the AI did:
 * - Customer created
 * - Job/turno created
 * - Technician assigned
 * - Conflicts detected
 * - Suggestions made
 */

import { prisma } from '@/lib/prisma';

export type AIActionType =
  | 'customer_created'
  | 'job_created'
  | 'technician_assigned'
  | 'schedule_confirmed'
  | 'conflict_detected'
  | 'suggestion'
  | 'transfer_to_human'
  | 'availability_checked'
  | 'price_quoted';

export interface AIActionMetadata {
  customerId?: string;
  customerName?: string;
  jobId?: string;
  jobNumber?: string;
  technicianId?: string;
  technicianName?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  serviceType?: string;
  address?: string;
  price?: string;
  conflictReason?: string;
  suggestion?: string;
  confidence?: number;
}

export interface LogAIActionParams {
  organizationId: string;
  conversationId: string;
  actionType: AIActionType;
  metadata?: AIActionMetadata;
  description?: string;
  isProactiveSuggestion?: boolean;
}

const ACTION_TITLES: Record<AIActionType, string> = {
  customer_created: 'Cliente Creado',
  job_created: 'Turno Creado',
  technician_assigned: 'Técnico Asignado',
  schedule_confirmed: 'Turno Confirmado',
  conflict_detected: 'Conflicto Detectado',
  suggestion: 'Sugerencia de IA',
  transfer_to_human: 'Transferido a Agente',
  availability_checked: 'Disponibilidad Consultada',
  price_quoted: 'Precio Informado',
};

/**
 * Log an AI action as a system message in the conversation
 */
export async function logAIAction(params: LogAIActionParams): Promise<string | null> {
  const {
    organizationId,
    conversationId,
    actionType,
    metadata,
    description,
    isProactiveSuggestion,
  } = params;

  try {
    // Build message content
    let content = ACTION_TITLES[actionType];
    if (description) {
      content += `: ${description}`;
    }

    // Create the message record
    const message = await prisma.waMessage.create({
      data: {
        conversationId,
        waMessageId: `ai-action-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        direction: 'outbound',
        type: 'text', // Will be rendered specially based on senderType
        body: content,
        status: 'delivered',
        senderType: 'system',
        aiActionTaken: actionType,
        aiActionMetadata: metadata || {},
        isProactiveSuggestion: isProactiveSuggestion || false,
        aiConfidence: metadata?.confidence || null,
      },
    });

    // Also log to AI conversation log for analytics
    await prisma.aIConversationLog.create({
      data: {
        organizationId,
        conversationId,
        messageId: message.id,
        customerMessage: `[AI Action] ${actionType}`,
        messageType: 'text',
        detectedIntent: actionType,
        confidenceScore: metadata?.confidence || 100,
        aiResponse: content,
        responseStatus: 'ai_action',
        extractedEntities: metadata || {},
      },
    }).catch((err: Error) => {
      console.error('[AI Action Logger] Failed to log to AIConversationLog:', err);
    });

    return message.id;
  } catch (error) {
    console.error('[AI Action Logger] Failed to log action:', error);
    return null;
  }
}

/**
 * Log multiple AI actions at once (e.g., from a workflow)
 */
export async function logWorkflowActions(
  organizationId: string,
  conversationId: string,
  stepResults: Map<string, { success: boolean; data?: unknown }>
): Promise<void> {
  const actions: LogAIActionParams[] = [];

  // Check for customer creation
  const customerResult = stepResults.get('find_or_create_customer');
  if (customerResult?.success && customerResult.data) {
    const data = customerResult.data as { id: string; name: string; isNew?: boolean };
    if (data.isNew) {
      actions.push({
        organizationId,
        conversationId,
        actionType: 'customer_created',
        metadata: {
          customerId: data.id,
          customerName: data.name,
        },
      });
    }
  }

  // Check for job creation
  const jobResult = stepResults.get('create_job');
  if (jobResult?.success && jobResult.data) {
    const data = jobResult.data as { id: string; jobNumber: string };
    actions.push({
      organizationId,
      conversationId,
      actionType: 'job_created',
      metadata: {
        jobId: data.id,
        jobNumber: data.jobNumber,
      },
    });
  }

  // Check for technician assignment
  const techResult = stepResults.get('select_technician');
  if (techResult?.success && techResult.data) {
    const data = techResult.data as { technicianId: string; technicianName: string };
    actions.push({
      organizationId,
      conversationId,
      actionType: 'technician_assigned',
      metadata: {
        technicianId: data.technicianId,
        technicianName: data.technicianName,
      },
    });
  }

  // Check for scheduling validation (might have time slot info)
  const timeSlotResult = stepResults.get('validate_time_slot');
  if (timeSlotResult?.success && timeSlotResult.data) {
    const data = timeSlotResult.data as { timeSlot?: { start: string } };
    if (data.timeSlot) {
      // This info will be included in the job_created action
      const jobAction = actions.find(a => a.actionType === 'job_created');
      if (jobAction && jobAction.metadata) {
        jobAction.metadata.scheduledTime = data.timeSlot.start;
      }
    }
  }

  // Log all actions
  for (const action of actions) {
    await logAIAction(action);
  }
}

/**
 * Log a conflict detection
 */
export async function logConflict(
  organizationId: string,
  conversationId: string,
  reason: string,
  suggestion?: string
): Promise<void> {
  await logAIAction({
    organizationId,
    conversationId,
    actionType: 'conflict_detected',
    metadata: {
      conflictReason: reason,
      suggestion,
    },
    description: reason,
  });
}

/**
 * Log a proactive AI suggestion
 */
export async function logProactiveSuggestion(
  organizationId: string,
  conversationId: string,
  suggestion: string,
  confidence?: number
): Promise<void> {
  await logAIAction({
    organizationId,
    conversationId,
    actionType: 'suggestion',
    metadata: {
      suggestion,
      confidence,
    },
    description: suggestion,
    isProactiveSuggestion: true,
  });
}

/**
 * Log a transfer to human
 */
export async function logTransferToHuman(
  organizationId: string,
  conversationId: string,
  reason: string
): Promise<void> {
  await logAIAction({
    organizationId,
    conversationId,
    actionType: 'transfer_to_human',
    description: reason,
  });
}

const aiActionLogger = {
  logAIAction,
  logWorkflowActions,
  logConflict,
  logProactiveSuggestion,
  logTransferToHuman,
};

export default aiActionLogger;
