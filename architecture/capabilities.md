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

## ⚠️ Critical Implementation Warnings

> **⚠️ WORKER INTEGRATION GAP:** Background workers do NOT check capabilities. The `checkCapability()` method in `base.worker.ts:168-172` returns hardcoded `true`:
> ```typescript
> protected async checkCapability(capability: string, orgId: string): Promise<boolean> {
>   // TODO: Integrate with actual capabilities system
>   return true; // HARDCODED - NOT IMPLEMENTED
> }
> ```
> Workers affected: WhatsApp Worker, AFIP Worker, Payment Worker, Voice AI Worker.

> **⚠️ ADMIN UI ISSUES:** The Admin UI capability management page:
> - Uses mock/hardcoded data instead of live config
> - Uses different category names (`integration/feature/system`) than backend (`external/domain/services/ui`)
> - References API endpoints that don't exist (`/api/admin/capabilities`)

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
| **External** | Third-party API integrations | AFIP, Mercado Pago, WhatsApp, Voice AI |
| **Domain** | Core business logic modules | Invoicing, Payments, Scheduling, Consumer Marketplace, Customer Portal, Inventory |
| **Services** | Internal background services | Queues, Reconciliation, Analytics, Fraud Detection, Notifications |
| **UI** | Frontend feature toggles | Simple Mode, Pricebook, Reporting, Marketplace Dashboard, Whitelabel Portal |

## Dependency Graph

