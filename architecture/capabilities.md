# CampoTech Capability Map
## Master Kill-Switch Architecture | Feature Orchestration Layer

---

# TABLE OF CONTENTS

1. Overview & Purpose
2. Architecture Principles
3. Capability Categories
4. Master Capability Matrix
5. Fallback Behavior Definitions
6. Runtime Implementation
7. Guard Function Pattern
8. Module Integration Guide
9. Operations Playbook
10. Emergency Procedures

---

# 1. OVERVIEW & PURPOSE

## What is the Capability Map?

The CampoTech Capability Map is a **Feature Orchestration Layer** that acts as a universal ON/OFF switchboard for the entire platform. It provides:

- **Centralized Control:** One file controls all inter-module toggles
- **Runtime Flexibility:** Turn off any subsystem instantly without code changes
- **Graceful Degradation:** Prevent code from calling broken dependencies
- **Zero-Downtime Recovery:** Allow the rest of the application to function without modification
- **Simple Toggles:** `true | false` switches for every capability

## Why This Matters

Enterprise systems protect themselves from fragile external integrations (AFIP, WhatsApp, Mercado Pago) using this pattern. Known as:

- Feature Flag Registry
- Capability Matrix
- Connection Contract File
- Module Switchboard

If something goes wrong in production, you edit **ONE field** instead of editing code.

## Source of Truth

This document + `core/config/capabilities.ts` become the authoritative source for:

| Question | Answer Location |
|----------|-----------------|
| Which modules are active? | `capabilities.ts` |
| Which modules call others? | Capability Matrix (§4) |
| Which fallbacks to enable? | Fallback Definitions (§5) |
| How does the system behave when X is `false`? | This document |

---

# 2. ARCHITECTURE PRINCIPLES

## Principle 1: Default to Enabled

All capabilities default to `true` to enable full production functionality. Disabling is an explicit action taken only when necessary.

```typescript
// Good: Explicit default
afip: true,

// Bad: Implicit/undefined state
afip: process.env.AFIP_ENABLED ?? undefined,
```

## Principle 2: Fail Closed, Degrade Gracefully

When a capability is set to `false`, the system MUST:

1. **Prevent calls** into that subsystem
2. **Use defined fallback** or no-op behavior
3. **Ensure platform continues** functioning
4. **Send warnings** to logs/Sentry if disabled feature is invoked
5. **NEVER throw** unhandled exceptions
6. **NEVER break** core workflows

## Principle 3: Single Point of Control

All capability decisions flow through ONE configuration object. No scattered environment variables, no inline checks against different sources.

```
┌─────────────────────────────────────────────────────────────┐
│                    capabilities.ts                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  SINGLE SOURCE OF TRUTH FOR ALL FEATURE TOGGLES      │  │
│  └───────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │  AFIP   │       │WhatsApp │       │  Voice  │
   │ Service │       │ Service │       │   AI    │
   └─────────┘       └─────────┘       └─────────┘
```

## Principle 4: Observable Degradation

Every capability check is logged. Operations can see exactly which features are active/disabled at any time.

---

# 3. CAPABILITY CATEGORIES

## Category Overview

| Category | Description | Example Capabilities |
|----------|-------------|---------------------|
| **External** | Third-party API integrations | AFIP, Mercado Pago, WhatsApp |
| **Domain** | Core business logic modules | Invoicing, Payments, Scheduling |
| **Services** | Internal background services | Queues, Reconciliation, Analytics |
| **UI** | Frontend feature toggles | Simple Mode, Pricebook, Reporting |

## Dependency Graph

```
EXTERNAL INTEGRATIONS
├── afip ─────────────────────┬─► invoicing (domain)
│                             └─► cae_queue (services)
├── mercadopago ──────────────┬─► payments (domain)
│                             └─► payment_reconciliation (services)
├── whatsapp ─────────────────┬─► whatsapp_queue (services)
│                             └─► whatsapp_voice_ai (external)
├── whatsapp_voice_ai ────────┬─► job_assignment (domain)
│                             └─► scheduling (domain)
└── push_notifications ───────┴─► (standalone)

DOMAIN CAPABILITIES
├── invoicing ────────────────┬─► pricebook (ui)
│                             └─► reporting_dashboard (ui)
├── payments ─────────────────┴─► reporting_dashboard (ui)
├── scheduling ───────────────┬─► job_assignment (domain)
│                             └─► technician_gps (domain)
├── job_assignment ───────────┴─► technician_gps (domain)
├── offline_sync ─────────────┴─► (mobile-specific)
└── technician_gps ───────────┴─► (mobile-specific)

INTERNAL SERVICES
├── cae_queue ────────────────┴─► afip (external)
├── whatsapp_queue ───────────┴─► whatsapp (external)
├── payment_reconciliation ───┴─► mercadopago (external)
├── abuse_detection ──────────┴─► rate_limiting (services)
├── rate_limiting ────────────┴─► (standalone)
└── analytics_pipeline ───────┴─► (standalone)

UI CAPABILITIES
├── simple_mode ──────────────┴─► (default for all users)
├── advanced_mode ────────────┴─► (unlocked on request)
├── pricebook ────────────────┴─► invoicing (domain)
└── reporting_dashboard ──────┴─► (standalone)
```

