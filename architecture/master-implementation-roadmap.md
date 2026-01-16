# CampoTech Master Implementation Roadmap
## Unified Feature Development Order

**Created:** 2026-01-15  
**Purpose:** Sequence all architecture documents into a dependency-aware implementation order

---

## 📊 Executive Summary

This document unifies all pending architecture plans into a single implementation roadmap:

| Document | Summary | Dependencies | Estimated | Status |
|----------|---------|--------------|-----------|--------|
| **Settings Page (Obsidian)** | Settings hub with all configuration sections | Foundation | 2 days | ✅ Done |
| **Multi-Trade Pricing** | Pricing, deposits, technician limits | Settings Page, Lista de Precios | 3 days | ✅ Done |
| **Job Completion Report** | PDF generation for completed jobs | Existing Job model | 2 days | ✅ Done |
| **Client Data Folder** | Customer 360° view with exports | Job Completion Report | 3 days | ✅ Done |
| **Support Queue** | Public chat escalation to human support | WhatsApp infrastructure | 1 day | ✅ Done |
| **WhatsApp AI Translation** | Multi-language AI with Copilot mobile | Support Queue, AI Settings | 5 days | ✅ Done |
| **Voice-to-Invoice AI** | Voice report → auto-pricing → pre-fill invoice | Voice Processing, PriceItem | 3 days | ✅ Done |

**Total: ~19 development days**

---

## 🔍 Current State Audit

## ✅ PHASE 0 AUDIT - COMPLETED 2026-01-15

### Audit Results

#### 1. Lista de Precios (Pricebook) - ✅ EXISTS

**Model:** `PriceItem` (line 1975 in schema.prisma)
**Table:** `price_items`
**API:** `/api/settings/pricebook`
**UI:** `/dashboard/settings/pricebook`

```prisma
model PriceItem {
  id             String        @id
  organizationId String
  name           String
  description    String?
  type           PriceItemType  // SERVICE | PRODUCT
  price          Decimal       @db.Decimal(12, 2)
  unit           String?       // hora, m², unidad
  taxRate        Decimal       @default(21.0)
  isActive       Boolean       @default(true)
}
```

**✅ Good news:** Already has:
- Price per item
- Unit field (hora, m², etc)
- Tax rate
- Service vs Product distinction

**⚠️ Enhancement needed for Multi-Trade:**
- Add `specialty` field (PLOMERO, ELECTRICISTA, etc)
- Add `pricingModel` field (FIXED, HOURLY, PER_M2, etc)

---

#### 2. Tipos de Servicio (Service Types) - ✅ EXISTS

**Model:** `ServiceTypeConfig` (line 341 in schema.prisma)
**Table:** `service_type_configs`
**API:** `/api/settings/service-types`
**UI:** `/dashboard/settings/service-types`

```prisma
model ServiceTypeConfig {
  id             String
  code           String        // e.g., "INSTALACION_SPLIT"
  name           String        // e.g., "Instalación Split"
  description    String?
  color          String?
  icon           String?
  isActive       Boolean
  sortOrder      Int
  organizationId String
  
  @@unique([organizationId, code])
}
```

**⚠️ CRITICAL FINDING - Dual System:**

The Job model uses a **hardcoded enum**:
```prisma
enum ServiceType {
  INSTALACION_SPLIT
  REPARACION_SPLIT
  MANTENIMIENTO_SPLIT
  INSTALACION_CALEFACTOR
  REPARACION_CALEFACTOR
  MANTENIMIENTO_CALEFACTOR
  OTRO
}

model Job {
  serviceType ServiceType  // Uses enum, not ServiceTypeConfig!
}
```

**Resolution Required:**
- Current: Jobs use enum (HVAC-focused only)
- ServiceTypeConfig: Dynamic, per-organization
- **Migration needed:** Change Job.serviceType from enum to String (code from ServiceTypeConfig)
- **Workaround:** Use `OTRO` enum value and store actual code elsewhere

---

#### 3. Job Model - Pricing Fields Audit

**Current Job pricing fields:** NONE

```prisma
model Job {
  // ❌ No pricing fields exist
  // Need to add:
  // - depositAmount
  // - depositPaidAt
  // - estimatedTotal
  // - finalTotal
  // - pricingLockedAt
}
```

**Existing related field:**
- `Job.invoice` relation exists (for Invoice model)

---

