/**
 * WhatsApp BSP Provider Types
 * ===========================
 *
 * Type definitions for the BSP (Business Solution Provider) abstraction layer.
 * This allows CampoTech to support multiple WhatsApp providers:
 * - META_DIRECT: Organization's own Meta Business credentials
 * - DIALOG_360: 360dialog partner integration
 * - TWILIO: Twilio WhatsApp (future)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type BSPProviderType = 'META_DIRECT' | 'DIALOG_360' | 'TWILIO';

export type ProvisioningStatus =
  | 'NOT_STARTED'
  | 'NUMBER_SELECTED'
  | 'VERIFICATION_PENDING'
  | 'VERIFIED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'RELEASED';

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE NUMBER TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PhoneNumber {
  /** Provider's phone number ID */
  id: string;
  /** E.164 format phone number */
  phoneNumber: string;
  /** Display format (e.g., +54 11 1234-5678) */
  displayNumber: string;
  /** Country code (e.g., 'AR') */
  countryCode: string;
  /** Area/city code */
  areaCode?: string;
  /** Whether number is currently available for provisioning */
  available: boolean;
  /** Monthly cost (if applicable) */
  monthlyCost?: {
    amount: number;
    currency: string;
  };
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVISIONING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface ProvisionResult {
  success: boolean;
  /** Provider's phone number ID */
  phoneNumberId?: string;
  /** The provisioned phone number */
  phoneNumber?: string;
  /** Display format */
  displayNumber?: string;
  /** Current provisioning status */
  status: ProvisioningStatus;
  /** Error message if failed */
  error?: string;
  /** Next step required (if any) */
  nextStep?: 'VERIFY_CODE' | 'CONFIGURE_WEBHOOK' | 'AWAIT_APPROVAL';
  /** Provider-specific data */
  providerData?: Record<string, unknown>;
}

export interface VerificationResult {
  success: boolean;
  /** Updated status */
  status: ProvisioningStatus;
  /** Error message if failed */
  error?: string;
  /** Whether number is now ready to use */
  ready: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface OutboundMessage {
  /** Recipient phone number (E.164 format) */
  to: string;
  /** Message type */
  type: 'text' | 'template' | 'interactive' | 'media';
  /** Message content (depends on type) */
  content: TextContent | TemplateContent | InteractiveContent | MediaContent;
  /** Optional message ID for idempotency */
  idempotencyKey?: string;
  /** Reply to a specific message */
  replyTo?: string;
}

export interface TextContent {
  type: 'text';
  body: string;
  previewUrl?: boolean;
}

export interface TemplateContent {
  type: 'template';
  name: string;
  language: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: TemplateParameter[];
  subType?: 'quick_reply' | 'url';
  index?: number;
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

export interface InteractiveContent {
  type: 'interactive';
  interactiveType: 'button' | 'list' | 'product' | 'product_list';
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  buttons?: InteractiveButton[];
  sections?: InteractiveSection[];
}

export interface InteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename?: string };
}