---

# 4. MASTER CAPABILITY MATRIX

## Complete Capability Definition

```typescript
export const Capabilities = {
  // ═══════════════════════════════════════════════════════════════
  // EXTERNAL INTEGRATIONS
  // Third-party services that may fail independently
  // ═══════════════════════════════════════════════════════════════
  external: {
    afip: true,              // AFIP electronic invoicing (CAE)
    mercadopago: true,       // Payment processing
    whatsapp: true,          // WhatsApp Cloud API messaging
    whatsapp_voice_ai: true, // Voice message transcription + extraction
    push_notifications: true, // Mobile push via Expo
  },

  // ═══════════════════════════════════════════════════════════════
  // DOMAIN CAPABILITIES
  // Core business logic modules
  // ═══════════════════════════════════════════════════════════════
  domain: {
    invoicing: true,         // Invoice creation and management
    payments: true,          // Payment processing and recording
    scheduling: true,        // Job scheduling and calendar
    job_assignment: true,    // Technician assignment logic
    offline_sync: true,      // Mobile offline synchronization
    technician_gps: true,    // Real-time GPS tracking
  },

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL SERVICES
  // Background workers and processing pipelines
  // ═══════════════════════════════════════════════════════════════
  services: {
    cae_queue: true,              // AFIP CAE request queue
    whatsapp_queue: true,         // WhatsApp message queue
    payment_reconciliation: true, // MP webhook reconciliation
    abuse_detection: true,        // Suspicious activity detection
    rate_limiting: true,          // API rate limiting
    analytics_pipeline: true,     // Metrics collection
  },

  // ═══════════════════════════════════════════════════════════════
  // UI CAPABILITIES
  // Frontend feature visibility
  // ═══════════════════════════════════════════════════════════════
  ui: {
    simple_mode: true,         // Simplified UI (default)
    advanced_mode: true,       // Advanced features visible
    pricebook: true,           // Price book management
    reporting_dashboard: true, // Analytics dashboard
  },
} as const;
```

## Capability Status Reference

| Capability | Category | Default | Dependencies | Kill Impact |
|------------|----------|---------|--------------|-------------|
| `afip` | external | `true` | cae_queue | No CAE, draft invoices only |
| `mercadopago` | external | `true` | payment_reconciliation | Cash/transfer only |
| `whatsapp` | external | `true` | whatsapp_queue, whatsapp_voice_ai | SMS fallback |
| `whatsapp_voice_ai` | external | `true` | whatsapp | Manual job creation only |
| `push_notifications` | external | `true` | - | In-app notifications only |
| `invoicing` | domain | `true` | afip | No invoice generation |
| `payments` | domain | `true` | mercadopago | Manual payment recording |
| `scheduling` | domain | `true` | job_assignment | Jobs without scheduling |
| `job_assignment` | domain | `true` | scheduling, technician_gps | Manual assignment |
| `offline_sync` | domain | `true` | - | Online-only mode |
| `technician_gps` | domain | `true` | - | No location tracking |
| `cae_queue` | services | `true` | afip | Direct AFIP calls (risky) |
| `whatsapp_queue` | services | `true` | whatsapp | Direct WA calls (risky) |
| `payment_reconciliation` | services | `true` | mercadopago | Manual reconciliation |
| `abuse_detection` | services | `true` | rate_limiting | No abuse protection |
| `rate_limiting` | services | `true` | - | Unlimited API calls |
| `analytics_pipeline` | services | `true` | - | No metrics collection |
| `simple_mode` | ui | `true` | - | Complex UI by default |
| `advanced_mode` | ui | `true` | - | No advanced features |
| `pricebook` | ui | `true` | invoicing | Manual pricing only |
| `reporting_dashboard` | ui | `true` | - | No analytics view |

