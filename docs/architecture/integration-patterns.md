# CampoTech Integration Patterns

**Version:** 1.0
**Last Updated:** December 2024
**Phase:** 9.11 Technical Architecture Documentation

## Overview

This document describes the patterns and best practices used for integrating external services in CampoTech. All integrations follow consistent patterns for resilience, observability, and maintainability.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         INTEGRATION LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                      COMMON PATTERNS                                    │   │
│   │                                                                         │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│   │  │   Circuit    │  │   Retry      │  │   Rate       │  │  Response  │  │   │
│   │  │   Breaker    │  │   with       │  │   Limiter    │  │  Caching   │  │   │
│   │  │              │  │   Backoff    │  │              │  │            │  │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │   │
│   │                                                                         │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │   │
│   │  │   Webhook    │  │   Queue      │  │   Health     │  │  Fallback  │  │   │
│   │  │   Handler    │  │   Based      │  │   Checks     │  │  Behavior  │  │   │
│   │  │              │  │   Delivery   │  │              │  │            │  │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│   ┌───────────────────────────────────────────────────────────────────────────┐ │
│   │                       EXTERNAL SERVICES                                   │ │
│   │                                                                           │ │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │ │
│   │  │  WhatsApp   │  │ MercadoPago │  │    AFIP     │  │   OpenAI    │     │ │
│   │  │  Business   │  │             │  │  WSAA/WSFE  │  │  Whisper+   │     │ │
│   │  │    API      │  │             │  │             │  │    GPT      │     │ │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘     │ │
│   │                                                                           │ │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                       │ │
│   │  │   Google    │  │   Mapbox    │  │   Twilio    │                       │ │
│   │  │    Maps     │  │             │  │    SMS      │                       │ │
│   │  │             │  │             │  │             │                       │ │
│   │  └─────────────┘  └─────────────┘  └─────────────┘                       │ │
│   └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Common Patterns

### 1. Circuit Breaker

Prevents cascading failures when external services are unavailable.

```typescript
// src/lib/circuit-breaker.ts

interface CircuitBreakerConfig {
  failureThreshold: number;    // Failures before opening
  successThreshold: number;    // Successes to close
  timeout: number;             // Time before half-open (ms)
}

class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailure?: Date;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        throw new CircuitOpenError();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    }
    this.failures = 0;
  }

  private onFailure() {
    this.failures++;
    this.lastFailure = new Date();
    if (this.failures >= this.config.failureThreshold) {
      this.state = 'open';
    }
  }
}

// Usage per service
const CIRCUIT_CONFIGS: Record<string, CircuitBreakerConfig> = {
  whatsapp: { failureThreshold: 5, successThreshold: 2, timeout: 30000 },
  mercadopago: { failureThreshold: 3, successThreshold: 2, timeout: 60000 },
  afip: { failureThreshold: 3, successThreshold: 1, timeout: 120000 },
  openai: { failureThreshold: 5, successThreshold: 2, timeout: 30000 }
};
```

### 2. Retry with Exponential Backoff

Handles transient failures with intelligent retry logic.

```typescript
// src/lib/retry.ts

interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;       // Initial delay in ms
  maxDelay: number;        // Maximum delay in ms
  retryableErrors: string[]; // Error codes to retry
}

async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error, config.retryableErrors)) {
        throw error;
      }

      if (attempt === config.maxAttempts) {
        break;
      }

      const delay = Math.min(
        config.baseDelay * Math.pow(2, attempt - 1) + jitter(),
        config.maxDelay
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

// Per-service retry configs
const RETRY_CONFIGS: Record<string, RetryConfig> = {
  whatsapp: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', '429', '503']
  },
  afip: {
    maxAttempts: 5,
    baseDelay: 2000,
    maxDelay: 30000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'cuit_locked']
  }
};
```

### 3. Webhook Handler Pattern

Standard pattern for receiving external webhooks.