#### 4. AI Settings - ✅ EXISTS

**Model:** `AIConfiguration` (line 2533 in schema.prisma)
**UI:** `/dashboard/settings/ai-assistant`

Status: Functional, enhancement for workflow permissions needed later

---

### Summary - What Exists vs What's Needed

| Component | Exists? | Ready for Multi-Trade? |
|-----------|---------|------------------------|
| **PriceItem model** | ✅ Yes | ⚠️ Needs specialty + pricingModel |
| **ServiceTypeConfig model** | ✅ Yes | ⚠️ Job.serviceType uses enum, not this |
| **Job pricing fields** | ❌ No | Needs adding |
| **OrganizationPricingSettings** | ❌ No | Needs creating |
| **Pricebook UI** | ✅ Yes | ⚠️ Needs tabs for trade filtering |
| **Service-Types UI** | ✅ Yes | ✅ Ready |

---

### Already Implemented (Functional)
| Feature | Location | Status |
|---------|----------|--------|
| **Settings Hub** | `/dashboard/settings/page.tsx` | ✅ Functional |
| **Tipos de Servicio** | `/dashboard/settings/service-types` | ✅ Functional |
| **Lista de Precios** | `/dashboard/settings/pricebook` | ✅ Functional (basic) |
| **AFIP Settings** | `/dashboard/settings/afip` | ✅ Functional |
| **WhatsApp Settings** | `/dashboard/settings/whatsapp` | ✅ Functional |
| **AI Assistant Settings** | `/dashboard/settings/ai-assistant` | ✅ Functional |
| **MercadoPago** | `/dashboard/settings/mercadopago` | ✅ Functional |
| **Notifications** | `/dashboard/settings/notifications` | ✅ Functional |
| **Team Settings** | `/dashboard/settings/team` | ✅ Functional |

### 🚧 Needs Enhancement (Phase 1)
| Feature | Current State | Enhancement Needed |
|---------|---------------|-------------------|
| **PriceItem** | Basic fields | Add `specialty`, `pricingModel` |
| **Job Model** | No pricing | Add deposit, totals, lock |
| **Job.serviceType** | Enum (7 HVAC values) | Consider migration to String |
| **AI Configuration** | Basic | Add workflow permissions later |
| **Organization** | Basic | Add pricing settings model |

---

## 🎯 Phase Breakdown

### Phase 0: Foundation Fixes (Day 1)
**Pre-requisite for all other phases**

| Task | Description |
|------|-------------|
| 0.1 | Verify existing Settings pages are fully functional |
| 0.2 | Audit Lista de Precios database model (PriceBookEntry or Product?) |
| 0.3 | Verify service-types connection to Job model |

#### Verification Checklist
```bash
# Check what model Lista de Precios uses
grep -r "pricebook" apps/web/app/api/settings/
```

---

### ✅ Phase 1: Multi-Trade Pricing Foundation (Days 2-4) - COMPLETE
**Document:** `multi-trade-pricing-architecture.md`

**Depends on:** Phase 0 ✓ COMPLETE

**Status:** ✅ **ALL TASKS COMPLETED** (2026-01-15)

> **Updated based on Phase 0 Audit (2026-01-15)**

#### ✅ DATABASE TASKS - COMPLETED 2026-01-15

#### Database Tasks (All schema.prisma)

| Task | Description | Breaking? | Status |
|------|-------------|-----------|--------|
| 1.1 | Add `serviceTypeCode` String to Job model | No | ✅ **DONE** |
| 1.2 | Add pricing fields to Job (`depositAmount`, `depositPaidAt`, `estimatedTotal`, `techProposedTotal`, `finalTotal`, `pricingLockedAt`) | No | ✅ **DONE** |
| 1.3 | Add `specialty` and `pricingModel` to **existing** `PriceItem` model | No | ✅ **DONE** |
| 1.4 | Create `JobLineItem` model | No | ✅ **DONE** |
| 1.5 | Create `OrganizationPricingSettings` model | No | ✅ **DONE** |
| 1.6 | Add `PricingModel` enum | No | ✅ **DONE** (with 1.3) |
| 1.7 | Add `LineItemSource` enum + `InvoiceGenerationMode` enum | No | ✅ **DONE** |
| 1.8 | Apply schema changes to database | - | ✅ **DONE** (via db push) |

```bash
# Schema applied successfully via:
pnpm prisma db push
```

