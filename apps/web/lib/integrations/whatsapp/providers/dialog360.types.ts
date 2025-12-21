/**
 * 360dialog API Types
 * ====================
 *
 * Type definitions for the 360dialog WhatsApp Business API.
 * 360dialog is a Meta Business Solution Provider (BSP) that allows
 * CampoTech to provision WhatsApp numbers for customers.
 *
 * API Documentation: https://docs.360dialog.com/
 */

// ═══════════════════════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface Dialog360Config {
  /** Partner API key */
  apiKey: string;
  /** Partner ID */
  partnerId: string;
  /** Webhook secret for signature verification */
  webhookSecret?: string;
  /** API base URL (defaults to production) */
  apiBaseUrl?: string;
}

export const DIALOG360_API_BASE_URL = 'https://waba.360dialog.io';
export const DIALOG360_PARTNER_API_BASE_URL = 'https://hub.360dialog.com';

// ═══════════════════════════════════════════════════════════════════════════════
// PARTNER API TYPES (for provisioning)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request to create a new channel (provision a number)
 */
export interface CreateChannelRequest {
  /** Client/Organization name */
  name: string;
  /** Phone number to provision (E.164 format) */
  phone: string;
  /** Webhook URL for this channel */
  webhookUrl?: string;
}

/**
 * Response from channel creation
 */
export interface CreateChannelResponse {
  /** Channel ID */
  id: string;
  /** API key for this channel */
  apiKey: string;
  /** Phone number */
  phone: string;
  /** Channel status */
  status: ChannelStatus;
  /** WABA ID (WhatsApp Business Account ID) */
  wabaId?: string;
  /** Phone Number ID */
  phoneNumberId?: string;
}

export type ChannelStatus =
  | 'pending'        // Awaiting verification
  | 'verified'       // Phone verified
  | 'active'         // Ready to send/receive
  | 'suspended'      // Temporarily suspended
  | 'deleted';       // Channel deleted

/**
 * Channel/Client details
 */
