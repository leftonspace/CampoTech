# WhatsApp Business Integration Hub - Complete Implementation

## Context

You are working on CampoTech, a Field Service Management (FSM) platform for Argentine trades businesses (plumbers, electricians, HVAC). The platform has a WhatsApp module at `/dashboard/whatsapp` that needs to be fully functional.

**Target Market:** Argentina - where WhatsApp is the PRIMARY business communication channel (90%+ adoption)

**Current State:** The UI shell exists but integration status is unknown. Your job is to verify completeness and implement any missing functionality.

---

## Task Overview

Audit and complete the WhatsApp Business Integration Hub with full WhatsApp Cloud API integration. This module must handle:
- Centralized inbox for all customer conversations
- Outbound messaging with templates
- Real-time message sync
- Integration with Jobs, Customers, and Technicians
- Automated notifications

---

## Phase 1: Codebase Audit

### 1.1 File Structure Verification

Check if these files/folders exist and are properly implemented:

```
apps/web/app/dashboard/whatsapp/
├── page.tsx                    # Main WhatsApp inbox page
├── layout.tsx                  # Layout wrapper
├── components/
│   ├── ConversationList.tsx    # Left sidebar conversation list
│   ├── ConversationItem.tsx    # Individual conversation preview
│   ├── ChatWindow.tsx          # Main chat display area
│   ├── MessageBubble.tsx       # Individual message component
│   ├── MessageInput.tsx        # Message compose area
│   ├── TemplateSelector.tsx    # Template picker modal
│   ├── TemplatePreview.tsx     # Template preview with variables
│   ├── ContactInfo.tsx         # Customer info sidebar
│   ├── QuickActions.tsx        # Create job, view customer, etc.
│   └── SearchBar.tsx           # Conversation search
├── templates/
│   └── page.tsx                # Template management page

apps/web/app/api/whatsapp/
├── webhook/
│   └── route.ts                # Incoming webhook handler (GET for verification, POST for messages)
├── send/
│   └── route.ts                # Send message endpoint
├── conversations/
│   ├── route.ts                # List conversations
│   └── [conversationId]/
│       ├── route.ts            # Get conversation details
│       └── messages/
│           └── route.ts        # Get/send messages
├── templates/
│   ├── route.ts                # List/create templates
│   ├── sync/
│   │   └── route.ts            # Sync templates from Meta
│   └── [templateId]/
│       └── route.ts            # Get/update/delete template
├── media/
│   └── route.ts                # Upload/download media
└── contacts/
    └── route.ts                # Sync/manage contacts

src/integrations/whatsapp/
├── client.ts                   # WhatsApp Cloud API client
├── types.ts                    # TypeScript types for WhatsApp API
├── webhook-handler.ts          # Webhook processing logic
├── message-sender.ts           # Message sending utilities
├── template-manager.ts         # Template CRUD operations
├── media-handler.ts            # Media upload/download
└── conversation-manager.ts     # Conversation state management

src/modules/whatsapp/
├── service.ts                  # Business logic layer
├── repository.ts               # Database operations
└── notifications.ts            # Automated notification triggers
```

### 1.2 Database Schema Verification

Ensure these tables exist in the Prisma schema:

