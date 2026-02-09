/**
 * AI Response Schemas
 * ====================
 *
 * Phase 8 Security Remediation: P4
 * Zod schemas for validating AI model responses before use.
 *
 * This module provides:
 * - Type-safe parsing of AI JSON responses
 * - Default values for missing fields
 * - Bounds checking for numeric values
 * - Protection against malformed AI output
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════════════════════
// WHATSAPP AI RESPONDER SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intent types for customer message classification
 */
export const AIIntentSchema = z.enum([
    'booking',
    'question',
    'status',
    'complaint',
    'greeting',
    'confirmation',
    'cancellation',
    'other',
]);

export type AIIntent = z.infer<typeof AIIntentSchema>;

/**
 * Urgency levels for service requests
 */
export const UrgencySchema = z.enum(['normal', 'urgente']);

/**
 * Entities extracted from customer messages
 */
export const ExtractedEntitiesSchema = z.object({
    serviceType: z.string().optional(),
    preferredDate: z.string().optional(),
    preferredTime: z.string().optional(),
    address: z.string().optional(),
    urgency: UrgencySchema.optional(),
    problemDescription: z.string().optional(),
    customerName: z.string().optional(),
    phoneNumber: z.string().optional(),
    equipmentType: z.string().optional(),
    equipmentBrand: z.string().optional(),
});

export type ExtractedEntities = z.infer<typeof ExtractedEntitiesSchema>;

/**
 * Full AI analysis response from WhatsApp responder
 */
export const AIAnalysisSchema = z.object({
    intent: AIIntentSchema.catch('other'),
    confidence: z.number().min(0).max(100).catch(50),
    extractedEntities: ExtractedEntitiesSchema.catch({}),
    suggestedResponse: z.string().catch('Disculpá, no pude procesar tu mensaje. ¿Podrías repetirlo?'),
    shouldCreateJob: z.boolean().catch(false),
    shouldTransfer: z.boolean().catch(false),
    transferReason: z.string().optional(),
    warnings: z.array(z.string()).catch([]),
});

export type AIAnalysis = z.infer<typeof AIAnalysisSchema>;

/**
 * Parse and validate AI analysis response, providing safe defaults
 */