```typescript
// apps/web/app/api/webhooks/[service]/route.ts

interface WebhookHandler {
  // 1. Verify signature
  verifySignature(req: Request): Promise<boolean>;

  // 2. Parse payload
  parsePayload(body: string): Promise<WebhookPayload>;

  // 3. Acknowledge quickly (< 200ms)
  acknowledge(): NextResponse;

  // 4. Process asynchronously
  processAsync(payload: WebhookPayload): Promise<void>;
}

// Generic webhook endpoint
export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('x-signature');

  // 1. Verify signature immediately
  if (!verifySignature(signature, body, SECRET)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // 2. Parse payload
  const payload = JSON.parse(body);

  // 3. Queue for async processing
  await queue.add('webhook-process', {
    service: 'whatsapp',
    payload,
    receivedAt: new Date()
  });

  // 4. Acknowledge immediately
  return NextResponse.json({ received: true }, { status: 200 });
}
```

### 4. Queue-Based Delivery

Ensures reliable delivery for critical operations.

```typescript
// src/lib/queue/index.ts

import { Queue, Worker, Job } from 'bullmq';

// Queue configuration per service
const QUEUE_CONFIGS = {
  'whatsapp-send': {
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 1000
    }
  },
  'invoice-generate': {
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
      timeout: 60000
    }
  }
};

// Worker with error handling
const worker = new Worker('whatsapp-send', async (job: Job) => {
  try {
    await processWhatsAppMessage(job.data);
  } catch (error) {
    // Log for monitoring
    await logJobError(job, error);

    // Determine if retryable
    if (isRetryableError(error)) {
      throw error; // BullMQ will retry
    } else {
      // Move to dead letter queue
      await deadLetterQueue.add('failed', {
        originalJob: job.data,
        error: error.message
      });
    }
  }
});
```

## Integration Details

### WhatsApp Business API

**Location:** `src/integrations/whatsapp/`

```
whatsapp/
├── whatsapp.service.ts       # Main service
├── messages/
│   ├── send.ts              # Message sending
│   ├── templates.ts         # Template management
│   └── media.ts             # Media handling
├── webhook/
│   ├── handler.ts           # Webhook processing
│   ├── events.ts            # Event types
│   └── signature.ts         # Signature verification
├── aggregation/
│   ├── message-aggregator.service.ts
│   └── buffer.ts            # Redis buffer management
├── templates/
│   ├── template-registry.ts # Template registration
│   └── argentina-templates.ts
└── customer/
    └── identification.ts    # Customer matching
```

**Key Patterns:**
- Message aggregation (8-second window)
- Template-based messages (Meta approved)
- 24-hour session window enforcement
- Webhook signature verification

```typescript
// Send template message
async function sendTemplateMessage(
  to: string,
  template: string,
  parameters: Record<string, string>
): Promise<SendResult> {
  return circuitBreaker.execute(async () => {
    const response = await withRetry(
      () => whatsappApi.post('/messages', {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: 'es_AR' },
          components: buildComponents(parameters)
        }
      }),
      RETRY_CONFIGS.whatsapp
    );

    return response.data;
  });
}
```

### MercadoPago

**Location:** `src/integrations/mercadopago/`

```
mercadopago/
├── mercadopago.service.ts   # Main service
├── oauth/
│   ├── connect.ts           # OAuth flow
│   └── tokens.ts            # Token management
├── preference/
│   └── create.ts            # Payment preferences
├── webhook/
│   └── handler.ts           # IPN handling
├── chargeback/
│   └── handler.ts           # Dispute management
└── cuotas/
    └── calculator.ts        # Installment calculation
```

**Key Patterns:**
- OAuth marketplace model
- Webhook IPN notifications
- Idempotency keys for payments
- Chargeback handling

```typescript
// Create payment preference
async function createPaymentPreference(
  invoice: Invoice,
  organizationCredentials: MPCredentials
): Promise<PreferenceResponse> {
  const idempotencyKey = `invoice-${invoice.id}`;

  return withRetry(
    () => mercadopagoApi.post(
      '/checkout/preferences',
      {
        items: mapInvoiceItems(invoice),
        payer: mapCustomer(invoice.customer),
        external_reference: invoice.id,
        notification_url: `${BASE_URL}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${BASE_URL}/invoices/${invoice.id}?status=success`,
          failure: `${BASE_URL}/invoices/${invoice.id}?status=failure`
        }
      },
      {
        headers: {
          'X-Idempotency-Key': idempotencyKey,
          'Authorization': `Bearer ${organizationCredentials.accessToken}`
        }
      }
    ),
    RETRY_CONFIGS.mercadopago
  );
}
```

