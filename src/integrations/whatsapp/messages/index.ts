/**
 * WhatsApp Messages Module
 * ========================
 *
 * Unified exports for all WhatsApp messaging functionality.
 */

// Template messages
export {
  sendTemplateMessage,
  sendJobScheduledTemplate,
  sendInvoiceTemplate,
  sendPaymentConfirmedTemplate,
  sendPaymentLinkTemplate,
} from './template.sender';
export type { SendTemplateResult, SendTemplateError } from './template.sender';

// Text and interactive messages
export {
  sendTextMessage,
  sendReplyMessage,
  sendButtonMessage,
  sendListMessage,
  sendLocationMessage,
  sendReactionMessage,
} from './text.sender';
export type { SendMessageResult, SendMessageError } from './text.sender';

// Media messages
export {
  getMediaUrl,
  downloadMedia,
  downloadMediaToFile,
  uploadMedia,
  sendImageMessage,
  sendDocumentMessage,
  sendAudioMessage,
  sendVideoMessage,
} from './media.handler';
export type {
  MediaDownloadResult,
  MediaDownloadError,
  MediaUploadResult,
  SendMediaResult,
  SendMediaError,
} from './media.handler';