```prisma
// WhatsApp Business Account (one per organization)
model WhatsAppBusinessAccount {
  id                    String   @id @default(cuid())
  organizationId        String   @unique
  organization          Organization @relation(fields: [organizationId], references: [id])
  
  // Meta Business credentials
  phoneNumberId         String?  // WhatsApp Phone Number ID
  businessAccountId     String?  // WhatsApp Business Account ID
  accessToken           String?  // Encrypted access token
  accessTokenExpiresAt  DateTime?
  
  // Webhook configuration
  webhookVerifyToken    String   @default(cuid())
  webhookSecret         String?  // For signature verification
  
  // Status
  status                WhatsAppAccountStatus @default(PENDING)
  verifiedAt            DateTime?
  
  // Metadata
  displayPhoneNumber    String?  // +54 11 1234-5678
  businessName          String?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  conversations         WhatsAppConversation[]
  templates             WhatsAppTemplate[]
  
  @@index([organizationId])
}

enum WhatsAppAccountStatus {
  PENDING
  VERIFYING
  ACTIVE
  SUSPENDED
  DISCONNECTED
}

// Conversations (threads with customers)
model WhatsAppConversation {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])
  
  businessAccountId     String
  businessAccount       WhatsAppBusinessAccount @relation(fields: [businessAccountId], references: [id])
  
  // Contact info
  customerPhone         String   // +5491112345678
  customerName          String?
  customerId            String?  // Link to Customer record if exists
  customer              Customer? @relation(fields: [customerId], references: [id])
  
  // Conversation state
  status                ConversationStatus @default(OPEN)
  isUnread              Boolean  @default(true)
  lastMessageAt         DateTime?
  lastMessagePreview    String?  // First 100 chars of last message
  lastMessageDirection  MessageDirection?
  
  // 24-hour window tracking
  windowExpiresAt       DateTime? // When the 24h reply window closes
  canSendFreeform       Boolean  @default(false) // Can send without template
  
  // Assignment
  assignedToId          String?
  assignedTo            User?    @relation(fields: [assignedToId], references: [id])
  
  // Related entities
  activeJobId           String?  // Currently discussed job
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  messages              WhatsAppMessage[]
  
  @@unique([organizationId, customerPhone])
  @@index([organizationId, status])
  @@index([organizationId, isUnread])
  @@index([organizationId, lastMessageAt])
  @@index([customerId])
}

enum ConversationStatus {
  OPEN
  CLOSED
  ARCHIVED
  SPAM
}

enum MessageDirection {
  INBOUND
  OUTBOUND
}

// Individual messages
model WhatsAppMessage {
  id                    String   @id @default(cuid())
  organizationId        String
  
  conversationId        String
  conversation          WhatsAppConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  
  // WhatsApp message identifiers
  waMessageId           String   @unique // WhatsApp's message ID
  waTimestamp           DateTime // WhatsApp's timestamp
  
  // Message content
  direction             MessageDirection
  type                  MessageType
  content               Json     // Flexible content based on type
  
  // For outbound messages
  templateId            String?
  template              WhatsAppTemplate? @relation(fields: [templateId], references: [id])
  templateVariables     Json?    // Variables used in template
  
  // Status tracking (for outbound)
  status                MessageStatus @default(PENDING)
  statusUpdatedAt       DateTime?
  errorCode             String?
  errorMessage          String?
  
  // Sender info
  sentById              String?  // User who sent (for outbound)
  sentBy                User?    @relation(fields: [sentById], references: [id])
  
  // Media
  mediaId               String?
  mediaUrl              String?
  mediaMimeType         String?
  mediaFilename         String?
  
  createdAt             DateTime @default(now())
  
  @@index([conversationId, createdAt])
  @@index([waMessageId])
  @@index([organizationId, createdAt])
}

enum MessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  STICKER
  LOCATION
  CONTACTS
  TEMPLATE
  INTERACTIVE
  REACTION
  UNKNOWN
}

enum MessageStatus {
  PENDING
  SENT
  DELIVERED
  READ
  FAILED
}

// Message templates
model WhatsAppTemplate {
  id                    String   @id @default(cuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id])
  
  businessAccountId     String
  businessAccount       WhatsAppBusinessAccount @relation(fields: [businessAccountId], references: [id])
  
  // Meta template info
  waTemplateId          String?  // Meta's template ID
  name                  String   // Template name (lowercase, underscores)
  language              String   @default("es_AR")
  category              TemplateCategory
  
  // Content
  headerType            TemplateHeaderType?
  headerContent         String?  // Text or media URL
  bodyText              String   // Main message body with {{1}}, {{2}} placeholders
  footerText            String?
  
  // Buttons
  buttons               Json?    // Array of button objects
  
  // Status from Meta
  status                TemplateStatus @default(DRAFT)
  rejectionReason       String?
  
  // Usage tracking
  usageCount            Int      @default(0)
  lastUsedAt            DateTime?
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  messages              WhatsAppMessage[]
  
  @@unique([organizationId, name, language])
  @@index([organizationId, status])
  @@index([organizationId, category])
}

enum TemplateCategory {
  UTILITY           // Transactional (appointment reminders, job updates)
  MARKETING         // Promotional
  AUTHENTICATION    // OTP codes
}

enum TemplateHeaderType {
  TEXT
  IMAGE
  VIDEO
  DOCUMENT
}

enum TemplateStatus {
  DRAFT
  PENDING
  APPROVED
  REJECTED
  PAUSED
  DISABLED
}

// Webhook event log (for debugging and replay)
model WhatsAppWebhookLog {
  id                    String   @id @default(cuid())
  organizationId        String?
  
  // Request info
  eventType             String   // messages, message_status, etc.
  payload               Json     // Raw webhook payload
  signature             String?  // x-hub-signature-256
  
  // Processing
  processed             Boolean  @default(false)
  processedAt           DateTime?
  error                 String?
  
  receivedAt            DateTime @default(now())
  
  @@index([organizationId, receivedAt])
  @@index([processed])
}
```