export function parseAIAnalysis(content: string): AIAnalysis {
    try {
        const parsed = JSON.parse(content);
        return AIAnalysisSchema.parse(parsed);
    } catch (error) {
        console.error('[AI Response Parser] Failed to parse AI analysis:', error);
        // Return safe defaults if parsing fails
        return {
            intent: 'other',
            confidence: 0,
            extractedEntities: {},
            suggestedResponse: '',
            shouldCreateJob: false,
            shouldTransfer: true,
            transferReason: 'AI response parsing failed',
            warnings: ['AI output could not be parsed'],
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF ASSISTANT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Draft response suggestion from staff assistant
 */
export const DraftResponseSchema = z.object({
    suggestedResponse: z.string(),
    confidence: z.number().min(0).max(100).catch(50),
    notes: z.string().optional(),
});

export type DraftResponse = z.infer<typeof DraftResponseSchema>;

/**
 * Parse draft response from AI
 */
export function parseDraftResponse(content: string): DraftResponse {
    try {
        const parsed = JSON.parse(content);
        return DraftResponseSchema.parse(parsed);
    } catch (error) {
        console.error('[AI Response Parser] Failed to parse draft response:', error);
        return {
            suggestedResponse: content, // Use raw content as fallback
            confidence: 30,
            notes: 'AI response could not be parsed as JSON',
        };
    }
}

/**
 * Booking suggestion from staff assistant
 */
export const BookingSuggestionSchema = z.object({
    recommended: z.boolean().catch(false),
    suggestedService: z.string().optional(),
    suggestedDate: z.string().optional(),
    suggestedTime: z.string().optional(),
    estimatedDuration: z.number().optional(),
    technicianPreference: z.string().optional(),
    notes: z.string().optional(),
    missingInfo: z.array(z.string()).catch([]),
    confidence: z.number().min(0).max(100).catch(50),
});

export type BookingSuggestion = z.infer<typeof BookingSuggestionSchema>;

/**
 * Parse booking suggestion from AI
 */
export function parseBookingSuggestion(content: string): BookingSuggestion {
    try {
        const parsed = JSON.parse(content);
        return BookingSuggestionSchema.parse(parsed);
    } catch (error) {
        console.error('[AI Response Parser] Failed to parse booking suggestion:', error);
        return {
            recommended: false,
            notes: 'AI response could not be parsed',
            missingInfo: ['service type', 'date', 'time'],
            confidence: 0,
        };
    }
}

/**
 * Customer analysis from staff assistant
 */
export const CustomerAnalysisSchema = z.object({
    summary: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']).catch('neutral'),
    loyaltyScore: z.number().min(0).max(100).optional(),
    totalSpent: z.number().optional(),
    jobCount: z.number().optional(),
    lastInteraction: z.string().optional(),
    recommendations: z.array(z.string()).catch([]),
    riskFactors: z.array(z.string()).catch([]),
});

export type CustomerAnalysis = z.infer<typeof CustomerAnalysisSchema>;

/**
 * Parse customer analysis from AI
 */
export function parseCustomerAnalysis(content: string): CustomerAnalysis {
    try {
        const parsed = JSON.parse(content);
        return CustomerAnalysisSchema.parse(parsed);
    } catch (error) {
        console.error('[AI Response Parser] Failed to parse customer analysis:', error);
        return {
            summary: 'Unable to analyze customer',
            sentiment: 'neutral',
            recommendations: [],
            riskFactors: ['Analysis failed'],
        };
    }
}

/**
 * Conflict detection result from staff assistant
 */
export const ConflictDetectionSchema = z.object({
    hasConflicts: z.boolean().catch(false),
    conflicts: z.array(
        z.object({
            type: z.string(),
            description: z.string(),
            severity: z.enum(['low', 'medium', 'high']).catch('medium'),
            suggestion: z.string().optional(),
        })
    ).catch([]),
    overallRisk: z.enum(['low', 'medium', 'high']).catch('low'),
});

export type ConflictDetection = z.infer<typeof ConflictDetectionSchema>;

/**
 * Parse conflict detection from AI
 */
export function parseConflictDetection(content: string): ConflictDetection {
    try {
        const parsed = JSON.parse(content);
        return ConflictDetectionSchema.parse(parsed);
    } catch (error) {
        console.error('[AI Response Parser] Failed to parse conflict detection:', error);
        return {
            hasConflicts: true, // Assume conflicts on error (safe default)
            conflicts: [{ type: 'unknown', description: 'Could not analyze conflicts', severity: 'medium' }],
            overallRisk: 'medium',
        };
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPILOT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Copilot intent classification
 */
export const CopilotIntentSchema = z.enum([
    'create_job',
    'suggest_reply',
    'summary',
    'check_schedule',
    'general',
]);

export type CopilotIntent = z.infer<typeof CopilotIntentSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely parse any JSON response from AI
 * Returns null if parsing fails
 */
export function safeParseJSON<T>(
    content: string,
    schema: z.ZodType<T>
): { success: true; data: T } | { success: false; error: z.ZodError } {
    try {
        const parsed = JSON.parse(content);
        const result = schema.safeParse(parsed);
        return result;
    } catch (error) {
        return {
            success: false,
            error: new z.ZodError([
                {
                    code: 'custom',
                    path: [],
                    message: `JSON parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                },
            ]),
        };
    }
}

/**
 * Validate that AI response is within expected bounds
 */
export function validateAIResponseBounds(response: {
    confidence?: number;
    tokensUsed?: number;
}): boolean {
    if (response.confidence !== undefined) {
        if (response.confidence < 0 || response.confidence > 100) {
            return false;
        }
    }
    if (response.tokensUsed !== undefined) {
        if (response.tokensUsed < 0 || response.tokensUsed > 10000) {
            return false;
        }
    }
    return true;
}

const responseSchemas = {
    // Schemas
    AIIntentSchema,
    AIAnalysisSchema,
    DraftResponseSchema,
    BookingSuggestionSchema,
    CustomerAnalysisSchema,
    ConflictDetectionSchema,
    CopilotIntentSchema,
    ExtractedEntitiesSchema,

    // Parsers
    parseAIAnalysis,
    parseDraftResponse,
    parseBookingSuggestion,
    parseCustomerAnalysis,
    parseConflictDetection,
    safeParseJSON,
    validateAIResponseBounds,
};

export default responseSchemas;