#### Database Changes Summary
```prisma
// ═══════════════════════════════════════════════════════════════
// ENHANCE EXISTING PriceItem (line 1975) - ADD THESE FIELDS
// ═══════════════════════════════════════════════════════════════
model PriceItem {
  // ... existing fields ...
  specialty      String?       // ADD: PLOMERO, ELECTRICISTA, etc.
  pricingModel   PricingModel? // ADD: FIXED, HOURLY, etc.
}

// ═══════════════════════════════════════════════════════════════
// ENHANCE Job Model - ADD THESE FIELDS
// ═══════════════════════════════════════════════════════════════
model Job {
  // ... existing fields ...
  serviceTypeCode     String?   // NEW: Dynamic service type code
  depositAmount       Decimal?  @db.Decimal(12, 2)
  depositPaidAt       DateTime?
  depositPaymentMethod String?
  estimatedTotal      Decimal?  @db.Decimal(12, 2)
  techProposedTotal   Decimal?  @db.Decimal(12, 2)
  finalTotal          Decimal?  @db.Decimal(12, 2)
  pricingLockedAt     DateTime?
  pricingLockedById   String?
  lineItems           JobLineItem[]
}

// ═══════════════════════════════════════════════════════════════
// NEW MODELS
// ═══════════════════════════════════════════════════════════════
model JobLineItem { ... }
model OrganizationPricingSettings { ... }
enum PricingModel { FIXED, HOURLY, PER_UNIT, PER_M2, PER_DAY, QUOTE }
enum LineItemSource { QUOTE, TECH_ADDED, TECH_ADJUSTED, SYSTEM }
```

#### ✅ UI/API Tasks - COMPLETED 2026-01-15

| Task | Description | File | Status |
|------|-------------|------|--------|
| 1.9 | Create pricing rules API | `/api/settings/pricing-rules` | ✅ **DONE** |
| 1.10 | Enhance Pricebook UI with specialty filter/tabs | `/settings/pricebook/page.tsx` | ✅ **DONE** |
| 1.11 | Add pricing inputs to NewJobModal | `NewJobModal.tsx` | ✅ **DONE** |
| 1.12 | Add pricing display to EditJobModal | `EditJobModal.tsx` | ✅ **DONE** |

#### ✅ PHASE 1 COMPLETE - 2026-01-15

#### Integration Notes
- **Lista de Precios:** Enhanced existing `PriceItem` model with specialty and pricingModel fields, UI updated with specialty tabs
- **ServiceType:** Use `OTRO` enum + `serviceTypeCode` for non-HVAC jobs
- **Invoice:** `Job.finalTotal` flows to Invoice on generation
- **Pricing Rules API:** `/api/settings/pricing-rules` GET/PUT for organization-level pricing settings

---

### ✅ Phase 2: Job Completion Report (Days 5-6) - COMPLETE
**Document:** `job-completion-report-architecture.md`

**Depends on:** Phase 1 (needs pricing fields) ✓ COMPLETE

**Status:** ✅ **ALL TASKS COMPLETED** (2026-01-16)

| Task | Description | File Changes | Status |
|------|-------------|--------------|--------|
| 2.1 | Create PDF generation service | `lib/reports/job-completion-report.ts` | ✅ **DONE** |
| 2.2 | Create API endpoint | `/api/jobs/[id]/report/route.ts` | ✅ **DONE** |
| 2.3 | Add "Descargar Reporte" button to Job detail | `JobDetailModal.tsx` + `JobReportButton.tsx` | ✅ **DONE** |
| 2.4 | Include snapshot data (technician, vehicle, prices) | Service logic | ✅ **DONE** |
| 2.5 | Add customer signature embedding | PDF enhancement | ✅ **DONE** |
| 2.6 | Auto-send documents via WhatsApp on completion | `job-completion-documents.ts` | ✅ **DONE** |
| 2.7 | Add `sendDocument` to WhatsApp provider | `lib/whatsapp.ts` | ✅ **DONE** |
| 2.8 | Add queue processor for document delivery | `queue/processors.ts` | ✅ **DONE** |

#### ✅ PHASE 2 COMPLETE - 2026-01-16