export interface InteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface InteractiveSection {
  title: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

export interface MediaContent {
  type: 'media';
  mediaType: 'image' | 'video' | 'audio' | 'document';
  url?: string;
  mediaId?: string;
  caption?: string;
  filename?: string;
}

export interface SendResult {
  success: boolean;
  /** Provider's message ID */
  messageId?: string;
  /** WhatsApp message ID (wamid) */
  waMessageId?: string;
  /** Error message if failed */
  error?: string;
  /** Error code (if applicable) */
  errorCode?: string;
  /** Whether the error is retryable */
  retryable?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT STATUS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface AccountStatus {
  /** Is the account active and ready to send messages */
  active: boolean;
  /** Current provisioning status */
  provisioningStatus: ProvisioningStatus;
  /** Phone number details */
  phoneNumber?: {
    id: string;
    number: string;
    displayNumber: string;
  };
  /** Quality rating from Meta (if applicable) */
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
  /** Current messaging tier limit */
  messagingTier?: string;
  /** Account limits */
  limits?: {
    dailyConversations: number;
    monthlyConversations: number;
  };
  /** Any active issues or warnings */
  issues?: AccountIssue[];
}

export interface AccountIssue {
  type: 'WARNING' | 'ERROR' | 'RESTRICTION';
  code: string;
  message: string;
  actionRequired?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// USAGE STATISTICS TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface UsageStats {
  /** Billing period start */
  periodStart: Date;
  /** Billing period end */
  periodEnd: Date;
  /** Messages sent this period */
  messagesSent: number;
  /** Messages received this period */
  messagesReceived: number;
  /** Conversations opened this period */
  conversationsOpened: number;
  /** AI responses generated this period */
  aiResponses: number;
  /** Cost breakdown (if applicable) */
  costs?: {
    /** Total cost in cents */
    totalCents: number;
    /** Currency code */
    currency: string;
    /** Breakdown by type */
    breakdown: {
      userInitiated: number;
      businessInitiated: number;
      utility: number;
      marketing: number;
    };
  };
  /** Usage limits */
  limits: {
    monthlyMessages: number;
    used: number;
    remaining: number;
    percentUsed: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface WebhookConfig {
  /** Webhook URL */
  url: string;
  /** Verification token */
  verifyToken: string;
  /** Webhook secret for signature validation */
  secret?: string;
}

export interface InboundMessage {
  /** Message ID from provider */
  messageId: string;
  /** WhatsApp message ID (wamid) */
  waMessageId: string;
  /** Sender's phone number */
  from: string;
  /** Sender's profile name */
  fromName?: string;
  /** Message timestamp */
  timestamp: Date;
  /** Message type */
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'location' | 'contacts' | 'reaction' | 'button' | 'interactive';
  /** Message content (depends on type) */
  content: InboundContent;
  /** Context (if reply) */
  context?: {
    messageId: string;
    from?: string;
  };
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

export type InboundContent =
  | { type: 'text'; body: string }
  | { type: 'image'; id: string; mimeType: string; sha256?: string; caption?: string }
  | { type: 'video'; id: string; mimeType: string; sha256?: string; caption?: string }
  | { type: 'audio'; id: string; mimeType: string; sha256?: string; voice?: boolean }
  | { type: 'document'; id: string; mimeType: string; sha256?: string; filename?: string; caption?: string }
  | { type: 'sticker'; id: string; mimeType: string; animated?: boolean }
  | { type: 'location'; latitude: number; longitude: number; name?: string; address?: string }
  | { type: 'contacts'; contacts: Array<{ name: { formatted_name: string }; phones?: Array<{ phone: string }> }> }
  | { type: 'reaction'; messageId: string; emoji: string }
  | { type: 'button'; payload: string; text: string }
  | { type: 'interactive'; buttonReply?: { id: string; title: string }; listReply?: { id: string; title: string } };

export interface MessageStatusUpdate {
  /** Message ID */
  messageId: string;
  /** WhatsApp message ID */
  waMessageId: string;
  /** Recipient phone */
  recipient: string;
  /** New status */
  status: 'sent' | 'delivered' | 'read' | 'failed';
  /** Timestamp of status update */
  timestamp: Date;
  /** Error info if failed */
  error?: {
    code: string;
    title: string;
    message?: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * WhatsApp BSP Provider Interface
 *
 * This interface defines the contract that all WhatsApp BSP providers must implement.
 * It provides a unified API for:
 * - Number provisioning and management
 * - Message sending
 * - Webhook handling
 * - Account status and usage tracking
 */
export interface WhatsAppBSPProvider {
  /** Provider name (for logging and identification) */
  readonly name: BSPProviderType;

  /** Provider display name */
  readonly displayName: string;

  // ─────────────────────────────────────────────────────────────────────────────
  // Number Provisioning
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get list of available phone numbers for provisioning
   * @param countryCode - ISO country code (e.g., 'AR')
   * @param areaCode - Optional area code filter
   */
  getAvailableNumbers(countryCode: string, areaCode?: string): Promise<PhoneNumber[]>;

  /**
   * Start provisioning a phone number for an organization
   * @param organizationId - Organization ID
   * @param phoneNumber - Phone number to provision (E.164 format)
   */
  provisionNumber(organizationId: string, phoneNumber: string): Promise<ProvisionResult>;

  /**
   * Release a provisioned phone number
   * @param organizationId - Organization ID
   */
  releaseNumber(organizationId: string): Promise<void>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Verification
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send verification code to owner's phone
   * @param organizationId - Organization ID
   * @param ownerPhone - Owner's personal phone number for verification
   */
  sendVerificationCode(organizationId: string, ownerPhone: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Verify the code entered by owner
   * @param organizationId - Organization ID
   * @param code - Verification code
   */
  verifyCode(organizationId: string, code: string): Promise<VerificationResult>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Messaging
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a message
   * @param organizationId - Organization ID
   * @param message - Message to send
   */
  sendMessage(organizationId: string, message: OutboundMessage): Promise<SendResult>;

  /**
   * Send a template message
   * @param organizationId - Organization ID
   * @param to - Recipient phone number
   * @param templateName - Template name
   * @param language - Language code
   * @param components - Template components
   */
  sendTemplate(
    organizationId: string,
    to: string,
    templateName: string,
    language: string,
    components?: TemplateComponent[]
  ): Promise<SendResult>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Webhook
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get webhook configuration for an organization
   * @param organizationId - Organization ID
   */
  getWebhookConfig(organizationId: string): Promise<WebhookConfig>;

  /**
   * Verify webhook signature
   * @param payload - Raw request body
   * @param signature - Signature from request header
   * @param secret - Webhook secret
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;

  /**
   * Parse inbound message from webhook payload
   * @param payload - Webhook payload
   */
  parseInboundMessage(payload: unknown): InboundMessage | null;

  /**
   * Parse status update from webhook payload
   * @param payload - Webhook payload
   */
  parseStatusUpdate(payload: unknown): MessageStatusUpdate | null;

  // ─────────────────────────────────────────────────────────────────────────────
  // Status & Usage
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get account status for an organization
   * @param organizationId - Organization ID
   */
  getAccountStatus(organizationId: string): Promise<AccountStatus>;

  /**
   * Get usage statistics for an organization
   * @param organizationId - Organization ID
   */
  getUsageStats(organizationId: string): Promise<UsageStats>;

  // ─────────────────────────────────────────────────────────────────────────────
  // Provider Capabilities
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if provider supports number provisioning
   * (META_DIRECT does not, 360dialog does)
   */
  supportsProvisioning(): boolean;

  /**
   * Check if provider supports template messages
   */
  supportsTemplates(): boolean;

  /**
   * Check if provider supports interactive messages
   */
  supportsInteractive(): boolean;

  /**
   * Check if provider supports media messages
   */
  supportsMedia(): boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface MetaDirectConfig {
  phoneNumberId: string;
  businessAccountId?: string;
  accessToken: string;
  appSecret?: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

export interface Dialog360Config {
  apiKey: string;
  partnerId: string;
  webhookSecret?: string;
  apiBaseUrl?: string;
}

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
}

export type ProviderConfig = MetaDirectConfig | Dialog360Config | TwilioConfig;
