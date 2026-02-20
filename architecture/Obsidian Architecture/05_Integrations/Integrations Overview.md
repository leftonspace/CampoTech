---
tags:
  - integrations
  - moc
  - api
status: 🟢 Functional
type: Feature Index
updated: 2026-02-13
---

# 🔌 Integrations & Third-Party Services

> [!INFO] **Overview**
> CampoTech integrates with multiple external services to provide real-time operations across Argentina. Each integration follows a standardized pattern with credential encryption, webhook validation, and circuit breaker resilience.

---

## 🗺️ Integration Map

```
┌─────────────────────────────────────────────────────────────┐
│                     CAMPOTECH CORE                           │
│                                                              │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│   │ Financial│  │ Comms    │  │ Location │  │ AI/ML    │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
└────────┼─────────────┼─────────────┼──────────────┼─────────┘
         │             │             │              │
    ┌────▼────┐   ┌────▼────┐  ┌────▼────┐   ┌────▼────┐
    │  AFIP   │   │  Meta   │  │ Google  │   │ OpenAI  │
    │  (Tax)  │   │  Cloud  │  │  Maps   │   │ (GPT-4) │
    ├─────────┤   │  API    │  ├─────────┤   ├─────────┤
    │ Mercado │   ├─────────┤  │Distance │   │ Vision  │
    │  Pago   │   │ Twilio  │  │ Matrix  │   │         │
    ├─────────┤   ├─────────┤  │Directions│  └─────────┘
    │  BCRA   │   │ Resend  │  │Geocoding │
    │ (Rates) │   │ (Email) │  │Javascript│
    └─────────┘   └─────────┘  └─────────┘
```

---

## 📋 Integration Details

### 🏛️ AFIP (Argentine Tax Authority)

| Attribute | Detail |
|:---|:---|
| **API** | WSFE (Web Service Factura Electrónica) v1 |
| **Purpose** | Electronic invoicing with CAE assignment |
| **Auth** | X.509 certificate + private key |
| **Credential Storage** | AES-256-GCM encrypted in database |
| **Queue** | Async background processing with retry |
| **Invoice Types** | Factura C (Monotributo), B, A |
| **Key Service** | `lib/integrations/afip/` |

### 💳 MercadoPago

| Attribute | Detail |
|:---|:---|
| **API** | REST API v1 |
| **Purpose** | Subscription billing + on-site Cobro |
| **Auth** | OAuth 2.0 (per-organization) |
| **Webhooks** | HMAC-SHA256 validated |
| **Features** | Checkout links, QR codes, subscription management |
| **Idempotency** | Unique payment keys |
| **Key Service** | `lib/integrations/mercadopago/` |

### 📱 Meta Cloud API (WhatsApp)

| Attribute | Detail |
|:---|:---|
| **API** | Meta Cloud API (direct, no BSP) |
| **Purpose** | WhatsApp Business messaging |
| **Auth** | Business-level access token |
| **Features** | Send/receive messages, templates, media, interactive |
| **AI Integration** | LangGraph agent processes incoming messages |
| **Rate Limits** | Per-account limits, managed via tier system |
| **Key Service** | `lib/integrations/whatsapp/` |

### 📞 Twilio

| Attribute | Detail |
|:---|:---|
| **API** | REST API |
| **Purpose** | WhatsApp managed number purchase + provisioning |
| **Features** | Number inventory, assignment, reclamation |
| **Key Service** | `lib/services/number-inventory.service.ts` |

### 🗺️ Google Maps Platform

| API | Purpose | Env Variable |
|:---|:---|:---|
| **Distance Matrix** | Traffic-aware ETA calculation | `GOOGLE_MAPS_SERVER_KEY` |
| **Directions** | Turn-by-turn route generation | `GOOGLE_MAPS_SERVER_KEY` |
| **Geocoding** | Address → lat/lng resolution | `GOOGLE_MAPS_SERVER_KEY` |
| **Maps JavaScript** | Client-side map rendering | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |

| Key Feature | Implementation |
|:---|:---|
| Live traffic | `departure_time=now` + `traffic_model=best_guess` |
| Multi-modal | Driving, bicycling, transit comparison |
| BA traffic context | Rush hour detection + congestion multipliers |
| Caching | 5-min TTL, 500 entries max |

### 🤖 OpenAI

| Attribute | Detail |
|:---|:---|
| **Models** | GPT-4, GPT-4 Vision |
| **Purpose** | AI Copilot, Staff Help, Dispatch Intelligence |
| **Agent Framework** | LangGraph (Python service) |
| **Vision** | Photo analysis (job documentation) |
| **Key Service** | `lib/integrations/openai/` + `services/ai/` |

### 📧 Resend

| Attribute | Detail |
|:---|:---|
| **API** | REST API |
| **Purpose** | Transactional emails (subscription, verification, reports) |
| **Templates** | Subscription confirmations, OTP, campaign outreach |

### 💱 BCRA (Central Bank)

| Attribute | Detail |
|:---|:---|
| **API** | Public exchange rate API |
| **Purpose** | USD/ARS rate tracking for pricing |
| **Key Service** | `lib/services/exchange-rate.service.ts` |

### 📊 Sentry

| Attribute | Detail |
|:---|:---|
| **Purpose** | Error tracking + performance monitoring |
| **PII Filtering** | Sensitive data scrubbed before transmission |
| **Source Maps** | Uploaded during build for stack trace resolution |

---

## 🔄 Integration Patterns

### Circuit Breaker (`lib/degradation/`)
```
CLOSED (normal) → failures exceed threshold → OPEN (reject all)
    ↓ after timeout
HALF_OPEN (test one request) → success → CLOSED
                              → failure → OPEN
```

### Webhook Security
1. Validate HMAC-SHA256 signature
2. Check timestamp freshness (< 5 min)
3. Idempotency check (duplicate prevention)
4. Process within transaction block
5. Log to audit trail

### Credential Management
- All third-party credentials encrypted with AES-256-GCM
- Master key in environment variable (never in code/DB)
- Per-organization credential isolation
- Rotation support via `credential-encryption.ts`

---

## 🛠️ Technical Context

| Directory | Contents |
|:---|:---|
| `lib/integrations/afip/` | AFIP WSFE client, certificate handling |
| `lib/integrations/mercadopago/` | MercadoPago SDK wrapper, webhook handler |
| `lib/integrations/whatsapp/` | Meta Cloud API client, template manager |
| `lib/integrations/openai/` | GPT-4 client, prompt engineering |
| `lib/integrations/google-maps/` | Distance Matrix, Directions, config |
| `lib/degradation/` | Circuit breaker implementation |

### Environment Variables

| Variable | Service | Side |
|:---|:---|:---|
| `GOOGLE_MAPS_SERVER_KEY` | Google Maps | Server |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps | Client |
| `OPENAI_API_KEY` | OpenAI | Server |
| `META_WHATSAPP_TOKEN` | WhatsApp | Server |
| `MERCADOPAGO_ACCESS_TOKEN` | MercadoPago | Server |
| `RESEND_API_KEY` | Resend | Server |
| `SENTRY_DSN` | Sentry | Both |
| `TWILIO_ACCOUNT_SID` | Twilio | Server |
| `TWILIO_AUTH_TOKEN` | Twilio | Server |

---

## 🔗 Connections

- **Parent:** [[Platform Overview]]
- **Related:**
  - [[AFIP Settings]], [[MercadoPago Settings]]
  - [[WhatsApp Settings]], [[AI Settings Page]]
  - [[Route Intelligence]], [[System Health and Capacity]]
- **Security:** [[Security Architecture]]

---

*Every integration follows the same pattern: encrypted credentials, webhook validation, circuit breaker resilience, and audit trail.*