```
EXTERNAL INTEGRATIONS
├── afip ─────────────────────┬─► invoicing (domain)
│                             └─► cae_queue (services)
├── mercadopago ──────────────┬─► payments (domain)
│                             └─► payment_reconciliation (services)
├── whatsapp ─────────────────┬─► whatsapp_queue (services)
│                             ├─► whatsapp_voice_ai (external)
│                             ├─► whatsapp_aggregation (services)
│                             └─► consumer_marketplace (domain)
├── whatsapp_voice_ai ────────┬─► job_assignment (domain)
│                             └─► scheduling (domain)
└── push_notifications ───────┬─► consumer_marketplace (domain)
                              └─► customer_portal (domain)

DOMAIN CAPABILITIES
├── invoicing ────────────────┬─► pricebook (ui)
│                             └─► reporting_dashboard (ui)
├── payments ─────────────────┴─► reporting_dashboard (ui)
├── scheduling ───────────────┬─► job_assignment (domain)
│                             ├─► technician_gps (domain)
│                             └─► calendar_view (domain)
├── job_assignment ───────────┴─► technician_gps (domain)
├── offline_sync ─────────────┴─► (mobile-specific)
├── technician_gps ───────────┬─► customer_portal (domain)
│                             ├─► live_tracking_map (domain)
│                             └─► nearest_technician (domain)
├── consumer_marketplace ─────┬─► review_fraud_detection (services)
│                             ├─► notification_queue (services)
│                             └─► marketplace_dashboard (ui)

├── inventory_management ─────┬─► inventory_stock_alerts (services)
│                             └─► inventory_dashboard (ui)
├── fleet_management ─────────┬─► vehicle_documents (domain)
│                             ├─► fleet_expiry_alerts (services)
│                             └─► fleet_dashboard (ui)
├── calendar_view ────────────┬─► scheduling (domain)
│                             └─► calendar_dashboard (ui)
├── live_tracking_map ────────┬─► technician_gps (domain)
│                             └─► live_map_dashboard (ui)
├── nearest_technician ───────┴─► technician_gps (domain)
├── vehicle_documents ────────┴─► fleet_management (domain)
└── audit_logging ────────────┴─► (standalone)

INTERNAL SERVICES
├── cae_queue ────────────────┴─► afip (external)
├── whatsapp_queue ───────────┴─► whatsapp (external)
├── whatsapp_aggregation ─────┴─► whatsapp (external)
├── payment_reconciliation ───┴─► mercadopago (external)
├── review_fraud_detection ───┴─► consumer_marketplace (domain)
├── notification_queue ───────┬─► push_notifications (external)
│                             └─► whatsapp (external)
├── abuse_detection ──────────┴─► rate_limiting (services)
├── rate_limiting ────────────┴─► (standalone)
├── analytics_pipeline ───────┴─► (standalone)
├── fleet_expiry_alerts ──────┴─► fleet_management (domain)
└── inventory_stock_alerts ───┴─► inventory_management (domain)

UI CAPABILITIES
├── simple_mode ──────────────┴─► (default for all users)
├── advanced_mode ────────────┴─► (unlocked on request)
├── pricebook ────────────────┴─► invoicing (domain)
├── reporting_dashboard ──────┴─► (standalone)
├── marketplace_dashboard ────┴─► consumer_marketplace (domain)

├── calendar_dashboard ───────┴─► calendar_view (domain)
├── fleet_dashboard ──────────┴─► fleet_management (domain)
├── inventory_dashboard ──────┴─► inventory_management (domain)
└── live_map_dashboard ───────┴─► live_tracking_map (domain)
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
    invoicing: true,              // Invoice creation and management
    payments: true,               // Payment processing and recording
    scheduling: true,             // Job scheduling and calendar
    job_assignment: true,         // Technician assignment logic
    offline_sync: true,           // Mobile offline synchronization
    technician_gps: true,         // Real-time GPS tracking
    consumer_marketplace: true,   // Two-sided marketplace for consumers
    inventory_management: true,   // Parts/materials inventory tracking
    audit_logging: true,          // Comprehensive audit trail logging
    // Phase 7-10: New Capabilities
    calendar_view: true,          // Interactive calendar with job scheduling
    fleet_management: true,       // Vehicle fleet management & compliance
    vehicle_documents: true,      // Vehicle document upload & expiry tracking
    live_tracking_map: true,      // Real-time technician location map
    nearest_technician: true,     // Find nearest technician to job address
  },

  // ═══════════════════════════════════════════════════════════════
  // INTERNAL SERVICES
  // Background workers and processing pipelines
  // ═══════════════════════════════════════════════════════════════
  services: {
    cae_queue: true,              // AFIP CAE request queue
    whatsapp_queue: true,         // WhatsApp message queue
    whatsapp_aggregation: true,   // Multi-number WhatsApp aggregation
    payment_reconciliation: true, // MP webhook reconciliation
    abuse_detection: true,        // Suspicious activity detection
    rate_limiting: true,          // API rate limiting
    analytics_pipeline: true,     // Metrics collection
    review_fraud_detection: true, // Consumer review fraud analysis
    notification_queue: true,     // Unified notification dispatch queue
    // Phase 8-9: Fleet & Inventory Services
    fleet_expiry_alerts: true,    // Vehicle document expiry checking & alerts
    inventory_stock_alerts: true, // Low stock checking & alerts
  },

  // ═══════════════════════════════════════════════════════════════
  // UI CAPABILITIES
  // Frontend feature visibility
  // ═══════════════════════════════════════════════════════════════
  ui: {
    simple_mode: true,           // Simplified UI (default)
    advanced_mode: true,         // Advanced features visible
    pricebook: true,             // Price book management
    reporting_dashboard: true,   // Analytics dashboard
    marketplace_dashboard: true, // Consumer marketplace admin UI

    // Phase 7-10: New UI Capabilities
    calendar_dashboard: true,    // Interactive calendar view page
    fleet_dashboard: true,       // Fleet management dashboard
    inventory_dashboard: true,   // Inventory management dashboard
    live_map_dashboard: true,    // Real-time technician map view
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
| `consumer_marketplace` | domain | `true` | whatsapp, push_notifications | Consumer search/booking disabled |

| `inventory_management` | domain | `true` | inventory_stock_alerts | Manual inventory only |
| `audit_logging` | domain | `true` | - | No audit trail |
| `calendar_view` | domain | `true` | scheduling | Basic job list only |
| `fleet_management` | domain | `true` | vehicle_documents, fleet_expiry_alerts | No vehicle tracking |
| `vehicle_documents` | domain | `true` | fleet_management | No document storage |
| `live_tracking_map` | domain | `true` | technician_gps | No live map view |
| `nearest_technician` | domain | `true` | technician_gps | Manual technician selection |
| `cae_queue` | services | `true` | afip | Direct AFIP calls (risky) |
| `whatsapp_queue` | services | `true` | whatsapp | Direct WA calls (risky) |
| `whatsapp_aggregation` | services | `true` | whatsapp | Single number only |
| `payment_reconciliation` | services | `true` | mercadopago | Manual reconciliation |
| `abuse_detection` | services | `true` | rate_limiting | No abuse protection |
| `rate_limiting` | services | `true` | - | Unlimited API calls |
| `analytics_pipeline` | services | `true` | - | No metrics collection |
| `review_fraud_detection` | services | `true` | consumer_marketplace | No fraud checks on reviews |
| `notification_queue` | services | `true` | push_notifications, whatsapp | Direct notification calls |
| `fleet_expiry_alerts` | services | `true` | fleet_management | No document expiry alerts |
| `inventory_stock_alerts` | services | `true` | inventory_management | No low stock alerts |
| `simple_mode` | ui | `true` | - | Complex UI by default |
| `advanced_mode` | ui | `true` | - | No advanced features |
| `pricebook` | ui | `true` | invoicing | Manual pricing only |
| `reporting_dashboard` | ui | `true` | - | No analytics view |
| `marketplace_dashboard` | ui | `true` | consumer_marketplace | No marketplace admin UI |

| `calendar_dashboard` | ui | `true` | calendar_view | No calendar UI |
| `fleet_dashboard` | ui | `true` | fleet_management | No fleet UI |
| `inventory_dashboard` | ui | `true` | inventory_management | No inventory UI |
| `live_map_dashboard` | ui | `true` | live_tracking_map | No map view |

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

### Consumer Marketplace (`domain.consumer_marketplace = false`)

```
FALLBACK BEHAVIOR:
├── Consumer app → Shows maintenance message
├── Business directory → Not accessible to public
├── Service requests → Disabled
├── Reviews → Not collected from consumers
├── Lead generation → Disabled
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Consumers cannot search for businesses
- No quote requests from consumers
- Businesses don't receive marketplace leads
- Existing B2B functionality unaffected
```



### Inventory Management (`domain.inventory_management = false`)

```
FALLBACK BEHAVIOR:
├── Stock tracking → Disabled
├── Part lookups → Use price book only
├── Low stock alerts → Disabled
├── Purchase orders → Manual process
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Technicians manually track parts used
- No warehouse integration
- No automatic reorder triggers
- Materials entered manually on invoices
```

### Audit Logging (`domain.audit_logging = false`)

```
FALLBACK BEHAVIOR:
├── Audit events → Not recorded
├── Change tracking → Disabled
├── Compliance reports → Unavailable
├── User activity → Basic logs only
└── Recovery → Events from disabled period lost