### 1.3 Environment Variables Check

Verify these environment variables are documented/configured:

```env
# WhatsApp Cloud API
WHATSAPP_APP_ID=                    # Meta App ID
WHATSAPP_APP_SECRET=                # Meta App Secret (for webhook signature verification)
WHATSAPP_ACCESS_TOKEN=              # System User Access Token (or per-org tokens)
WHATSAPP_PHONE_NUMBER_ID=           # Default Phone Number ID
WHATSAPP_BUSINESS_ACCOUNT_ID=       # Default Business Account ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN=      # Webhook verification token
WHATSAPP_API_VERSION=v18.0          # Graph API version

# Optional
WHATSAPP_WEBHOOK_SECRET=            # For additional webhook security
```

---

## Phase 2: WhatsApp Cloud API Integration

### 2.1 API Client Implementation

Create/verify the WhatsApp Cloud API client:

```typescript
// src/integrations/whatsapp/client.ts

import axios, { AxiosInstance } from 'axios';

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}

export class WhatsAppClient {
  private client: AxiosInstance;
  private phoneNumberId: string;

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;
    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${config.apiVersion || 'v18.0'}`,
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  // Send text message
  async sendTextMessage(to: string, text: string): Promise<SendMessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    });
    return response.data;
  }

  // Send template message
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: TemplateComponent[]
  ): Promise<SendMessageResponse> {
    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
    return response.data;
  }

  // Send media message
  async sendMediaMessage(
    to: string,
    type: 'image' | 'video' | 'audio' | 'document',
    mediaIdOrUrl: string,
    caption?: string,
    filename?: string
  ): Promise<SendMessageResponse> {
    const mediaObject: any = mediaIdOrUrl.startsWith('http')
      ? { link: mediaIdOrUrl }
      : { id: mediaIdOrUrl };
    
    if (caption) mediaObject.caption = caption;
    if (filename && type === 'document') mediaObject.filename = filename;

    const response = await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type,
      [type]: mediaObject,
    });
    return response.data;
  }

  // Mark message as read
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    });
  }

  // Upload media
  async uploadMedia(file: Buffer, mimeType: string, filename: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', new Blob([file], { type: mimeType }), filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const response = await this.client.post(`/${this.phoneNumberId}/media`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.id;
  }

  // Download media
  async getMediaUrl(mediaId: string): Promise<string> {
    const response = await this.client.get(`/${mediaId}`);
    return response.data.url;
  }

  // Get templates
  async getTemplates(businessAccountId: string): Promise<Template[]> {
    const response = await this.client.get(
      `/${businessAccountId}/message_templates`,
      { params: { limit: 100 } }
    );
    return response.data.data;
  }

  // Create template
  async createTemplate(
    businessAccountId: string,
    template: CreateTemplateRequest
  ): Promise<Template> {
    const response = await this.client.post(
      `/${businessAccountId}/message_templates`,
      template
    );
    return response.data;
  }
}
```

### 2.2 Webhook Handler

Implement robust webhook handling:

```typescript
// apps/web/app/api/whatsapp/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import { processWebhookEvent } from '@/src/integrations/whatsapp/webhook-handler';

