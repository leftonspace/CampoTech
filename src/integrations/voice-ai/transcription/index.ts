/**
 * Transcription Module
 * ====================
 *
 * Audio transcription using OpenAI Whisper
 */

export { WhisperClient, WhisperError, getWhisperClient } from './whisper.client';
export {
  preprocessAudio,
  preprocessAudioBuffer,
  preprocessAudioFromUrl,
  validateAudioForTranscription,
  cleanupTempFiles,
  PreprocessingError,
  type AudioMetadata,
  type PreprocessingResult,
  type ValidationResult,
} from './preprocessing';
