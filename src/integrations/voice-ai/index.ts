/**
 * Voice AI Integration
 * ====================
 *
 * Voice message processing with Whisper transcription and GPT extraction
 */

// Main service
export { VoiceAIService, VoiceAIError, getVoiceAIService } from './voice-ai.service';

// Types
export * from './voice-ai.types';

// Transcription
export {
  WhisperClient,
  WhisperError,
  getWhisperClient,
  preprocessAudio,
  preprocessAudioBuffer,
  preprocessAudioFromUrl,
  validateAudioForTranscription,
  cleanupTempFiles,
  PreprocessingError,
  type AudioMetadata,
  type PreprocessingResult,
  type ValidationResult,
} from './transcription';

// Extraction
export {
  GPTExtractor,
  ExtractionError,
  getGPTExtractor,
  ConfidenceScorer,
  getConfidenceScorer,
} from './extraction';

// Routing
export {
  ConfidenceRouter,
  getConfidenceRouter,
  quickRouteCheck,
} from './routing';