USER EXPERIENCE:
- No detailed change history
- Cannot trace who modified what
- Compliance audits not supported
- Basic application logs still available
```

## Service Capability Fallbacks

### WhatsApp Aggregation (`services.whatsapp_aggregation = false`)

```
FALLBACK BEHAVIOR:
├── Multi-number routing → Single number only
├── Load balancing → Disabled
├── Number failover → Not available
├── Message distribution → All via primary number
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- All messages through single WhatsApp number
- Potential rate limiting during high volume
- No regional number routing
- Higher per-number costs
```

### Review Fraud Detection (`services.review_fraud_detection = false`)

```
FALLBACK BEHAVIOR:
├── Fraud analysis → Skipped
├── Review scoring → All marked as valid
├── Velocity checks → Disabled
├── Text similarity → Not checked
├── Moderation queue → Only manual reports
└── Recovery → Backlog can be re-analyzed

USER EXPERIENCE:
- All reviews published without automated checks
- Reliance on manual moderation
- Potential for fake reviews to slip through
- User reports still processed
```

### Notification Queue (`services.notification_queue = false`)

```
FALLBACK BEHAVIOR:
├── Queue processing → Direct calls instead
├── Retry logic → Simplified
├── Batching → Disabled
├── Priority routing → First-come-first-served
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Notifications still delivered (directly)
- Potential for delays during high volume
- No intelligent retry on failures
- Higher latency for bulk notifications
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