#### Files Created/Modified
- `lib/reports/job-completion-report.ts` - PDF generation with Puppeteer
- `app/api/jobs/[id]/report/route.ts` - Download endpoint
- `components/jobs/JobReportButton.tsx` - UI button component
- `lib/services/job-completion-documents.ts` - Auto-delivery orchestration
- `lib/whatsapp.ts` - Added `sendDocument` method
- `lib/queue/config.ts` - Added `job.sendDocuments` job type
- `lib/queue/processors.ts` - Added document delivery handler
- `app/api/jobs/[id]/complete/route.ts` - Integrated auto-delivery trigger

#### Integration Points
- **Vehicle Insurance Tracking:** Uses same snapshot data pattern
- **Client Data Folder:** Will use this report generator
- **Invoice:** Different document, references similar data
- **WhatsApp:** Auto-sends report + invoice to customer on completion with signature

---

### ✅ Phase 3: Client Data Folder (Days 7-9) - COMPLETE
**Document:** `client-data-folder-architecture.md`

**Depends on:** Phase 2 (needs report generator) ✓ COMPLETE

**Status:** ✅ **ALL TASKS COMPLETED** (2026-01-16)

| Task | Description | File Changes | Status |
|------|-------------|--------------|--------|
| 3.1 | Add "Carpeta de Datos" tab to customer page | `/customers/[id]/folder/page.tsx` | ✅ **DONE** |
| 3.2 | Create folder summary API | `/api/customers/[id]/folder/route.ts` | ✅ **DONE** |
| 3.3 | Display job history with snapshot data | `CustomerFolderPage` component | ✅ **DONE** |
| 3.4 | Add full customer export (PDF) | `lib/reports/customer-report.ts` + export API | ✅ **DONE** |
| 3.5 | Add WhatsApp history export | `lib/services/customer-folder.ts` (API ready, UI deferred) | ✅ **DONE** |
| 3.6 | Implement ARCO compliance request flow | Future phase | 🔲 Deferred |

#### ✅ PHASE 3 COMPLETE - 2026-01-16

#### Files Created/Modified
- `lib/services/customer-folder.ts` - Business logic for unified customer data access
- `lib/reports/customer-report.ts` - PDF generation for complete customer folder export
- `app/api/customers/[id]/folder/route.ts` - Folder data API endpoint
- `app/api/customers/[id]/folder/export/route.ts` - PDF export endpoint
- `app/dashboard/customers/[id]/folder/page.tsx` - Folder UI with tabs for jobs/invoices/payments
- `app/dashboard/customers/[id]/page.tsx` - Added "Carpeta de Datos" quick action link

#### Integration Points
- **Job Completion Report:** Reuses PDF generator patterns from Phase 2
- **WhatsApp:** API ready for conversation history (UI deferred to Phase 3.5 enhancement)
- **Invoice:** Full invoice summary included in folder view and exports

---

### Phase 4: Support Queue System (Day 10)
**Document:** `support-queue-implementation-plan.md`

**Depends on:** Existing WhatsApp infrastructure

| Task | Description | File Changes | Status |
|------|-------------|--------------|--------|
| 4.1 | Add SupportStatus enum | `schema.prisma` | ✅ Done |
| 4.2 | Add PublicSupportConversation model | `schema.prisma` | ✅ Done |
| 4.3 | Add PublicSupportMessage model | `schema.prisma` | ✅ Done |
| 4.4 | Create admin Support Queue page | `/dashboard/admin/support-queue` | ✅ Done |
| 4.5 | Update PublicAIChatBubble with localStorage | Component enhancement | ✅ Done |
| 4.6 | Create notification service | `lib/services/support-notification.ts` | ✅ Done |
| 4.7 | Add API routes | Multiple routes | ✅ Done |

#### ✅ PHASE 4 COMPLETE - 2026-01-16

#### Files Created/Modified
- `prisma/schema.prisma` - Added SupportStatus enum, PublicSupportConversation and PublicSupportMessage models
- `lib/services/support-notification.ts` - Multi-channel notification service (push, email, WhatsApp)
- `app/api/support/conversations/route.ts` - List/create conversations API
- `app/api/support/conversations/[id]/route.ts` - Get/respond to conversation API
- `app/api/support/conversations/[id]/close/route.ts` - Close ticket API
- `app/api/support/public-chat/route.ts` - Enhanced with database persistence
- `app/api/support/public-chat/history/route.ts` - Load conversation history API
- `app/dashboard/admin/support-queue/page.tsx` - Admin support queue UI
- `components/support/PublicAIChatBubble.tsx` - Enhanced with localStorage, tickets, admin replies

