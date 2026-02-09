/**
 * CampoTech AI Security Module
 * =============================
 *
 * Phase 8 Security Remediation
 *
 * Centralized exports for AI security utilities:
 * - Prompt sanitization (P2)
 * - Rate limiting (P3)
 * - Response validation (P4)
 */

// Prompt Sanitizer (P2)
export {
    sanitizePromptInput,
    sanitizeConversationHistory,
    sanitizeCustomerMessage,
    sanitizeStaffQuery,
    detectInjectionAttempt,
    logInjectionAttempt,
} from './prompt-sanitizer';

// Rate Limiter (P3)
export {
    checkAIRateLimit,
    checkOrgDailyLimit,
    checkCombinedAILimits,
    getRateLimitHeaders,
    type AIOperationType,
    type AIRateLimitResult,
} from './rate-limiter';

// Response Schemas (P4)
export {
    // Schemas
    AIIntentSchema,
    AIAnalysisSchema,
    DraftResponseSchema,
    BookingSuggestionSchema,
    CustomerAnalysisSchema,
    ConflictDetectionSchema,
    CopilotIntentSchema,
    ExtractedEntitiesSchema,

    // Types
    type AIIntent,
    type AIAnalysis,
    type DraftResponse,
    type BookingSuggestion,
    type CustomerAnalysis,
    type ConflictDetection,
    type CopilotIntent,
    type ExtractedEntities,

    // Parsers
    parseAIAnalysis,
    parseDraftResponse,
    parseBookingSuggestion,
    parseCustomerAnalysis,
    parseConflictDetection,
    safeParseJSON,
    validateAIResponseBounds,
} from './response-schemas';
