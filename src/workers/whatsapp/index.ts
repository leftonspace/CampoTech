/**
 * WhatsApp Workers Module
 * =======================
 */

// Outbound worker
export {
  startWorker,
  stopWorker,
  getWorkerStatus,
  getQueueStats,
  enqueueMessage,
  enqueueTemplateMessage,
  enqueueTextMessage,
} from './whatsapp-outbound.worker';

// Message state machine
export {
  processStatusUpdate,
  createMessageRecord,
  getDeliveryStats,
  getRecentFailures,
  retryFailedMessages,
  isValidTransition,
} from './message-state-machine';
export type {
  MessageState,
  MessageStatusUpdate,
  MessageRecord,
  StateTransition,
} from './message-state-machine';

// Panic mode
export {
  PanicModeService,
  canProcessMessage,
  checkAutoResolve,
} from './panic-mode.service';
export type {
  IntegrationType,
  PanicReason,
  PanicState,
  PanicEvaluationResult,
} from './panic-mode.service';