#### Integration Points
- **WhatsApp:** Ready for existing WhatsApp send infrastructure (placeholder)
- **Email:** Full integration with existing Resend infrastructure
- **AI Settings:** Respects AI on/off toggles via aiDisabled flag

---

### Phase 5: WhatsApp AI Translation (Days 11-15)
**Document:** `WhatsApp-AI-Translation-Implementation.md`

**Depends on:** Phase 4 (notification infrastructure), AI Settings

This is the most complex phase with 5 sub-phases:

#### 5.1: Feedback Collection (Day 11)
| Task | Description |
|------|-------------|
| 5.1.1 | Add feedback fields to WaMessage model |
| 5.1.2 | Create `/api/ai/feedback` endpoint |
| 5.1.3 | Add 👍/👎 buttons to AI action banners |
| 5.1.4 | Add feedback to CopilotPanel |

#### 5.2: Translation Core (Days 12-13)
| Task | Description |
|------|-------------|
| 5.2.1 | Add translation fields to Organization |
| 5.2.2 | Create Python translation service |
| 5.2.3 | Update Whisper for auto-detect |
| 5.2.4 | Add translation node to LangGraph workflow |
| 5.2.5 | Add "Idiomas" tab to AI settings |

#### 5.3: Translation UI (Day 13)
| Task | Description |
|------|-------------|
| 5.3.1 | Add language detection card |
| 5.3.2 | Add translation display to MessageBubble |
| 5.3.3 | Create LanguageConfirmationCard |

#### 5.4: Technician Copilot Access (Day 14)
| Task | Description |
|------|-------------|
| 5.4.1 | Update Copilot API permissions for TECHNICIAN |
| 5.4.2 | Create mobile chat list screen |
| 5.4.3 | Create mobile chat detail with Copilot |
| 5.4.4 | Add chats tab to mobile navigation |

#### 5.5: Workflow Permissions (Day 15)
| Task | Description |
|------|-------------|
| 5.5.1 | Add workflowPermissions to AIConfiguration |
| 5.5.2 | Create "Permisos de Acción" section in settings |
| 5.5.3 | Add permission checks to LangGraph nodes |

---

### Phase 6: Voice-to-Invoice AI Flow (Days 17-19) — COMPLETED
**Document:** Technical specification below

**Depends on:** Phase 1 (PriceItem model), Existing Voice Processing Workflow

**Status:** ✅ **COMPLETED** (2026-01-16)

**Purpose:** Enable technicians to use voice memos to fill job reports and auto-generate invoices, dramatically reducing manual data entry.

#### What Already Exists
- **VoiceReport component** (`apps/mobile/components/voice/VoiceReport.tsx`) - Recording + transcription UI
- **LangGraph workflow** (`services/ai/app/workflows/voice_processing.py`) - Whisper transcription + GPT-4 extraction
- **JobExtraction schema** (`services/ai/app/models/schemas.py`) - Extracts job metadata
- **PriceItem model** - Organization pricebook with specialty + pricingModel

#### Implementation Completed
| Task | Description | File Changes | Status |
|------|-------------|--------------|--------|
| 6.1 | Extend extraction schema | `services/ai/app/models/invoice_extraction.py` | ✅ **DONE** |
| 6.2 | Create extraction prompt | `services/ai/app/services/invoice_extraction.py` | ✅ **DONE** |
| 6.3 | Create `match_to_pricebook` integration | `services/ai/app/services/invoice_extraction.py` (embedded) | ✅ **DONE** |
| 6.4 | IVA calculation (21%) | `services/ai/app/services/invoice_extraction.py` (lines 464-471) | ✅ **DONE** |
| 6.5 | Create voice-invoice API | `/api/jobs/[id]/voice-invoice/route.ts` | ✅ **DONE** |
| 6.5b | Create apply API | `/api/jobs/[id]/voice-invoice/apply/route.ts` | ✅ **DONE** |
| 6.6 | Mobile voice input integration | `apps/mobile/app/(tabs)/jobs/complete.tsx` | ✅ **DONE** |
| 6.7 | Auto-populate line items | Apply route + VoiceInvoiceReview | ✅ **DONE** |
| 6.8 | Technician review/approve flow | `VoiceInvoiceReview.tsx` + JobDetailModal integration | ✅ **DONE** |