// GET: Webhook verification (Meta will call this to verify)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('WhatsApp webhook verified');
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse('Forbidden', { status: 403 });
}

// POST: Receive webhook events
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-hub-signature-256');

  // Verify signature
  if (!verifySignature(body, signature)) {
    console.error('Invalid WhatsApp webhook signature');
    return new NextResponse('Invalid signature', { status: 401 });
  }

  const payload = JSON.parse(body);

  // Log webhook for debugging
  await prisma.whatsAppWebhookLog.create({
    data: {
      eventType: payload.entry?.[0]?.changes?.[0]?.field || 'unknown',
      payload,
      signature,
    },
  });

  // Process asynchronously
  processWebhookEvent(payload).catch(console.error);

  // Always return 200 quickly to acknowledge receipt
  return new NextResponse('OK', { status: 200 });
}

function verifySignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.WHATSAPP_APP_SECRET) {
    return false;
  }

  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### 2.3 Webhook Event Processor

```typescript
// src/integrations/whatsapp/webhook-handler.ts

import { prisma } from '@/lib/prisma';
import { MessageDirection, MessageType, MessageStatus } from '@prisma/client';

interface WebhookPayload {
  object: string;
  entry: WebhookEntry[];
}

export async function processWebhookEvent(payload: WebhookPayload) {
  if (payload.object !== 'whatsapp_business_account') return;

  for (const entry of payload.entry) {
    const businessAccountId = entry.id;
    
    for (const change of entry.changes) {
      if (change.field === 'messages') {
        await processMessagesChange(businessAccountId, change.value);
      }
    }
  }
}

async function processMessagesChange(businessAccountId: string, value: any) {
  const phoneNumberId = value.metadata?.phone_number_id;
  
  // Find organization by phone number ID
  const businessAccount = await prisma.whatsAppBusinessAccount.findFirst({
    where: { phoneNumberId },
  });

  if (!businessAccount) {
    console.error(`No business account found for phone ${phoneNumberId}`);
    return;
  }

  // Process incoming messages
  if (value.messages) {
    for (const message of value.messages) {
      await processIncomingMessage(businessAccount, message, value.contacts);
    }
  }

  // Process status updates
  if (value.statuses) {
    for (const status of value.statuses) {
      await processStatusUpdate(status);
    }
  }
}

async function processIncomingMessage(
  businessAccount: WhatsAppBusinessAccount,
  message: any,
  contacts: any[]
) {
  const customerPhone = message.from;
  const contact = contacts?.find(c => c.wa_id === customerPhone);
  const customerName = contact?.profile?.name;

  // Find or create conversation
  let conversation = await prisma.whatsAppConversation.findUnique({
    where: {
      organizationId_customerPhone: {
        organizationId: businessAccount.organizationId,
        customerPhone,
      },
    },
  });

  // Try to match with existing customer
  const existingCustomer = await prisma.customer.findFirst({
    where: {
      organizationId: businessAccount.organizationId,
      phone: { contains: customerPhone.slice(-10) }, // Match last 10 digits
    },
  });

  if (!conversation) {
    conversation = await prisma.whatsAppConversation.create({
      data: {
        organizationId: businessAccount.organizationId,
        businessAccountId: businessAccount.id,
        customerPhone,
        customerName,
        customerId: existingCustomer?.id,
        status: 'OPEN',
        isUnread: true,
        canSendFreeform: true,
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
    });
  } else {
    // Update conversation
    await prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        customerName: customerName || conversation.customerName,
        isUnread: true,
        canSendFreeform: true,
        windowExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        lastMessageAt: new Date(parseInt(message.timestamp) * 1000),
        lastMessagePreview: extractMessagePreview(message),
        lastMessageDirection: 'INBOUND',
      },
    });
  }

  // Create message record
  await prisma.whatsAppMessage.create({
    data: {
      organizationId: businessAccount.organizationId,
      conversationId: conversation.id,
      waMessageId: message.id,
      waTimestamp: new Date(parseInt(message.timestamp) * 1000),
      direction: 'INBOUND',
      type: mapMessageType(message.type),
      content: extractMessageContent(message),
      status: 'DELIVERED',
    },
  });

  // TODO: Trigger real-time notification via WebSocket/Pusher
  // TODO: Send push notification to assigned user
}

async function processStatusUpdate(status: any) {
  const waMessageId = status.id;
  const newStatus = mapDeliveryStatus(status.status);

  await prisma.whatsAppMessage.updateMany({
    where: { waMessageId },
    data: {
      status: newStatus,
      statusUpdatedAt: new Date(parseInt(status.timestamp) * 1000),
      errorCode: status.errors?.[0]?.code?.toString(),
      errorMessage: status.errors?.[0]?.message,
    },
  });
}

function mapMessageType(type: string): MessageType {
  const typeMap: Record<string, MessageType> = {
    text: 'TEXT',
    image: 'IMAGE',
    video: 'VIDEO',
    audio: 'AUDIO',
    document: 'DOCUMENT',
    sticker: 'STICKER',
    location: 'LOCATION',
    contacts: 'CONTACTS',
    interactive: 'INTERACTIVE',
    reaction: 'REACTION',
  };
  return typeMap[type] || 'UNKNOWN';
}

function mapDeliveryStatus(status: string): MessageStatus {
  const statusMap: Record<string, MessageStatus> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };
  return statusMap[status] || 'PENDING';
}

function extractMessageContent(message: any): any {
  switch (message.type) {
    case 'text':
      return { text: message.text?.body };
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return {
        mediaId: message[message.type]?.id,
        mimeType: message[message.type]?.mime_type,
        caption: message[message.type]?.caption,
        filename: message[message.type]?.filename,
      };
    case 'location':
      return {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address,
      };
    case 'reaction':
      return {
        emoji: message.reaction?.emoji,
        messageId: message.reaction?.message_id,
      };
    default:
      return message;
  }
}

function extractMessagePreview(message: any): string {
  switch (message.type) {
    case 'text':
      return message.text?.body?.slice(0, 100) || '';
    case 'image':
      return '📷 Imagen';
    case 'video':
      return '🎥 Video';
    case 'audio':
      return '🎵 Audio';
    case 'document':
      return `📄 ${message.document?.filename || 'Documento'}`;
    case 'sticker':
      return '🎨 Sticker';
    case 'location':
      return '📍 Ubicación';
    default:
      return '';
  }
}
```

