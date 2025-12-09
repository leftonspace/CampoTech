/**
 * Message Aggregation Module
 * ==========================
 *
 * Phase 9.8: WhatsApp Conversational Intelligence
 * Exports message aggregation services for the WhatsApp integration.
 */

// Message Aggregator Service
export {
  MessageAggregatorService,
  getMessageAggregator,
  AGGREGATION_WINDOW_MS,
  MAX_BUFFER_MESSAGES,
  CONTEXT_HISTORY_SIZE,
  CONTEXT_TTL_HOURS,
  TRIGGER_PATTERNS,
  LONG_MESSAGE_THRESHOLD,
} from './message-aggregator.service';
export type {
  BufferedMessage,
  MessageBuffer,
  ConversationContext,
  AggregationResult,
} from './message-aggregator.service';

// Context Builder for GPT
export {
  buildEnhancedContext,
  buildClassificationPrompt,
  buildResponseSuggestionPrompt,
  buildServiceExtractionPrompt,
  formatContextForLog,
  estimateTokenCount,
} from './context-builder';
export type { EnhancedContext, GPTPrompt } from './context-builder';