---

# 5. FALLBACK BEHAVIOR DEFINITIONS

## External Integration Fallbacks

### AFIP (`external.afip = false`)

```
FALLBACK BEHAVIOR:
├── Invoice creation → Saves as DRAFT status
├── CAE requests → Queued but not processed
├── PDF generation → Uses "FACTURA BORRADOR" watermark
├── User notification → "Tu factura será procesada cuando AFIP esté disponible"
└── Recovery → Background job processes queue when re-enabled

USER EXPERIENCE:
- Can still create "invoices" (drafts)
- Jobs complete normally
- Payments can be recorded
- Actual CAE arrives async when service recovers
```

### Mercado Pago (`external.mercadopago = false`)

```
FALLBACK BEHAVIOR:
├── Payment creation → Disabled
├── Payment links → Not generated
├── Available methods → Cash + Bank Transfer ONLY
├── User notification → "Pagos con tarjeta no disponibles temporalmente"
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Shows bank transfer instructions with org CBU
- Shows cash payment option
- Manual payment recording still works
- No installment (cuotas) options
```

### WhatsApp (`external.whatsapp = false`)

```
FALLBACK BEHAVIOR:
├── Outbound messages → Routed to SMS fallback
├── Inbound processing → Messages logged but not processed
├── Voice messages → Logged but not transcribed
├── Notifications → SMS for critical, none for promotional
└── Recovery → Queue processes backlog when re-enabled

USER EXPERIENCE:
- Critical notifications via SMS
- Promotional messages skipped
- Voice AI unavailable
- Manual phone calls may be needed

SMS FALLBACK MESSAGES:
- job_confirmation: "CampoTech: Trabajo confirmado para [date] [time]"
- tech_en_route: "CampoTech: Técnico en camino. Llegada ~[eta]"
- payment_received: "CampoTech: Pago recibido $[amount]. Gracias!"
- invoice_ready: "CampoTech: Factura lista. Ver en [short-link]"
```

### Voice AI (`external.whatsapp_voice_ai = false`)

```
FALLBACK BEHAVIOR:
├── Voice messages → Logged but not processed
├── Auto job creation → Disabled
├── Transcription → Skipped
├── User notification → "Los mensajes de voz no están disponibles ahora. Enviá texto."
└── Recovery → Backlog processed when re-enabled

USER EXPERIENCE:
- Must type job requests manually
- Can still use WhatsApp for text messages
- Jobs created through web/mobile only
- Voice messages saved for later processing
```

### Push Notifications (`external.push_notifications = false`)

```
FALLBACK BEHAVIOR:
├── Push delivery → Skipped
├── In-app notifications → Still delivered
├── Badge counts → Updated locally only
├── Critical alerts → Shown in-app on next open
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Must open app to see notifications
- No background alerts
- Core functionality unaffected
```

## Domain Capability Fallbacks

### Offline Sync (`domain.offline_sync = false`)

```
FALLBACK BEHAVIOR:
├── Offline mode → Disabled entirely
├── Local database → Read-only (cached data)
├── Pending operations → Must wait for connection
├── User notification → "Se requiere conexión a internet"
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- App requires internet connection
- Shows "No connection" screen when offline
- Can view cached jobs/customers (read-only)
- Cannot create/edit while offline
```

### Technician GPS (`domain.technician_gps = false`)

```
FALLBACK BEHAVIOR:
├── Location tracking → Disabled
├── ETA calculation → Uses estimate from job distance
├── "En camino" notification → Sent without ETA
├── Map view → Shows static job address only
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Customer doesn't see real-time location
- ETA shown as "Approximately X minutes"
- Dispatchers cannot track technician locations
- Route optimization unavailable
```

### Job Assignment (`domain.job_assignment = false`)

```
FALLBACK BEHAVIOR:
├── Auto-assignment → Disabled
├── Skill matching → Skipped
├── Availability checks → Skipped
├── Assignment UI → Shows all technicians (manual selection)
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Must manually select technician for each job
- No smart suggestions
- All technicians shown regardless of availability
- No scheduling conflict warnings
```

## UI Capability Fallbacks

### Pricebook (`ui.pricebook = false`)

```
FALLBACK BEHAVIOR:
├── Price book UI → Hidden
├── Line item selection → Manual entry only
├── Price suggestions → None
├── Material lookup → Unavailable
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Must enter prices manually
- No pre-configured service items
- No material database
- Invoice line items typed manually
```

