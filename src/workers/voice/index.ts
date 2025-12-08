/**
 * Voice Workers
 * =============
 *
 * Background workers for voice message processing
 */

export {
  getVoiceQueue,
  queueVoiceMessage,
  getQueueStatus,
  startVoiceWorker,
  stopVoiceWorker,
  retryFailedJob,
  getFailedJobs,
  cleanOldJobs,
  pauseQueue,
  resumeQueue,
  drainQueue,
  type VoiceProcessingJobData,
  type VoiceProcessingJobResult,
} from './voice-processing.worker';

export {
  AudioDownloader,
  DownloadError,
  getAudioDownloader,
  type DownloadResult,
  type WhatsAppMediaInfo,
} from './audio-downloader';

export {
  VoiceFallbackHandler,
  getFallbackHandler,
  classifyError,
  type FallbackReason,
  type FallbackAction,
  type FallbackContext,
} from './voice-fallback.handler';