export interface Channel {
  id: string;
  name: string;
  phone: string;
  status: ChannelStatus;
  apiKey: string;
  wabaId?: string;
  phoneNumberId?: string;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Available phone number for provisioning
 */
export interface AvailableNumber {
  /** Phone number in E.164 format */
  phone: string;
  /** Display format */
  displayPhone: string;
  /** Country code (ISO 3166-1 alpha-2) */
  countryCode: string;
  /** Area/city code */
  areaCode?: string;
  /** Monthly cost in cents */
  monthlyCostCents?: number;
  /** Currency */
  currency?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WABA API TYPES (for messaging)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Send message request
 */
export interface SendMessageRequest {
  /** Recipient phone number (E.164 format) */
  to: string;
  /** Message type */
  type: 'text' | 'template' | 'interactive' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contacts';
  /** Text message content */
  text?: {
    body: string;
    preview_url?: boolean;
  };
  /** Template message content */
  template?: {
    namespace: string;
    name: string;
    language: {
      code: string;
      policy: 'deterministic';
    };
    components?: TemplateComponent[];
  };
  /** Interactive message content */
  interactive?: InteractiveMessage;
  /** Image content */
  image?: MediaContent;
  /** Video content */
  video?: MediaContent;
  /** Audio content */
  audio?: MediaContent;
  /** Document content */
  document?: MediaContent & { filename?: string };
  /** Sticker content */
  sticker?: { id?: string; link?: string };
  /** Location content */
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  /** Contacts content */
  contacts?: ContactContent[];
  /** Reply context */
  context?: {
    message_id: string;
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  sub_type?: 'quick_reply' | 'url';
  index?: number;
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface InteractiveMessage {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: {
    type: 'text' | 'image' | 'video' | 'document';
    text?: string;
    image?: { link: string };
    video?: { link: string };
    document?: { link: string; filename?: string };
  };
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: InteractiveAction;
}

export interface InteractiveAction {
  buttons?: Array<{
    type: 'reply';
    reply: {
      id: string;
      title: string;
    };
  }>;
  button?: string;
  sections?: Array<{
    title?: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface MediaContent {
  id?: string;
  link?: string;
  caption?: string;
}

export interface ContactContent {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{
    phone: string;
    type?: 'CELL' | 'MAIN' | 'HOME' | 'WORK';
    wa_id?: string;
  }>;
  emails?: Array<{
    email: string;
    type?: 'HOME' | 'WORK';
  }>;
}

/**
 * Send message response
 */
export interface SendMessageResponse {
  messages: Array<{
    id: string;
  }>;
  contacts?: Array<{
    input: string;
    wa_id: string;
  }>;
  meta?: {
    api_status: string;
    version: string;
  };
}

/**
 * API Error response
 */
export interface Dialog360Error {
  error: {
    code: number;
    title: string;
    message: string;
    details?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Webhook payload from 360dialog
 * Compatible with Meta Cloud API format
 */
export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: 'messages';
}

export interface WebhookValue {
  messaging_product: 'whatsapp';
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
  errors?: WebhookError[];
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WebhookMessageType;
  text?: { body: string };
  image?: WebhookMedia;
  video?: WebhookMedia;
  audio?: WebhookMedia & { voice?: boolean };
  document?: WebhookMedia & { filename?: string };
  sticker?: WebhookMedia & { animated?: boolean };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{
    name: { formatted_name: string };
    phones?: Array<{ phone: string }>;
  }>;
  reaction?: {
    message_id: string;
    emoji: string;
  };
  button?: {
    payload: string;
    text: string;
  };
  interactive?: {
    type: 'button_reply' | 'list_reply';
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  context?: {
    from: string;
    id: string;
    referred_product?: {
      catalog_id: string;
      product_retailer_id: string;
    };
  };
  referral?: {
    source_url: string;
    source_type: 'ad' | 'post';
    source_id: string;
    headline?: string;
    body?: string;
    media_type?: 'image' | 'video';
    image_url?: string;
    video_url?: string;
    thumbnail_url?: string;
  };
}

export type WebhookMessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'reaction'
  | 'button'
  | 'interactive'
  | 'order'
  | 'system'
  | 'unknown';

export interface WebhookMedia {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface WebhookStatus {
  id: string;
  recipient_id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  conversation?: {
    id: string;
    origin: {
      type: 'business_initiated' | 'user_initiated' | 'referral_conversion';
    };
    expiration_timestamp?: string;
  };
  pricing?: {
    pricing_model: 'CBP';
    billable: boolean;
    category: 'business_initiated' | 'user_initiated' | 'referral_conversion' | 'utility' | 'authentication' | 'marketing' | 'service';
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    error_data?: {
      details: string;
    };
  }>;
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE/ACCOUNT INFO TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Phone number info from 360dialog
 */
export interface PhoneInfo {
  /** Phone Number ID */
  id: string;
  /** Display phone number */
  display_phone_number: string;
  /** Verified name */
  verified_name?: string;
  /** Quality rating */
  quality_rating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  /** Messaging limit tier */
  messaging_limit_tier?: string;
  /** Account status */
  status?: string;
  /** Name status */
  name_status?: 'APPROVED' | 'PENDING' | 'DECLINED' | 'EXPIRED';
}

/**
 * Webhook configuration
 */
export interface WebhookConfig {
  url: string;
}

/**
 * Set webhook request/response
 */
export interface SetWebhookRequest {
  url: string;
}

export interface SetWebhookResponse {
  url: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Message template
 */
export interface MessageTemplate {
  id: string;
  name: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  language: string;
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEDIA TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Media upload response
 */
export interface MediaUploadResponse {
  id: string;
}

/**
 * Media download info
 */
export interface MediaInfo {
  messaging_product: 'whatsapp';
  url: string;
  mime_type: string;
  sha256: string;
  file_size: number;
  id: string;
}