### AFIP (Argentine Tax Authority)

**Location:** `src/integrations/afip/`

```
afip/
├── afip.service.ts          # Main service
├── wsaa/
│   ├── auth.ts              # WSAA authentication
│   └── token-manager.ts     # Token caching
├── wsfe/
│   ├── invoice.ts           # Electronic invoicing
│   ├── last-voucher.ts      # Last invoice query
│   └── types.ts             # AFIP data types
├── padron/
│   └── query.ts             # Tax payer lookup
└── qr/
    └── generator.ts         # QR code generation
```

**Key Patterns:**
- WSAA token caching (12h validity, 10min safety margin)
- Certificate-based authentication
- Sequential invoice numbering
- QR code per RG 4291

```typescript
// WSAA Token management
class WSAATokenManager {
  private tokenCache: Map<string, WSAAToken> = new Map();

  async getToken(cuit: string, service: string): Promise<string> {
    const cacheKey = `${cuit}:${service}`;
    const cached = this.tokenCache.get(cacheKey);

    // Check if token is valid with 10-minute safety margin
    if (cached && cached.expiresAt > Date.now() + 600000) {
      return cached.token;
    }

    // Request new token
    const token = await this.requestToken(cuit, service);
    this.tokenCache.set(cacheKey, token);
    return token.token;
  }

  private async requestToken(cuit: string, service: string): Promise<WSAAToken> {
    const tra = buildTRA(service);
    const cms = signWithCertificate(tra, certificate, privateKey);

    const response = await afipClient.post('/wsaa/LoginCms', {
      in0: cms
    });

    return parseLoginResponse(response);
  }
}
```

### OpenAI (Voice AI)

**Location:** `src/integrations/voice-ai/`

```
voice-ai/
├── voice-ai.service.ts      # Main service
├── transcription/
│   └── whisper.ts           # Whisper API
├── extraction/
│   ├── gpt.ts               # GPT extraction
│   └── prompts/
│       ├── job-request.ts
│       └── customer-query.ts
└── routing/
    └── intent-router.ts     # Intent classification
```

**Key Patterns:**
- Audio format conversion (OGG → MP3)
- Streaming for large files
- Prompt engineering for extraction
- Fallback to text when audio fails

```typescript
// Voice message processing pipeline
async function processVoiceMessage(
  audioUrl: string,
  context: ConversationContext
): Promise<ProcessingResult> {
  // 1. Download and convert audio
  const audioBuffer = await downloadMedia(audioUrl);
  const mp3Buffer = await convertToMp3(audioBuffer);

  // 2. Transcribe with Whisper
  const transcription = await withRetry(
    () => openai.audio.transcriptions.create({
      file: mp3Buffer,
      model: 'whisper-1',
      language: 'es'
    }),
    RETRY_CONFIGS.openai
  );

  // 3. Extract intent with GPT
  const extraction = await withRetry(
    () => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        { role: 'user', content: transcription.text }
      ],
      response_format: { type: 'json_object' }
    }),
    RETRY_CONFIGS.openai
  );

  return JSON.parse(extraction.choices[0].message.content);
}
```

### Map Providers

**Location:** `apps/web/components/maps/`

```
maps/
├── map-providers.ts         # Provider abstraction
├── marker-animation.ts      # Smooth animations
├── TrackingMap.tsx          # React component
└── index.ts
```

**Key Patterns:**
- Tier-based provider selection
- Fallback chain (Google → Mapbox → OSM)
- Client-side route rendering
- Smooth marker animation