### Reporting Dashboard (`ui.reporting_dashboard = false`)

```
FALLBACK BEHAVIOR:
├── Dashboard UI → Hidden
├── Analytics → Not displayed
├── Export functions → Unavailable
├── Charts/graphs → Not rendered
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- No revenue analytics
- No job completion metrics
- No technician performance data
- Basic job/invoice lists still available
```

---

# 6. RUNTIME IMPLEMENTATION

## File Location

```
/core/config/capabilities.ts
```

## Type Definitions

```typescript
// Type-safe capability paths
type ExternalCapability = keyof typeof Capabilities.external;
type DomainCapability = keyof typeof Capabilities.domain;
type ServiceCapability = keyof typeof Capabilities.services;
type UICapability = keyof typeof Capabilities.ui;

type CapabilityPath =
  | `external.${ExternalCapability}`
  | `domain.${DomainCapability}`
  | `services.${ServiceCapability}`
  | `ui.${UICapability}`;
```

## Dynamic Capability Check

```typescript
export function isCapabilityEnabled(path: CapabilityPath): boolean {
  const [category, capability] = path.split('.') as [keyof typeof Capabilities, string];
  return Capabilities[category][capability as keyof typeof Capabilities[typeof category]] ?? false;
}
```

## Environment Override Support

For runtime flexibility, capabilities can be overridden via environment variables:

```typescript
function getCapabilityValue(category: string, capability: string): boolean {
  // Check environment override first
  const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue === 'true';
  }

  // Fall back to static configuration
  return Capabilities[category][capability] ?? true;
}
```

---

# 7. GUARD FUNCTION PATTERN

## Universal Guard Function

```typescript
/**
 * Guards capability access with logging and fallback support
 *
 * @param path - Capability path (e.g., "external.afip")
 * @param capability - Boolean value from Capabilities object
 * @returns boolean - Whether the capability is enabled
 *
 * @example
 * if (!ensureCapability("external.afip", Capabilities.external.afip)) {
 *   return createDraftInvoice(data); // fallback
 * }
 * return AfipService.requestCAE(data);
 */
export function ensureCapability(path: string, capability: boolean): boolean {
  if (!capability) {
    console.warn(`[Capability Disabled] ${path}`);

    // Optional: Send to Sentry for visibility
    Sentry.addBreadcrumb({
      category: 'capability',
      message: `Capability disabled: ${path}`,
      level: 'warning',
    });

    return false;
  }
  return true;
}
```

## Usage Examples

### AFIP Integration Guard

```typescript
// In: services/afip/invoice-service.ts

async function processInvoice(data: InvoiceData): Promise<Invoice> {
  if (!ensureCapability("external.afip", Capabilities.external.afip)) {
    // Fallback: Create draft invoice without CAE
    return createDraftInvoice(data);
  }

  // Normal flow: Request CAE from AFIP
  return AfipService.requestCAE(data);
}
```

### WhatsApp Integration Guard

```typescript
// In: services/whatsapp/message-service.ts

async function sendNotification(message: NotificationMessage): Promise<void> {
  if (!ensureCapability("external.whatsapp", Capabilities.external.whatsapp)) {
    // Fallback: Use SMS for critical messages
    if (isCriticalMessage(message)) {
      return SmsService.send(message.phone, message.smsText);
    }
    // Non-critical: Log and skip
    console.info(`[WhatsApp Disabled] Skipping non-critical: ${message.type}`);
    return;
  }

  // Normal flow: Send via WhatsApp
  return WhatsAppService.send(message);
}
```

### Mercado Pago Integration Guard

```typescript
// In: services/payments/payment-service.ts

async function createPaymentLink(invoice: Invoice): Promise<PaymentLink | null> {
  if (!ensureCapability("external.mercadopago", Capabilities.external.mercadopago)) {
    // Fallback: Return null (UI shows cash/transfer options)
    console.info(`[MP Disabled] No payment link for invoice ${invoice.id}`);
    return null;
  }

  // Normal flow: Create MP preference
  return MercadoPagoService.createPreference(invoice);
}
```

### Voice AI Integration Guard

```typescript
// In: services/voice/transcription-service.ts

async function processVoiceMessage(audio: AudioMessage): Promise<JobDraft | null> {
  if (!ensureCapability("external.whatsapp_voice_ai", Capabilities.external.whatsapp_voice_ai)) {
    // Fallback: Log the message for manual review
    await VoiceMessageLog.create({
      audioUrl: audio.url,
      status: 'pending_manual_review',
      reason: 'voice_ai_disabled',
    });

    // Notify user to use text
    await sendFallbackMessage(audio.from, "voice_unavailable");
    return null;
  }

  // Normal flow: Transcribe and extract job data
  return VoiceAIService.processAudio(audio);
}
```