---

## Phase 3: UI Components

### 3.1 Main Inbox Page

```typescript
// apps/web/app/dashboard/whatsapp/page.tsx

'use client';

import { useState } from 'react';
import { ConversationList } from './components/ConversationList';
import { ChatWindow } from './components/ChatWindow';
import { ContactInfo } from './components/ContactInfo';

export default function WhatsAppPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showContactInfo, setShowContactInfo] = useState(false);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Conversation List - Left Sidebar */}
      <div className="w-80 border-r flex flex-col">
        <ConversationList
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
        />
      </div>

      {/* Chat Window - Center */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <ChatWindow
            conversationId={selectedConversationId}
            onShowContactInfo={() => setShowContactInfo(!showContactInfo)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <WhatsAppIcon className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Seleccioná una conversación para ver los mensajes</p>
            </div>
          </div>
        )}
      </div>

      {/* Contact Info - Right Sidebar */}
      {showContactInfo && selectedConversationId && (
        <div className="w-80 border-l">
          <ContactInfo
            conversationId={selectedConversationId}
            onClose={() => setShowContactInfo(false)}
          />
        </div>
      )}
    </div>
  );
}
```

### 3.2 Required UI Features Checklist

Verify ALL these features are implemented:

#### Conversation List
- [ ] Search conversations by customer name/phone
- [ ] Filter: Todas / No leídas / En ventana
- [ ] Sort by last message time (newest first)
- [ ] Show unread count badge
- [ ] Show last message preview
- [ ] Show 24h window indicator (green dot if can reply freely)
- [ ] Show customer avatar or initials
- [ ] Infinite scroll / pagination
- [ ] Real-time updates when new messages arrive

