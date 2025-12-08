/**
 * WhatsApp Integration Types
 * ==========================
 *
 * Type definitions for WhatsApp Business API integration.
 * Supports Cloud API (Meta) and template messages.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface WhatsAppConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  webhookVerifyToken: string;
  appSecret: string;
  apiVersion: string;
}

export const WA_API_BASE_URL = 'https://graph.facebook.com';
export const WA_API_VERSION = 'v18.0';

// ═══════════════════════════════════════════════════════════════════════════════
// WEBHOOK TYPES
// ═══════════════════════════════════════════════════════════════════════════════

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
  messagingProduct: 'whatsapp';
  metadata: {
    displayPhoneNumber: string;
    phoneNumberId: string;
  };
  contacts?: WebhookContact[];
  messages?: InboundMessage[];
  statuses?: MessageStatus[];
  errors?: WebhookError[];
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  waId: string;
}

export interface WebhookError {
  code: number;
  title: string;
  message: string;
  errorData?: {
    details: string;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// INBOUND MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export type InboundMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'reaction';

export interface InboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: InboundMessageType;
  text?: {
    body: string;
  };
  image?: MediaMessage;
  audio?: MediaMessage;
  video?: MediaMessage;
  document?: MediaMessage & { filename?: string };
  sticker?: MediaMessage;
  location?: LocationMessage;
  contacts?: ContactMessage[];
  interactive?: InteractiveResponse;
  button?: ButtonResponse;
  reaction?: ReactionMessage;
  context?: MessageContext;
}

export interface MediaMessage {
  id: string;
  mimeType: string;
  sha256?: string;
  caption?: string;
}

export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactMessage {
  name: {
    formattedName: string;
    firstName?: string;
    lastName?: string;
  };
  phones?: Array<{
    phone: string;
    type?: string;
    waId?: string;
  }>;
}

export interface InteractiveResponse {
  type: 'button_reply' | 'list_reply';
  buttonReply?: {
    id: string;
    title: string;
  };
  listReply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface ButtonResponse {
  payload: string;
  text: string;
}

export interface ReactionMessage {
  messageId: string;
  emoji: string;
}

export interface MessageContext {
  from: string;
  id: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE STATUS
// ═══════════════════════════════════════════════════════════════════════════════

export type MessageStatusType = 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageStatus {
  id: string;
  status: MessageStatusType;
  timestamp: string;
  recipientId: string;
  conversation?: {
    id: string;
    origin: {
      type: 'business_initiated' | 'user_initiated' | 'referral_conversion';
    };
    expirationTimestamp?: string;
  };
  pricing?: {
    billable: boolean;
    pricingModel: string;
    category: string;
  };
  errors?: Array<{
    code: number;
    title: string;
    message?: string;
    errorData?: { details: string };
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// OUTBOUND MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SendMessageRequest {
  messagingProduct: 'whatsapp';
  recipientType: 'individual';
  to: string;
  type: OutboundMessageType;
  text?: TextMessage;
  template?: TemplateMessage;
  image?: OutboundMedia;
  document?: OutboundMedia;
  audio?: OutboundMedia;
  video?: OutboundMedia;
  interactive?: InteractiveMessage;
  contacts?: ContactMessage[];
  location?: LocationMessage;
}

export type OutboundMessageType =
  | 'text'
  | 'template'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'interactive'
  | 'contacts'
  | 'location';

export interface TextMessage {
  body: string;
  previewUrl?: boolean;
}

export interface OutboundMedia {
  id?: string;
  link?: string;
  caption?: string;
  filename?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: TemplateComponent[];
}

export type TemplateComponentType = 'header' | 'body' | 'button';

export interface TemplateComponent {
  type: TemplateComponentType;
  subType?: 'quick_reply' | 'url';
  index?: number;
  parameters: TemplateParameter[];
}

export type TemplateParameterType = 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';

export interface TemplateParameter {
  type: TemplateParameterType;
  text?: string;
  currency?: {
    fallbackValue: string;
    code: string;
    amount1000: number;
  };
  dateTime?: {
    fallbackValue: string;
  };
  image?: OutboundMedia;
  document?: OutboundMedia;
  video?: OutboundMedia;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERACTIVE MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════

export interface InteractiveMessage {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: InteractiveHeader;
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: InteractiveAction;
}

export interface InteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: OutboundMedia;
  video?: OutboundMedia;
  document?: OutboundMedia;
}

export interface InteractiveAction {
  buttons?: InteractiveButton[];
  button?: string;
  sections?: InteractiveSection[];
}

export interface InteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface InteractiveSection {
  title?: string;
  rows: Array<{
    id: string;
    title: string;
    description?: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SendMessageResponse {
  messagingProduct: 'whatsapp';
  contacts: Array<{
    input: string;
    waId: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

export interface MediaUploadResponse {
  id: string;
}

export interface MediaUrlResponse {
  url: string;
  mimeType: string;
  sha256: string;
  fileSize: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type WAMessageDirection = 'inbound' | 'outbound';

export interface WAMessageRecord {
  id: string;
  orgId: string;
  customerId?: string;
  waMessageId: string;
  direction: WAMessageDirection;
  type: InboundMessageType | OutboundMessageType;
  from: string;
  to: string;
  content: string;
  mediaUrl?: string;
  mediaType?: string;
  templateName?: string;
  status: MessageStatusType | 'pending' | 'queued';
  statusUpdatedAt?: Date;
  errorCode?: number;
  errorMessage?: string;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WAConversation {
  id: string;
  orgId: string;
  customerId: string;
  customerPhone: string;
  customerName?: string;
  lastMessageAt: Date;
  lastMessagePreview: string;
  unreadCount: number;
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════════

export interface TemplateDefinition {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  components: Array<{
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
    text?: string;
    example?: {
      headerText?: string[];
      bodyText?: string[][];
    };
    buttons?: Array<{
      type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
      text: string;
      url?: string;
      phoneNumber?: string;
    }>;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

export type WAErrorType = 'transient' | 'permanent' | 'rate_limit' | 'authentication';

export interface WAError {
  code: number;
  message: string;
  errorSubcode?: number;
  fbtraceId?: string;
}

export const WA_ERROR_CODES: Record<number, { type: WAErrorType; message: string }> = {
  0: { type: 'transient', message: 'Error interno' },
  4: { type: 'rate_limit', message: 'Límite de rate excedido' },
  100: { type: 'permanent', message: 'Parámetro inválido' },
  130429: { type: 'rate_limit', message: 'Límite de mensajes alcanzado' },
  131000: { type: 'permanent', message: 'Algo salió mal' },
  131005: { type: 'permanent', message: 'Acceso denegado' },
  131008: { type: 'permanent', message: 'Parámetro requerido faltante' },
  131009: { type: 'permanent', message: 'Parámetro inválido' },
  131021: { type: 'permanent', message: 'Receptor no válido' },
  131026: { type: 'permanent', message: 'Mensaje no entregable' },
  131047: { type: 'transient', message: 'Reenviar en 24 horas' },
  131051: { type: 'permanent', message: 'Tipo de mensaje no soportado' },
  131052: { type: 'permanent', message: 'Descarga de media falló' },
  132000: { type: 'permanent', message: 'Cantidad de parámetros de template incorrecta' },
  132001: { type: 'permanent', message: 'Template no existe' },
  132005: { type: 'permanent', message: 'Template en texto incorrecto' },
  132007: { type: 'permanent', message: 'Formato de template incorrecto' },
  132012: { type: 'permanent', message: 'Template pausado' },
  132015: { type: 'permanent', message: 'Template rechazado' },
  133000: { type: 'permanent', message: 'Usuario bloqueó mensajes' },
  133004: { type: 'transient', message: 'Servidor no disponible' },
  133010: { type: 'permanent', message: 'Número de teléfono no registrado' },
  190: { type: 'authentication', message: 'Token de acceso inválido' },
};

export function classifyWAError(error: WAError): WAErrorType {
  const known = WA_ERROR_CODES[error.code];
  if (known) return known.type;

  if (error.code >= 130429 && error.code <= 130500) return 'rate_limit';
  if (error.code >= 190 && error.code < 200) return 'authentication';

  return 'permanent';
}