### Offline Sync Guard

```typescript
// In: mobile/services/sync-service.ts

async function syncPendingOperations(): Promise<SyncResult> {
  if (!ensureCapability("domain.offline_sync", Capabilities.domain.offline_sync)) {
    // Fallback: Require online mode
    return {
      success: false,
      error: 'offline_sync_disabled',
      message: 'Se requiere conexión a internet',
    };
  }

  // Normal flow: Process offline queue
  return OfflineSyncManager.processQueue();
}
```

### GPS Tracking Guard

```typescript
// In: mobile/services/location-service.ts

async function updateTechnicianLocation(coords: Coordinates): Promise<void> {
  if (!ensureCapability("domain.technician_gps", Capabilities.domain.technician_gps)) {
    // Fallback: Skip location updates
    return;
  }

  // Normal flow: Send location to server
  return LocationService.update(coords);
}
```

### Dashboard UI Guard

```typescript
// In: components/admin/sidebar.tsx

function AdminSidebar() {
  return (
    <nav>
      <NavItem href="/jobs">Trabajos</NavItem>
      <NavItem href="/invoices">Facturas</NavItem>

      {Capabilities.ui.reporting_dashboard && (
        <NavItem href="/dashboard">Dashboard</NavItem>
      )}

      {Capabilities.ui.pricebook && (
        <NavItem href="/pricebook">Lista de Precios</NavItem>
      )}
    </nav>
  );
}
```

### Pricebook UI Guard

```typescript
// In: components/invoice/line-item-selector.tsx

function LineItemSelector({ onSelect }: Props) {
  if (!ensureCapability("ui.pricebook", Capabilities.ui.pricebook)) {
    // Fallback: Show manual entry only
    return <ManualLineItemEntry onSubmit={onSelect} />;
  }

  // Normal flow: Show pricebook selector
  return <PricebookSelector onSelect={onSelect} />;
}
```

---

# 8. MODULE INTEGRATION GUIDE

## Step-by-Step Integration

### Step 1: Import Capabilities

```typescript
import { Capabilities, ensureCapability } from '@/core/config/capabilities';
```

### Step 2: Identify Guard Points

Find all locations where your module:
- Calls an external API
- Depends on another module
- Has an optional feature path

### Step 3: Add Guards

For each guard point, add the capability check with appropriate fallback.

### Step 4: Test Both Paths

```typescript
describe('InvoiceService', () => {
  describe('when AFIP is enabled', () => {
    beforeEach(() => {
      jest.spyOn(Capabilities.external, 'afip', 'get').mockReturnValue(true);
    });

    it('requests CAE from AFIP', async () => {
      const invoice = await processInvoice(data);
      expect(invoice.cae).toBeDefined();
    });
  });

  describe('when AFIP is disabled', () => {
    beforeEach(() => {
      jest.spyOn(Capabilities.external, 'afip', 'get').mockReturnValue(false);
    });

    it('creates draft invoice without CAE', async () => {
      const invoice = await processInvoice(data);
      expect(invoice.status).toBe('draft');
      expect(invoice.cae).toBeNull();
    });
  });
});
```

## Integration Checklist

For each module, verify:

- [ ] Capability guard at entry point
- [ ] Fallback behavior implemented
- [ ] User-friendly error message defined
- [ ] Logging added for disabled state
- [ ] Both enabled/disabled paths tested
- [ ] Recovery behavior documented

---

# 9. OPERATIONS PLAYBOOK

## Viewing Current Capability State

### Via Admin Dashboard

Navigate to: **Settings → System → Capability Status**

Shows real-time status of all capabilities with:
- Current value (enabled/disabled)
- Last changed timestamp
- Override source (static/environment/admin)

### Via API

```bash
GET /api/admin/capabilities
Authorization: Bearer <admin-token>

Response:
{
  "external": {
    "afip": { "enabled": true, "source": "static" },
    "mercadopago": { "enabled": true, "source": "environment" },
    ...
  },
  ...
}
```

### Via Logs

Search for `[Capability Disabled]` in application logs to see which capabilities are being bypassed.

## Toggling Capabilities

### Method 1: Environment Variables (Recommended for Production)