### Marketplace Dashboard (`ui.marketplace_dashboard = false`)

```
FALLBACK BEHAVIOR:
├── Admin marketplace UI → Hidden
├── Moderation queue → Not accessible
├── Lead analytics → Unavailable
├── Business verification → CLI only
└── Recovery → Immediate when re-enabled

USER EXPERIENCE:
- Cannot moderate reviews from web UI
- Cannot view marketplace metrics
- Business verification via database only
- Marketplace still functions for end users
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
// Actual function name: getCapabilityWithEnvOverride()
// Location: core/config/capabilities.ts
function getCapabilityWithEnvOverride(
  category: CapabilityCategory,
  capability: string
): boolean {
  // Check environment override first
  const envKey = `CAPABILITY_${category.toUpperCase()}_${capability.toUpperCase()}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue.toLowerCase() === 'true';
  }

  // Fall back to static configuration
  return Capabilities[category][capability] ?? true;
}
```

## Advanced Features (Implemented but Previously Undocumented)

### CapabilityService Class

A database-backed capability management service with caching. Priority order (highest to lowest):
1. Environment variables (emergency override)
2. Per-organization database overrides
3. Global database overrides (org_id = NULL)
4. Static defaults from Capabilities object

```typescript
// Location: core/config/capabilities.ts

const service = new CapabilityService(db);
await service.initialize();

// Check capability for specific org
const canUseAfip = await service.isEnabled('external.afip', 'org-uuid');

// Use guard pattern
if (!await service.ensure('external.afip', 'org-uuid')) {
  return fallbackBehavior();
}
```

**Key Methods:**
| Method | Description |
|--------|-------------|
| `initialize()` | Load overrides from database (call at startup) |
| `isEnabled(path, orgId?)` | Check if capability is enabled (with caching) |
| `ensure(path, orgId?)` | Guard function - logs when disabled |
| `setOverride(input, userId?)` | Create/update an override |
| `removeOverride(path, orgId?)` | Revert to default behavior |
| `getFullSnapshot(orgId?)` | Get complete capability state for dashboard |
| `reloadOverrides()` | Reload from database, clear cache |

### CapabilityDatabaseAdapter Interface

Interface for database operations. Implement to connect the capability system to your database:

```typescript
// Location: core/config/capabilities.ts

interface CapabilityDatabaseAdapter {
  getAllActiveOverrides(): Promise<CapabilityOverride[]>;
  getOverridesForOrg(orgId: string): Promise<CapabilityOverride[]>;
  upsertOverride(input: CapabilityOverrideInput, userId?: string): Promise<CapabilityOverride>;
  deleteOverride(path: CapabilityPath, orgId?: string): Promise<boolean>;
}
```

**Implementation:** See `core/repositories/capability-override.repository.ts`

### Per-Organization Capability Overrides

Override capabilities for specific organizations via database:

```typescript
// Disable AFIP for a specific org
await service.setOverride({
  org_id: 'org-uuid',
  capability_path: 'external.afip',
  enabled: false,
  reason: 'AFIP certificate expired',
  expires_at: new Date('2025-01-15'), // Optional TTL
}, 'admin-user-id');
```

### Capability Expiration/TTL Support

Overrides can have an expiration date. Expired overrides are automatically ignored:

```typescript
interface CapabilityOverride {
  id: string;
  org_id: string | null;        // null = global override
  capability_path: CapabilityPath;
  enabled: boolean;
  reason: string | null;
  disabled_by: string | null;
  expires_at: Date | null;      // TTL support
  created_at: Date;
  updated_at: Date;
}
```

### Capability Guards (capability-guards.ts)

Pre-built guard functions for all external integrations:

```typescript
// Location: core/services/capability-guards.ts
import { guards } from '@/core/services/capability-guards';