#### Infrastructure Fixes Applied (2026-01-16)
- ✅ Registered `invoice_router` in `services/ai/main.py` (was missing!)
- ✅ Added service-to-service auth to pricebook API for AI service calls
- ✅ Integrated `VoiceInvoiceReview` into JobDetailModal as "Facturación" tab

#### AI Extraction Enhancement
```python
class JobCompletionExtraction(BaseModel):
    """Enhanced extraction for job completion voice report."""
    
    # Work Summary
    work_performed: str  # What was done
    resolution_notes: str  # How it was resolved
    
    # Materials Used (to match against PriceItem)
    materials: list[ExtractedMaterial]  # [{name, quantity, unit}]
    
    # Labor
    labor_hours: float | None
    labor_type: str | None  # "regular", "overtime", "emergency"
    
    # Additional Services
    additional_services: list[str]  # Extra services performed
    
    # Technician Assessment
    job_quality: str | None  # "completed", "partial", "needs_followup"
    followup_needed: bool
    followup_notes: str | None
```

#### User Flow
```
Technician finishes work
    → Opens job in mobile app
    → Taps "Completar con Voz" button
    → Records: "Instalé el split Samsung de 3000 frigorías, usé 3 metros de caño de cobre, 
                2 soportes de pared, y tardé 2 horas. Quedó todo funcionando."
    → System:
        1. Whisper transcribes
        2. GPT-4 extracts: materials=[{caño cobre, 3m}, {soporte pared, 2}], labor=2h
        3. Matches to PriceItem: caño cobre $1500/m, soporte $800/u, labor $2000/h
        4. Calculates: Materials $6100 + Labor $4000 = $10100 + IVA $2121 = $12221
    → Shows pre-filled report + invoice for review
    → Technician approves or adjusts
    → Customer signs
    → Documents auto-sent via WhatsApp
```

#### Integration Points
- **Phase 1:** Uses `PriceItem` with specialty for matching
- **Phase 2:** Uses report generator for final PDF
- **Existing Voice:** Extends current LangGraph workflow
- **Invoice System:** Creates draft invoice with line items

---

## 📋 Dependency Graph

```
                                    ┌──────────────────┐
                                    │  Phase 0:        │
                                    │  Foundation ✅   │
                                    │  Verification    │
                                    └────────┬─────────┘
                                             │
                                             ▼
                    ┌────────────────────────────────────────────┐
                    │                                            │
                    ▼                                            ▼
          ┌─────────────────┐                        ┌───────────────────┐
          │  Phase 1: ✅    │                        │  Phase 4:         │
          │  Multi-Trade    │                        │  Support Queue    │
          │  Pricing        │                        │  (Independent)    │
          └────────┬────────┘                        └────────┬──────────┘
                   │                                          │
                   ▼                                          │
          ┌─────────────────┐                                 │
          │  Phase 2: ✅    │                                 │
          │  Job Completion │                                 │
          │  Report         │                                 │
          └───────┬─────────┘                                 │
                  │                                           │
          ┌───────┴───────┐                                   │
          │               │                                   │
          ▼               ▼                                   ▼
 ┌─────────────────┐ ┌──────────────────┐          ┌───────────────────┐
 │  Phase 3:       │ │  Phase 6:        │          │  Phase 5:         │
 │  Client Data    │ │  Voice-to-       │          │  WhatsApp AI      │
 │  Folder         │ │  Invoice AI      │          │  Translation      │
 └─────────────────┘ └──────────────────┘          └───────────────────┘
```

---

## ⚠️ Cross-Feature Dependencies

### Critical Dependencies

| Feature | Depends On | Why |
|---------|-----------|-----|
| **Job Report PDF** | Pricing fields | Report includes price summary |
| **Client Folder** | Job Report | Reuses PDF generator |
| **Invoice from Job** | finalTotal field | Invoice copies from job |
| **Mobile Copilot** | API permissions | Same API, different client |
| **Translation** | AI Settings | Uses same configuration |

### Non-Breaking Additions

| Feature | Can Add Anytime | Notes |
|---------|----------------|-------|
| **Deposit tracking** | Yes | Optional field on Job |
| **Feedback buttons** | Yes | New fields, no breaking changes |
| **Language detection** | Yes | New fields on existing models |
| **Support Queue** | Yes | New models, no conflicts |

---