#### Chat Window
- [ ] Display message history (infinite scroll up)
- [ ] Message bubbles (different styles for sent/received)
- [ ] Message timestamps
- [ ] Message status indicators (sent ✓, delivered ✓✓, read ✓✓ blue)
- [ ] Media display (images, videos, audio player, documents)
- [ ] Location display with map preview
- [ ] Reply input field
- [ ] Send button (disabled if outside 24h window and no template selected)
- [ ] Template selector button
- [ ] Attach media button
- [ ] Emoji picker
- [ ] "Sending..." and error states
- [ ] Auto-scroll to bottom on new message
- [ ] Window expiration warning banner

#### Template Selector
- [ ] List all approved templates
- [ ] Search/filter templates
- [ ] Template preview with variable placeholders
- [ ] Variable input form
- [ ] Send with template button
- [ ] Category filter (Utility, Marketing, etc.)

#### Contact Info Sidebar
- [ ] Customer name and phone
- [ ] Link to customer profile (if matched)
- [ ] Button: "Ver Cliente" / "Crear Cliente"
- [ ] Recent jobs with this customer
- [ ] Button: "Crear Trabajo"
- [ ] Conversation assignment dropdown
- [ ] Close/archive conversation button
- [ ] Shared media gallery

#### Quick Actions
- [ ] Create job from conversation
- [ ] Link existing job to conversation
- [ ] Add customer note
- [ ] Assign conversation to team member

---

## Phase 4: Automated Notifications

### 4.1 Notification Triggers

Implement automated WhatsApp messages for these events:

```typescript
// src/modules/whatsapp/notifications.ts

export async function sendJobCreatedNotification(job: Job) {
  // Template: job_created
  // Variables: customer_name, job_date, job_time, technician_name
}

export async function sendTechnicianEnRouteNotification(job: Job) {
  // Template: technician_en_route
  // Variables: customer_name, technician_name, eta_minutes
}

export async function sendTechnicianArrivedNotification(job: Job) {
  // Template: technician_arrived
  // Variables: customer_name, technician_name
}

export async function sendJobCompletedNotification(job: Job) {
  // Template: job_completed
  // Variables: customer_name, job_summary, total_amount
}

export async function sendInvoiceNotification(invoice: Invoice) {
  // Template: invoice_ready
  // Variables: customer_name, invoice_number, total_amount, payment_link
}

export async function sendPaymentConfirmation(payment: Payment) {
  // Template: payment_received
  // Variables: customer_name, amount, invoice_number
}

export async function sendAppointmentReminder(job: Job) {
  // Template: appointment_reminder
  // Variables: customer_name, job_date, job_time, technician_name
  // Send 24h and 2h before appointment
}
```

### 4.2 Default Templates to Create

Create these templates in Meta Business Manager:

| Template Name | Category | Body (Spanish) |
|---------------|----------|----------------|
| `job_scheduled` | UTILITY | Hola {{1}}, tu trabajo fue agendado para el {{2}} a las {{3}}. Tu técnico será {{4}}. |
| `technician_en_route` | UTILITY | Hola {{1}}, {{2}} está en camino. Tiempo estimado de llegada: {{3}} minutos. |
| `technician_arrived` | UTILITY | Hola {{1}}, {{2}} llegó a tu domicilio. |
| `job_completed` | UTILITY | Hola {{1}}, el trabajo fue completado. Resumen: {{2}}. Total: ${{3}} |
| `invoice_ready` | UTILITY | Hola {{1}}, tu factura #{{2}} está lista. Total: ${{3}}. Pagá aquí: {{4}} |
| `payment_received` | UTILITY | Hola {{1}}, recibimos tu pago de ${{2}} para la factura #{{3}}. ¡Gracias! |
| `appointment_reminder` | UTILITY | Recordatorio: Hola {{1}}, mañana {{2}} a las {{3}} te visita {{4}}. |

---

## Phase 5: Real-Time Updates

### 5.1 WebSocket/Pusher Integration

Implement real-time message delivery:

```typescript
// Options: Pusher, Ably, Socket.io, or Supabase Realtime

// When new message arrives via webhook:
await pusher.trigger(
  `org-${organizationId}-whatsapp`,
  'new-message',
  {
    conversationId,
    message: { ... }
  }
);

// Client subscribes:
useEffect(() => {
  const channel = pusher.subscribe(`org-${orgId}-whatsapp`);
  channel.bind('new-message', handleNewMessage);
  return () => channel.unsubscribe();
}, [orgId]);
```

---

## Phase 6: Testing Requirements

### 6.1 Integration Tests

```typescript
describe('WhatsApp Integration', () => {
  // Webhook tests
  it('should verify webhook with correct token', async () => {});
  it('should reject webhook with incorrect token', async () => {});
  it('should reject webhook with invalid signature', async () => {});
  it('should process incoming text message', async () => {});
  it('should process incoming image message', async () => {});
  it('should update message status on delivery', async () => {});
  it('should create conversation for new contact', async () => {});
  it('should match conversation to existing customer', async () => {});
  
  // Sending tests
  it('should send text message within 24h window', async () => {});
  it('should require template outside 24h window', async () => {});
  it('should send template with variables', async () => {});
  it('should upload and send media', async () => {});
  
  // Template tests
  it('should sync templates from Meta', async () => {});
  it('should create new template', async () => {});
  
  // Org isolation
  it('should not show conversations from other orgs', async () => {});
  it('should not allow sending to other org conversations', async () => {});
});
```

### 6.2 Manual Test Checklist

- [ ] Webhook verification works in Meta dashboard
- [ ] Incoming message appears in inbox
- [ ] Can reply to message within 24h window
- [ ] Cannot send freeform outside 24h window
- [ ] Can send template outside 24h window
- [ ] Message status updates (sent → delivered → read)
- [ ] Media messages display correctly
- [ ] Search works
- [ ] Filters work
- [ ] Real-time updates work
- [ ] Contact matching works
- [ ] Quick actions (create job, etc.) work
- [ ] Template management works

---

## Phase 7: Security Checklist

- [ ] Access tokens encrypted at rest
- [ ] Webhook signature verified on every request
- [ ] Organization isolation enforced on all queries
- [ ] Rate limiting on send endpoints
- [ ] Audit logging for all messages
- [ ] No sensitive data in error messages
- [ ] Media URLs signed and time-limited
- [ ] HTTPS only for all endpoints

---

## Deliverables

After completing this implementation, provide:

1. **Audit Report**: List of what was missing vs. what existed
2. **Database Migration**: Any new tables/columns needed
3. **API Documentation**: OpenAPI spec for WhatsApp endpoints
4. **Setup Guide**: Steps to connect Meta Business account
5. **Test Results**: All tests passing
6. **Screenshots**: Working UI with sample conversations

---

## Notes for Argentine Market

- Default language: `es_AR` (not `es` or `es_ES`)
- Phone format: `+549XXXXXXXXXX` (note the 9 after 54 for mobile)
- Common issues: Users may have +54 9 or +54 without 9
- Handle both formats in phone matching
- Templates must be approved by Meta (24-72h process)
- Utility templates have higher approval rate than Marketing