// In your service method:
async createInvoice(data: InvoiceData) {
  if (!await guards.afip(data.orgId)) {
    return this.createDraftInvoice(data); // Fallback
  }
  return this.requestCAE(data); // Normal flow
}
```

**Available Guards:**
| Guard | Capability Path |
|-------|-----------------|
| `guards.afip` | `external.afip` |
| `guards.mercadopago` | `external.mercadopago` |
| `guards.whatsapp` | `external.whatsapp` |
| `guards.voiceAI` | `external.whatsapp_voice_ai` |
| `guards.pushNotifications` | `external.push_notifications` |
| `guards.invoicing` | `domain.invoicing` |
| `guards.payments` | `domain.payments` |
| `guards.scheduling` | `domain.scheduling` |
| `guards.jobAssignment` | `domain.job_assignment` |
| `guards.offlineSync` | `domain.offline_sync` |
| `guards.technicianGPS` | `domain.technician_gps` |
| `guards.caeQueue` | `services.cae_queue` |
| `guards.whatsappQueue` | `services.whatsapp_queue` |
| `guards.paymentReconciliation` | `services.payment_reconciliation` |
| `guards.abuseDetection` | `services.abuse_detection` |
| `guards.rateLimiting` | `services.rate_limiting` |
| `guards.analyticsPipeline` | `services.analytics_pipeline` |
| `guards.simpleMode` | `ui.simple_mode` |
| `guards.advancedMode` | `ui.advanced_mode` |
| `guards.pricebook` | `ui.pricebook` |
| `guards.reportingDashboard` | `ui.reporting_dashboard` |

### Helper Functions

```typescript
// Initialize with database adapter (call once at startup)
await initializeCapabilities(db);

// Check multiple capabilities (ALL must be enabled)
const canProcess = await checkAllCapabilities(['external.afip', 'services.cae_queue'], orgId);

// Check if ANY capability is enabled
const hasMessaging = await checkAnyCapability(['external.whatsapp', 'external.push_notifications'], orgId);
```

### requireCapability Decorator

Method decorator for capability enforcement:

```typescript
class MyService {
  @requireCapability('external.afip')
  async requestCAE(data: any) {
    // Throws CapabilityDisabledError if disabled
  }
}
```

### Event System Integration

Capability changes emit events via the event bus:

```typescript
// Location: src/lib/services/event-bus.ts
// Event: CAPABILITY_CHANGED

eventBus.on('CAPABILITY_CHANGED', ({ path, enabled, orgId }) => {
  // React to capability changes
});
```

### CLI Tools

**Capability Status Tool:**
```bash
# Location: scripts/capability-status.ts
npx ts-node scripts/capability-status.ts

# Shows current state of all capabilities with override sources
```

**Panic Controller Integration:**
```bash
# Location: scripts/panic/panic-cli.ts
# Capabilities integrate with panic mode for emergency disabling
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

# 11. SUBSCRIPTION TIER MAPPING

## Tier Definitions

CampoTech capabilities are gated by subscription tier. The following tiers control feature access:

| Tier | Monthly Price (ARS) | Description |
|------|---------------------|-------------|
| **GRATIS** | $0 | Free tier with basic job management |
| **BASICO** | $5,000 | Small business essentials |
| **PROFESIONAL** | $15,000 | Full feature access for growing businesses |
| **EMPRESA** | $40,000+ | Enterprise features + custom integrations |

## Capability-to-Tier Matrix