```typescript
// Tier-based map provider selection
function getMapProvider(tier: 'free' | 'standard' | 'enterprise'): MapProvider {
  switch (tier) {
    case 'enterprise':
      return new GoogleMapsProvider(GOOGLE_API_KEY);
    case 'standard':
      return new MapboxProvider(MAPBOX_TOKEN);
    case 'free':
    default:
      return new OpenStreetMapProvider();
  }
}

// Provider interface
interface MapProvider {
  getTileUrl(): string;
  calculateRoute(from: LatLng, to: LatLng): Promise<Route>;
  geocode(address: string): Promise<LatLng>;
  reverseGeocode(point: LatLng): Promise<string>;
}
```

## Error Handling

### Error Categories

```typescript
// Standard error categories
enum IntegrationErrorCategory {
  TRANSIENT = 'transient',     // Retry possible
  CLIENT = 'client',           // Bad request, don't retry
  AUTH = 'auth',               // Re-authenticate
  RATE_LIMIT = 'rate_limit',   // Back off
  SERVICE = 'service',         // External service down
  UNKNOWN = 'unknown'          // Log and investigate
}

// Error classification
function categorizeError(error: Error, service: string): IntegrationErrorCategory {
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET') {
    return IntegrationErrorCategory.TRANSIENT;
  }

  if (error.status === 401 || error.status === 403) {
    return IntegrationErrorCategory.AUTH;
  }

  if (error.status === 429) {
    return IntegrationErrorCategory.RATE_LIMIT;
  }

  if (error.status >= 500) {
    return IntegrationErrorCategory.SERVICE;
  }

  if (error.status >= 400) {
    return IntegrationErrorCategory.CLIENT;
  }

  return IntegrationErrorCategory.UNKNOWN;
}
```

### Fallback Strategies

```typescript
// Notification fallback chain
async function sendNotification(
  to: string,
  message: string,
  channels: Channel[]
): Promise<DeliveryResult> {
  for (const channel of channels) {
    try {
      const result = await sendViaChannel(channel, to, message);
      return { success: true, channel, result };
    } catch (error) {
      logChannelFailure(channel, error);
      // Continue to next channel
    }
  }

  // All channels failed
  return { success: false, error: 'All channels failed' };
}

// Default channel priority (Argentine market)
const CHANNEL_PRIORITY: Channel[] = ['whatsapp', 'push', 'sms', 'email'];
```

## Monitoring

### Health Checks

```typescript
// Integration health check endpoint
// GET /api/health/integrations

interface IntegrationHealth {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastSuccess?: Date;
  lastError?: string;
  circuitState: 'closed' | 'open' | 'half-open';
}

async function checkIntegrationHealth(): Promise<IntegrationHealth[]> {
  return Promise.all([
    checkWhatsAppHealth(),
    checkMercadoPagoHealth(),
    checkAFIPHealth(),
    checkOpenAIHealth()
  ]);
}
```

### Metrics

```typescript
// Key integration metrics
const INTEGRATION_METRICS = {
  // Latency
  'integration.latency': Histogram,

  // Success/failure rate
  'integration.requests.total': Counter,
  'integration.requests.success': Counter,
  'integration.requests.failure': Counter,

  // Circuit breaker state
  'integration.circuit.state': Gauge,

  // Queue depth
  'integration.queue.depth': Gauge,
  'integration.queue.processing_time': Histogram
};
```

## Testing

### Integration Test Pattern

```typescript
// Mock external service for testing
class MockWhatsAppService implements WhatsAppService {
  private sentMessages: SentMessage[] = [];

  async send(to: string, message: string): Promise<SendResult> {
    const result = { messageId: `mock-${Date.now()}`, status: 'sent' };
    this.sentMessages.push({ to, message, ...result });
    return result;
  }

  getSentMessages(): SentMessage[] {
    return this.sentMessages;
  }
}

// Test with mock
describe('NotificationService', () => {
  const mockWhatsApp = new MockWhatsAppService();

  it('sends notification via WhatsApp', async () => {
    await notificationService.send('+5491155551234', 'Test');

    const sent = mockWhatsApp.getSentMessages();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('+5491155551234');
  });
});
```

## Related Documentation

- [High-Level Architecture](./high-level-architecture.md)
- [Data Flow](./data-flow.md)
- [Security Architecture](./security-architecture.md)
- [ADR-001 WhatsApp Aggregator](./decision-records/ADR-001-whatsapp-aggregator-model.md)
