/**
 * Voice AI Service Client
 * =======================
 * 
 * Client for the Python Voice AI service that handles:
 * - Voice message transcription with Whisper
 * - Intelligent job extraction with GPT-4
 * - Confidence-based routing (auto-create, confirm, or human review)
 * 
 * This service is the bridge between the Node.js backend and the Python
 * LangGraph-based voice processing service.
 */

import { prisma } from '@/lib/prisma';
import { Capabilities, getCapabilityWithEnvOverride } from '../../../../core/config/capabilities';
import { createProcessingTimer, type VoiceAIVersion } from '@/lib/analytics/voice-ai-comparison';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ConversationMessage {
    role: 'customer' | 'business';
    content: string;
    timestamp?: string;
    message_type?: 'text' | 'audio' | 'image';
}

export interface VoiceProcessingRequest {
    message_id: string;
    audio_url: string;
    customer_phone: string;
    organization_id: string;
    conversation_history?: ConversationMessage[];
}

export interface JobExtraction {
    title?: string;
    description?: string;
    service_type?: string;
    address?: string;
    city?: string;
    province?: string;
    preferred_date?: string;
    preferred_time?: string;
    urgency?: 'normal' | 'urgente' | 'emergencia';
    customer_name?: string;
    appliance_brand?: string;
    appliance_model?: string;
    problem_description?: string;
    field_confidences?: Record<string, number>;
    overall_confidence?: number;
}

export type VoiceProcessingStatus =
    | 'transcribing'
    | 'extracting'
    | 'confirming'
    | 'completed'
    | 'failed'
    | 'human_review';

export interface VoiceProcessingResponse {
    success: boolean;
    status: VoiceProcessingStatus;
    message_id: string;
    transcription?: string;
    extraction?: JobExtraction;
    confidence?: number;
    job_id?: string;
    workflow_id?: string;
    error?: string;
}

export interface WorkflowResumeRequest {
    workflow_id: string;
    customer_reply: string;
    reply_type?: 'text' | 'yes' | 'no';
}