```bash
# Disable AFIP
CAPABILITY_EXTERNAL_AFIP=false

# Disable WhatsApp
CAPABILITY_EXTERNAL_WHATSAPP=false

# Disable Voice AI
CAPABILITY_EXTERNAL_WHATSAPP_VOICE_AI=false
```

### Method 2: Admin Dashboard

1. Navigate to **Settings → System → Capability Control**
2. Find the capability to toggle
3. Click the toggle switch
4. Confirm the change
5. Change takes effect immediately

### Method 3: Direct Configuration (Development Only)

Edit `core/config/capabilities.ts` and redeploy.

## Monitoring Degraded State

### Alerts to Configure

| Alert | Trigger | Action |
|-------|---------|--------|
| Capability Disabled | Any capability set to `false` | Investigate root cause |
| Fallback Activated | Fallback code path executed | Monitor volume |
| Disabled Capability Invoked | `ensureCapability` returns false | Check if expected |

### Grafana Dashboard Panels

1. **Capability Status Matrix** - All capabilities with current state
2. **Fallback Invocations** - Count of fallback executions per capability
3. **Disabled Capability Calls** - Attempts to use disabled features

---

# 10. EMERGENCY PROCEDURES

## Scenario: AFIP Is Down

**Symptoms:**
- CAE requests timing out
- Queue depth increasing
- Users reporting invoice errors

**Response:**

```bash
# 1. Disable AFIP capability
export CAPABILITY_EXTERNAL_AFIP=false

# 2. Verify fallback active (check logs)
grep "[Capability Disabled] external.afip" /var/log/app.log

# 3. Monitor draft invoice creation
# Users should see "Factura guardada" instead of errors

# 4. When AFIP recovers, re-enable
export CAPABILITY_EXTERNAL_AFIP=true

# 5. Verify queue processing resumes
```

## Scenario: WhatsApp API Rate Limited

**Symptoms:**
- WhatsApp messages failing
- Rate limit errors in logs
- Customer complaints about no notifications

**Response:**

```bash
# 1. Disable WhatsApp capability
export CAPABILITY_EXTERNAL_WHATSAPP=false

# 2. SMS fallback activates automatically for critical messages

# 3. Non-critical messages are queued

# 4. After rate limit window passes (~24h), re-enable
export CAPABILITY_EXTERNAL_WHATSAPP=true
```

## Scenario: Voice AI Producing Bad Results

**Symptoms:**
- Low confidence scores across the board
- Users reporting incorrect job data
- Human review queue overwhelmed

**Response:**

```bash
# 1. Disable Voice AI capability
export CAPABILITY_EXTERNAL_WHATSAPP_VOICE_AI=false

# 2. Users prompted to use text instead

# 3. Investigate root cause (model issue? audio quality?)

# 4. After fix deployed and validated, re-enable
export CAPABILITY_EXTERNAL_WHATSAPP_VOICE_AI=true
```

## Scenario: Database Performance Degradation

**Symptoms:**
- Slow API responses
- Query timeouts
- High CPU on database

**Response:**

```bash
# 1. Disable non-essential capabilities
export CAPABILITY_SERVICES_ANALYTICS_PIPELINE=false
export CAPABILITY_UI_REPORTING_DASHBOARD=false

# 2. Core workflows continue unaffected

# 3. Investigate and resolve database issue

# 4. Re-enable capabilities one at a time
export CAPABILITY_SERVICES_ANALYTICS_PIPELINE=true
# ... monitor for 10 minutes ...
export CAPABILITY_UI_REPORTING_DASHBOARD=true
```

## Recovery Verification Checklist

After re-enabling any capability:

- [ ] Capability shows as `enabled` in admin dashboard
- [ ] No `[Capability Disabled]` logs for that capability
- [ ] Normal code path executing (check logs)
- [ ] Queued operations processing (if applicable)
- [ ] User-facing features visible/working
- [ ] No new errors in Sentry

---

# DOCUMENT METADATA

| Field | Value |
|-------|-------|
| **Document ID** | capabilities-001 |
| **Version** | 1.0 |
| **Status** | Active |
| **Author** | CampoTech Architecture Team |
| **Last Updated** | 2024-01-15 |
| **Related Documents** | campotech-architecture-complete.md, campotech-queue-worker-architecture.md |
| **Runtime File** | core/config/capabilities.ts |

---

*This document is the authoritative reference for CampoTech's kill-switch architecture. All module integrations MUST follow the patterns defined here.*