| Capability | GRATIS | BASICO | PROFESIONAL | EMPRESA |
|------------|--------|--------|-------------|---------|
| **Core Features** | | | | |
| `invoicing` | ✅ | ✅ | ✅ | ✅ |
| `payments` | - | ✅ | ✅ | ✅ |
| `scheduling` | ✅ | ✅ | ✅ | ✅ |
| `job_assignment` | - | ✅ | ✅ | ✅ |
| **Communication** | | | | |
| `whatsapp` | - | ✅ | ✅ | ✅ |
| `whatsapp_voice_ai` | - | - | ✅ | ✅ |
| `push_notifications` | - | ✅ | ✅ | ✅ |
| **Phase 7-10 Features** | | | | |
| `calendar_view` | ✅ | ✅ | ✅ | ✅ |
| `fleet_management` | - | - | ✅ | ✅ |
| `vehicle_documents` | - | - | ✅ | ✅ |
| `inventory_management` | - | - | ✅ | ✅ |
| `live_tracking_map` | - | - | ✅ | ✅ |
| `nearest_technician` | - | - | ✅ | ✅ |
| **Advanced Features** | | | | |
| `technician_gps` | - | ✅ | ✅ | ✅ |
| `offline_sync` | - | - | ✅ | ✅ |
| `consumer_marketplace` | - | - | - | ✅ |
| `customer_portal` | - | - | ✅ | ✅ |
| `audit_logging` | - | - | ✅ | ✅ |
| **UI Features** | | | | |
| `calendar_dashboard` | ✅ | ✅ | ✅ | ✅ |
| `fleet_dashboard` | - | - | ✅ | ✅ |
| `inventory_dashboard` | - | - | ✅ | ✅ |
| `live_map_dashboard` | - | - | ✅ | ✅ |
| `reporting_dashboard` | - | ✅ | ✅ | ✅ |
| `marketplace_dashboard` | - | - | - | ✅ |
| `whitelabel_portal` | - | - | - | ✅ |

## Tier Feature Summary

### GRATIS (Free Tier)
- Basic job management
- Simple invoicing (no AFIP integration)
- Calendar view for job scheduling
- 1 user limit

### BASICO (Basic Tier)
- Full invoicing with AFIP CAE
- WhatsApp notifications
- GPS tracking (view only)
- Reporting dashboard
- Up to 3 users

### PROFESIONAL (Professional Tier)
- **Fleet Management** (vehicles, documents, VTV tracking)
- **Inventory Management** (stock, transfers, usage tracking)
- **Live Tracking Map** (real-time technician locations)
- **Nearest Technician** (find closest available tech)
- Offline sync for mobile
- Customer portal
- Audit logging
- Up to 10 users

### EMPRESA (Enterprise Tier)
- Consumer marketplace access
- White-label customer portal
- Marketplace dashboard
- Voice AI processing
- Custom integrations
- Unlimited users
- Priority support

---

# DOCUMENT METADATA

| Field | Value |
|-------|-------|
| **Document ID** | capabilities-001 |
| **Version** | 1.3 |
| **Status** | Active |
| **Author** | CampoTech Architecture Team |
| **Last Updated** | 2025-12-12 |
| **Related Documents** | campotech-architecture-complete.md, campotech-queue-worker-architecture.md |
| **Runtime File** | core/config/capabilities.ts |
| **Additional Files** | core/services/capability-guards.ts, core/repositories/capability-override.repository.ts, scripts/capability-status.ts |

## Changelog

### v1.3 (2025-12-12)
- **ADDED:** Phase 7-10 domain capabilities (calendar_view, fleet_management, vehicle_documents, live_tracking_map, nearest_technician)
- **ADDED:** Phase 8-9 service capabilities (fleet_expiry_alerts, inventory_stock_alerts)
- **ADDED:** Phase 7-10 UI capabilities (calendar_dashboard, fleet_dashboard, inventory_dashboard, live_map_dashboard)
- **ADDED:** Section 11: Subscription Tier Mapping with tier-to-capability matrix
- **UPDATED:** Dependency graph with new Fleet, Inventory, Calendar, and Map capabilities
- **UPDATED:** Capability Status Reference table with 11 new capabilities
- **UPDATED:** inventory_management dependency to include inventory_stock_alerts

### v1.2 (2025-12-10)
- Added critical implementation warnings (worker integration gap, Admin UI issues)
- Fixed function name: `getCapabilityValue()` → `getCapabilityWithEnvOverride()`
- Documented advanced features: CapabilityService class, database overrides, guards, CLI tools
- Added per-organization override documentation
- Added capability expiration/TTL support documentation
- Added event system integration documentation

---

*This document is the authoritative reference for CampoTech's kill-switch architecture. All module integrations MUST follow the patterns defined here.*