export interface WorkflowResumeResponse {
    success: boolean;
    workflow_id: string;
    new_status: VoiceProcessingStatus;
    job_id?: string;
    message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const AI_SERVICE_URL = process.env.VOICE_AI_SERVICE_URL || 'http://localhost:8000';
const AI_SERVICE_KEY = process.env.VOICE_AI_SERVICE_KEY || '';
const AI_SERVICE_TIMEOUT = 60000; // 60 seconds for transcription + extraction

// Feature flag for gradual rollout
const VOICE_AI_ENABLED = process.env.VOICE_AI_ENABLED === 'true';

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class VoiceAIService {
    private baseUrl: string;
    private apiKey: string;
    private enabled: boolean;

    constructor() {
        this.baseUrl = AI_SERVICE_URL;
        this.apiKey = AI_SERVICE_KEY;
        this.enabled = VOICE_AI_ENABLED;
    }

    /**
     * Check if Voice AI V2 (LangGraph) is enabled for an organization
     * 
     * Requirements:
     * 1. Global Voice AI flag must be enabled (VOICE_AI_ENABLED=true)
     * 2. Organization must have WhatsApp Business BSP connected
     * 3. Organization has not explicitly disabled Voice AI
     * 
     * V1 code has been removed - this is now the only voice processing system.
     */
    async isEnabled(organizationId: string): Promise<boolean> {
        // Check if the master Voice AI is enabled
        if (!this.enabled) {
            console.log('[VoiceAI] Voice AI globally disabled');
            return false;
        }

        // Check capability (allows emergency disable via env var)
        const v2GloballyEnabled = getCapabilityWithEnvOverride('external', 'voice_ai_v2_langgraph');
        if (!v2GloballyEnabled) {
            console.log('[VoiceAI] Voice AI V2 disabled via capability');
            return false;
        }

        try {
            // Check if organization has WhatsApp BSP connected
            const whatsappAccount = await prisma.whatsAppBusinessAccount.findFirst({
                where: {
                    organizationId,
                    isActive: true,
                },
                select: {
                    id: true,
                    provider: true,
                },
            });

            if (!whatsappAccount) {
                console.log('[VoiceAI] No WhatsApp BSP connected for org:', organizationId);
                return false;
            }

            // Check if organization has Voice AI explicitly disabled
            const org = await prisma.organization.findUnique({
                where: { id: organizationId },
                select: {
                    settings: true,
                },
            });

            if (org) {
                const settings = org.settings as Record<string, unknown> | null;
                const voiceAIDisabled = settings?.voiceAIEnabled === false || settings?.voiceAIV2Enabled === false;

                if (voiceAIDisabled) {
                    console.log('[VoiceAI] Voice AI explicitly disabled for org:', organizationId);
                    return false;
                }
            }

            console.log('[VoiceAI] Voice AI enabled for org:', organizationId, 'provider:', whatsappAccount.provider);
            return true;
        } catch (error) {
            console.error('[VoiceAI] Error checking organization settings:', error);
            return false;
        }
    }

    /**
     * Get which version of Voice AI is being used
     * Now always returns 'v2' since V1 code was removed
     */
    async getVersion(_organizationId: string): Promise<VoiceAIVersion> {
        return 'v2';
    }

    /**
     * Check if the AI service is healthy
     */
    async isHealthy(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) return false;

            const data = await response.json() as { status?: string };
            return data.status === 'healthy';
        } catch (error) {
            console.error('[VoiceAI] Health check failed:', error);
            return false;
        }
    }

    /**
     * Process a voice message through the AI service
     */
    async processVoiceMessage(
        request: VoiceProcessingRequest
    ): Promise<VoiceProcessingResponse> {
        try {
            console.log('[VoiceAI] Processing voice message:', request.message_id);

            const response = await fetch(`${this.baseUrl}/api/voice/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
                },
                body: JSON.stringify(request),
                signal: AbortSignal.timeout(AI_SERVICE_TIMEOUT),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI service returned ${response.status}: ${errorText}`);
            }

            const result = await response.json() as VoiceProcessingResponse;

            console.log('[VoiceAI] Processing result:', {
                status: result.status,
                confidence: result.confidence,
                hasTranscription: !!result.transcription,
            });

            return result;
        } catch (error) {
            console.error('[VoiceAI] Processing failed:', error);

            return {
                success: false,
                status: 'failed',
                message_id: request.message_id,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Resume a paused workflow after customer reply
     */
    async resumeWorkflow(request: WorkflowResumeRequest): Promise<WorkflowResumeResponse> {
        try {
            console.log('[VoiceAI] Resuming workflow:', request.workflow_id);

            const response = await fetch(`${this.baseUrl}/api/voice/resume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.apiKey ? { 'Authorization': `Bearer ${this.apiKey}` } : {}),
                },
                body: JSON.stringify(request),
                signal: AbortSignal.timeout(30000),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`AI service returned ${response.status}: ${errorText}`);
            }

            return await response.json() as WorkflowResumeResponse;
        } catch (error) {
            console.error('[VoiceAI] Workflow resume failed:', error);

            return {
                success: false,
                workflow_id: request.workflow_id,
                new_status: 'failed',
                message: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get conversation history for AI context
     */
    async getConversationHistory(
        conversationId: string,
        limit: number = 20
    ): Promise<ConversationMessage[]> {
        try {
            const messages = await prisma.whatsAppMessage.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'desc' },
                take: limit,
                select: {
                    direction: true,
                    content: true,
                    type: true,
                    createdAt: true,
                },
            });

            return messages.reverse().map((msg: { direction: string; content: string | null; type: string | null; createdAt: Date }) => ({
                role: msg.direction === 'INBOUND' ? 'customer' : 'business',
                content: msg.content || '',
                timestamp: msg.createdAt.toISOString(),
                message_type: msg.type?.toLowerCase() === 'audio' ? 'audio' : 'text',
            })) as ConversationMessage[];
        } catch (error) {
            console.error('[VoiceAI] Error fetching conversation history:', error);
            return [];
        }
    }

    /**
     * Update message with processing results
     */
    async updateMessageWithResults(
        messageId: string,
        result: VoiceProcessingResponse
    ): Promise<void> {
        try {
            await prisma.whatsAppMessage.update({
                where: { id: messageId },
                data: {
                    // Store transcription in content if available
                    ...(result.transcription ? {
                        content: result.transcription,
                        metadata: {
                            originalContent: '[Audio message]',
                            transcribed: true,
                            transcribedAt: new Date().toISOString(),
                        },
                    } : {}),
                    // Update status based on processing result
                    status: result.status === 'completed' ? 'PROCESSED' :
                        result.status === 'failed' ? 'FAILED' : 'RECEIVED',
                },
            });

            // If extraction data exists, store it separately or in job draft
            if (result.extraction && result.confidence) {
                // Find the conversation
                const message = await prisma.whatsAppMessage.findUnique({
                    where: { id: messageId },
                    select: { conversationId: true },
                });

                if (message) {
                    // Update conversation with extraction data
                    await prisma.whatsAppConversation.update({
                        where: { id: message.conversationId },
                        data: {
                            metadata: {
                                lastVoiceExtraction: result.extraction,
                                lastVoiceConfidence: result.confidence,
                                lastVoiceProcessedAt: new Date().toISOString(),
                            },
                        },
                    });
                }
            }
        } catch (error) {
            console.error('[VoiceAI] Error updating message with results:', error);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

export const voiceAIService = new VoiceAIService();

/**
 * Main entry point for processing voice messages
 * 
 * This function:
 * 1. Checks if Voice AI is enabled
 * 2. Gathers conversation context
 * 3. Calls the Python AI service
 * 4. Updates the message with results
 * 5. Returns the processing result
 */
export async function processVoiceMessageWithAI(
    organizationId: string,
    conversationId: string,
    messageId: string,
    audioUrl: string,
    customerPhone: string
): Promise<VoiceProcessingResponse | null> {
    // Check if Voice AI is enabled for this organization
    const isEnabled = await voiceAIService.isEnabled(organizationId);
    if (!isEnabled) {
        console.log('[VoiceAI] Voice AI not enabled for organization:', organizationId);
        return null;
    }

    // Check if AI service is healthy
    const isHealthy = await voiceAIService.isHealthy();
    if (!isHealthy) {
        console.warn('[VoiceAI] AI service is not healthy, skipping voice processing');
        return null;
    }

    // Get conversation history for context
    const conversationHistory = await voiceAIService.getConversationHistory(conversationId);

    // Process the voice message
    const result = await voiceAIService.processVoiceMessage({
        message_id: messageId,
        audio_url: audioUrl,
        customer_phone: customerPhone,
        organization_id: organizationId,
        conversation_history: conversationHistory,
    });

    // Update the message with processing results
    await voiceAIService.updateMessageWithResults(messageId, result);

    return result;
}