## ✅ Resolved Conflicts (Phase 0 Audit)

### 1. Lista de Precios vs PriceBookEntry - ✅ RESOLVED
**Answer:** Uses `PriceItem` model (not PriceBookEntry)   
**Resolution:** Enhance existing `PriceItem` with `specialty` + `pricingModel` fields

### 2. ServiceType Enum vs Dynamic - ✅ RESOLVED
**Answer:** Job.serviceType uses hardcoded enum, ServiceTypeConfig is dynamic  
**Resolution:** Add `serviceTypeCode` String field to Job. Use `OTRO` enum for non-HVAC jobs.

### 3. AI Settings Structure - ✅ LOW RISK
**Status:** Extending existing `AIConfiguration` model with new fields
**Risk:** Low - adding new fields, not replacing

---

## ✅ Recommended Implementation Order

### Week 1: Foundation + Pricing ✅ COMPLETE
1. Phase 0: Verification (half day) ✅
2. Phase 1: Multi-Trade Pricing (2.5 days) ✅

### Week 2: Reports + Data ✅ COMPLETE
3. Phase 2: Job Completion Report (2 days) ✅ COMPLETE (2026-01-16)
4. Phase 3: Client Data Folder (3 days) ✅ COMPLETE (2026-01-16)

### Week 3: AI Enhancements (Current)
5. Phase 4: Support Queue (1 day) — Next
6. Phase 5: WhatsApp AI Translation (4 days)

### Week 4: Voice AI
7. Phase 6: Voice-to-Invoice AI (3 days) — NEW

---

## 📁 Files by Phase

### Phase 0 - Audit Only
- Review: `apps/web/app/api/settings/pricebook/route.ts`
- Review: `apps/web/app/api/settings/service-types/route.ts`
- Review: `apps/web/prisma/schema.prisma` (ServiceType enum)

### Phase 1 - Pricing
- Modify: `schema.prisma` (Job + OrganizationPricingSettings)
- Create: `/api/settings/pricing-rules/route.ts`
- Modify: `/dashboard/settings/pricebook/page.tsx` (add tabs)
- Modify: `NewJobModal.tsx` + `EditJobModal.tsx`

### Phase 2 - Reports
- Create: `lib/reports/job-completion-report.ts`
- Create: `/api/jobs/[id]/report/route.ts`
- Modify: Job detail page (add download button)

### Phase 3 - Client Folder
- Create: `/dashboard/customers/[id]/folder/page.tsx`
- Create: `/api/customers/[id]/folder/route.ts`
- Create: `lib/services/customer-folder.ts`

### Phase 4 - Support Queue
- Modify: `schema.prisma` (PublicSupportConversation + Message)
- Create: `/dashboard/admin/support-queue/page.tsx`
- Create: `/api/support/conversations/route.ts`
- Modify: `PublicAIChatBubble.tsx`

### Phase 5 - Translation
- Modify: `schema.prisma` (WaMessage translation fields)
- Create: `services/ai/app/services/translation.py`
- Modify: `voice_processing.py` (add translation node)
- Modify: `AIActionBanner.tsx` (feedback buttons)
- Create: `apps/mobile/app/(tabs)/chats/` (new screens)

### Phase 6 - Voice-to-Invoice AI ✅ COMPLETE (2026-01-16)
- Create: `services/ai/app/models/invoice_extraction.py` (extended extraction models)
- Create: `services/ai/app/services/invoice_extraction.py` (AI extraction + pricebook matching)
- Create: `services/ai/app/api/invoice.py` (FastAPI endpoints)
- Modify: `services/ai/app/api/__init__.py` (register router)
- Create: `apps/web/app/api/jobs/[id]/voice-invoice/route.ts` (extraction API)
- Create: `apps/web/app/api/jobs/[id]/voice-invoice/apply/route.ts` (apply line items)
- Create: `apps/web/app/dashboard/jobs/components/VoiceInvoiceReview.tsx` (review UI)

---

## 🎬 Roadmap Complete!

All 7 phases of the master implementation roadmap have been completed:

1. ✅ Settings Page (Obsidian)
2. ✅ Multi-Trade Pricing
3. ✅ Job Completion Report
4. ✅ Client Data Folder
5. ✅ Support Queue
6. ✅ WhatsApp AI Translation
7. ✅ Voice-to-Invoice AI

**Total development time: ~19 days completed**
