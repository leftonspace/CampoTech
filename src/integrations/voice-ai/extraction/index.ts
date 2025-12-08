/**
 * Extraction Module
 * =================
 *
 * GPT-based extraction and confidence scoring
 */

export { GPTExtractor, ExtractionError, getGPTExtractor } from './gpt-extractor';
export { ConfidenceScorer, getConfidenceScorer } from './confidence-scorer';
export {
  EXTRACTION_SYSTEM_PROMPT,
  buildExtractionUserPrompt,
  CONFIRMATION_SYSTEM_PROMPT,
  buildConfirmationPrompt,
  CLARIFICATION_SYSTEM_PROMPT,
  buildClarificationPrompt,
} from './prompts/extraction.prompt';
