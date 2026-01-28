# CampoTech Dashboard Pages Audit Report

> **Generated:** January 25, 2026
> 
> **Total Pages:** 119 page.tsx files
> 
> **Total TSX Files:** ~150+ including modals and components

---

## 📊 Executive Summary

| Metric | Count |
|--------|-------|
| Total page.tsx files | 119 |
| Dashboard sections | 26 |
| Largest file | team/page.tsx (2,507 lines) |
| Files > 1000 lines | 9 |
| Admin-only pages | ~20 |
| Settings pages | 14 |

### Key Findings

| Category | Status | Notes |
|----------|--------|-------|
| Dead/Placeholder Pages | ✅ None found | No "Coming Soon" or stub pages |
| Duplicate Functionality | ⚠️ 2 potential | team vs settings/team |
| Oversized Files | ⚠️ 9 files | >1000 lines, need refactoring |
| Incomplete Features | ⚠️ Review needed | Growth engine, some admin pages |
| Legacy/Spanish Mix | ⚠️ Minor | configuracion vs settings |

---

## 🔍 Detailed Analysis by Section

### 1. ADMIN SECTION (13 subdirectories)
**Purpose:** System administration, monitoring, internal tools
**Access:** OWNER role only

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `admin/page.tsx` | 324 | ✅ Active | Main admin dashboard |
| `admin/audit-logs/page.tsx` | 514 | ✅ Active | Audit trail viewer |
| `admin/capabilities/page.tsx` | 399 | ✅ Active | Feature flags/toggles |
| `admin/dlq/page.tsx` | 410 | ✅ Active | Dead Letter Queue viewer |
| `admin/health/page.tsx` | 338 | ✅ Active | System health monitoring |
| `admin/message-buffers/page.tsx` | ~350 | ✅ Active | WhatsApp message buffers |
| `admin/number-inventory/page.tsx` | 613 | ✅ Active | Phone number management |
| `admin/queue-metrics/page.tsx` | 597 | ✅ Active | BullMQ queue metrics |
| `admin/queues/page.tsx` | ~400 | ✅ Active | Queue management |
| `admin/status/page.tsx` | ~400 | ✅ Active | System status |
| `admin/support-queue/page.tsx` | 530 | ✅ Active | Support ticket queue |
| `admin/sync/page.tsx` | ~300 | ✅ Active | Data sync status |
| `admin/verification-queue/page.tsx` | 624 | ✅ Active | User verification queue |
| `admin/growth-engine/page.tsx` | 534 | ⚠️ Review | Marketing automation |
| `admin/growth-engine/campaigns/page.tsx` | ~400 | ⚠️ Review | Campaign management |
| `admin/growth-engine/email/page.tsx` | 455 | ⚠️ Review | Email campaigns |
| `admin/growth-engine/import/page.tsx` | ~300 | ⚠️ Review | Lead import |
| `admin/growth-engine/launch/page.tsx` | ~300 | ⚠️ Review | Campaign launch |
| `admin/growth-engine/profiles/page.tsx` | 430 | ⚠️ Review | Profile management |
| `admin/growth-engine/scrapers/page.tsx` | 568 | ⚠️ Review | Web scrapers |

**Recommendation:** Growth engine pages need review - may be internal tools not fully production-ready.

---

### 2. SETTINGS SECTION (14 subdirectories)
**Purpose:** User/organization configuration
**Access:** OWNER + some DISPATCHER

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `settings/page.tsx` | 127 | ✅ Active | Settings hub |
| `settings/organization/page.tsx` | 431 | ✅ Active | Org settings |
| `settings/team/page.tsx` | 922 | ⚠️ DUPLICATE? | Similar to dashboard/team |
| `settings/notifications/page.tsx` | 431 | ✅ Active | Notification prefs |
| `settings/billing/page.tsx` | 947 | ✅ Active | Billing & subscription |
| `settings/billing/pending/page.tsx` | ~100 | ✅ Active | Pending payment |
| `settings/billing/success/page.tsx` | ~80 | ✅ Active | Payment success |
| `settings/billing/failure/page.tsx` | ~100 | ✅ Active | Payment failure |
| `settings/pricebook/page.tsx` | 795 | ✅ Active | Service pricing |
| `settings/pricing/page.tsx` | ~500 | ✅ Active | Pricing config |
| `settings/labor-rates/page.tsx` | 589 | ✅ Active | Labor rate config |
| `settings/service-types/page.tsx` | ~300 | ✅ Active | Service types |
| `settings/ai-assistant/page.tsx` | 1,570 | ✅ Active | AI assistant config |
| `settings/whatsapp/page.tsx` | 542 | ✅ Active | WhatsApp config |
| `settings/whatsapp/usage/page.tsx` | ~400 | ✅ Active | WhatsApp usage stats |
| `settings/afip/page.tsx` | 453 | ✅ Active | AFIP integration |
| `settings/mercadopago/page.tsx` | ~300 | ✅ Active | MercadoPago |
| `settings/privacy/page.tsx` | 569 | ✅ Active | Privacy settings |
| `settings/verification/page.tsx` | ~300 | ✅ Active | Verification settings |

**⚠️ POTENTIAL DUPLICATE:** `settings/team/page.tsx` (922 lines) vs `team/page.tsx` (2,507 lines)
- `team/page.tsx` has availability calendar, stats, live status
- `settings/team/page.tsx` has simpler list + add/edit modal
- **Recommendation:** Consolidate into one location, redirect the other

---

### 3. TEAM SECTION (2 items)
**Purpose:** Employee/technician management

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `team/page.tsx` | 2,507 | ⚠️ OVERSIZED | Needs refactoring |
| `team/TeamMemberDetailModal.tsx` | ~500 | ✅ Active | Employee detail modal |

**⚠️ CRITICAL:** `team/page.tsx` at 2,507 lines is too large. Should split into:
- EmployeeListTab component
- AvailabilityTab component  
- AddMemberModal component (already partially extracted)

---

### 4. ANALYTICS SECTION (11 items)
**Purpose:** Business intelligence, reporting

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `analytics/overview/page.tsx` | ~400 | ✅ Active | Main dashboard |
| `analytics/revenue/page.tsx` | ~400 | ✅ Active | Revenue analytics |
| `analytics/operations/page.tsx` | ~400 | ✅ Active | Operations metrics |
| `analytics/technicians/page.tsx` | ~400 | ✅ Active | Tech performance |
| `analytics/customers/page.tsx` | ~400 | ✅ Active | Customer analytics |
| `analytics/predictions/page.tsx` | 915 | ✅ Active | AI predictions |
| `analytics/reports/page.tsx` | 546 | ✅ Active | Report generator |
| `analytics/reports/scheduled/page.tsx` | 697 | ✅ Active | Scheduled reports |
| `analytics/reports/history/page.tsx` | 443 | ✅ Active | Report history |
| `analytics/marketplace/page.tsx` | ~400 | ✅ Active | Marketplace stats |
| `analytics/ai/page.tsx` | ~300 | ✅ Active | AI usage analytics |

**Status:** All active and properly structured.

---

### 5. JOBS SECTION (5 items)
**Purpose:** Core job/work order management

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `jobs/page.tsx` | 1,278 | ⚠️ Large | Job list & management |
| `jobs/[id]/page.tsx` | 1,258 | ⚠️ Large | Job detail |
| `jobs/new/page.tsx` | 1,258 | ⚠️ Large | New job form |
| `jobs/JobDetailModal.tsx` | ~800 | ✅ Active | Quick view modal |
| `jobs/components/VoiceInvoiceReview.tsx` | ~400 | ✅ Active | Voice invoice |

**Recommendation:** Jobs pages are appropriately sized for core functionality.

---

### 6. CUSTOMERS SECTION (6 items)
**Purpose:** Customer management

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `customers/page.tsx` | 1,436 | ⚠️ Large | Customer list |
| `customers/[id]/page.tsx` | 445 | ✅ Active | Customer detail |
| `customers/[id]/folder/page.tsx` | 445 | ✅ Active | Document folder |
| `customers/new/page.tsx` | 445 | ✅ Active | New customer |
| `customers/NewCustomerModal.tsx` | ~600 | ✅ Active | Add customer |
| `customers/CustomerProfileModal.tsx` | ~500 | ✅ Active | Customer profile |

---

### 7. INVENTORY SECTION (17 items)
**Purpose:** Inventory, warehouses, purchase orders

| Page | Lines | Status | Notes |
|------|-------|--------|-------|
| `inventory/page.tsx` | 643 | ✅ Active | Main inventory |
| `inventory/products/page.tsx` | ~400 | ✅ Active | Product list |
| `inventory/products/[id]/page.tsx` | 560 | ✅ Active | Product detail |
| `inventory/products/new/page.tsx` | 560 | ✅ Active | New product |
| `inventory/warehouses/page.tsx` | 453 | ✅ Active | Warehouse list |
| `inventory/warehouses/[id]/page.tsx` | ~500 | ✅ Active | Warehouse detail |
| `inventory/vehicles/page.tsx` | ~400 | ✅ Active | Vehicle inventory |
| `inventory/suppliers/page.tsx` | ~400 | ✅ Active | Supplier list |
| `inventory/purchase-orders/page.tsx` | ~400 | ✅ Active | PO list |
| `inventory/purchase-orders/[id]/page.tsx` | 450 | ✅ Active | PO detail |
| `inventory/purchase-orders/new/page.tsx` | 450 | ✅ Active | New PO |
| `inventory/stock/movements/page.tsx` | 516 | ✅ Active | Stock movements |
| `inventory/InventoryItemModal.tsx` | ~500 | ✅ Active | Item modal |

**Status:** Well structured inventory system.

---

### 8. LOCATIONS SECTION (8 items)
**Purpose:** Service area/zone management

All pages are ~481 lines - **suspiciously uniform size**. May indicate template-based generation or incomplete implementation.

| Page | Status | Notes |
|------|--------|-------|
| `locations/page.tsx` | ✅ Active | Location list |
| `locations/new/page.tsx` | ✅ Active | New location |
| `locations/reports/page.tsx` | ✅ Active | Location reports |
| `locations/[id]/page.tsx` | ✅ Active | Location detail |
| `locations/[id]/dashboard/page.tsx` | ⚠️ Review | May be redundant |
| `locations/[id]/team/page.tsx` | ✅ Active | Location team |
| `locations/[id]/zones/page.tsx` | ✅ Active | Zone management |
| `locations/[id]/settings/page.tsx` | ✅ Active | Location settings |

---

### 9. WHATSAPP SECTION (24 items)
**Purpose:** WhatsApp Business integration

This is a large, feature-rich section with many components:

| Key Pages | Lines | Status |
|-----------|-------|--------|
| Main inbox | ~800 | ✅ Active |
| Templates | ~400 | ✅ Active |
| Components (8) | Various | ✅ Active |

**Status:** Fully functional WhatsApp module.

---

### 10. OTHER SECTIONS

| Section | Pages | Status |
|---------|-------|--------|
| `leads/` | 4 pages | ✅ Active - Lead management |
| `invoices/` | 4 pages | ✅ Active - Invoice generation |
| `payments/` | 3 pages | ✅ Active - Payment tracking |
| `fleet/` | 4 pages | ✅ Active - Fleet management |
| `integrations/` | 2 pages | ✅ Active - Integration hub |
| `map/` | 1 page | ✅ Active - Technician map (2,219 lines - LARGE) |
| `calendar/` | 1 page | ✅ Active - Calendar view |
| `schedule/` | 1 page | ✅ Active - Schedule management |
| `dispatch/` | 1 page | ✅ Active - Dispatch board |
| `profile/` | 1 page | ✅ Active - User profile |
| `approvals/` | 1 page | ✅ Active - Approval queue |
| `voice-review/` | 2 pages | ✅ Active - Voice message review |
| `verificacion/` | 1 page | ✅ Active - Verification center |
| `mi-verificacion/` | 1 page | ✅ Active - Tech self-verification |
| `marketplace/` | 2 pages | ✅ Active - Marketplace |
| `support/` | 2 pages | ✅ Active - Support requests |

---

### 11. POTENTIAL ISSUES FOUND

#### ⚠️ DUPLICATE: `configuracion/` vs `settings/`
- `configuracion/creditos/page.tsx` (406 lines) - WhatsApp credits
- This should probably be under `settings/whatsapp/` or merged

**Recommendation:** Move to `settings/whatsapp/credits/` or `settings/credits/`

#### ⚠️ DUPLICATE: `team/` vs `settings/team/`
- Two team management pages with overlapping functionality
- `team/page.tsx` is the main one with full features
- `settings/team/page.tsx` is a simpler version

**Recommendation:** Deprecate `settings/team/` and keep only `team/`

#### ⚠️ LARGE FILES (>1000 lines)
These files need refactoring:

| File | Lines | Recommendation |
|------|-------|----------------|
| `team/page.tsx` | 2,507 | Split into components |
| `map/page.tsx` | 2,219 | Extract map logic |
| `settings/ai-assistant/page.tsx` | 1,570 | Split config sections |
| `customers/page.tsx` | 1,436 | Extract table/modals |
| `jobs/page.tsx` | 1,278 | Extract to components |
| `jobs/[id]/page.tsx` | 1,258 | Extract sections |
| `jobs/new/page.tsx` | 1,258 | Extract form logic |
| `verificacion/page.tsx` | 1,033 | Split by step |
| `voice-review/[id]/page.tsx` | 1,033 | Extract player/form |

---

## ✅ POSITIVE FINDINGS

1. **No placeholder/stub pages** - All pages have real implementations
2. **No "Coming Soon" pages** - Everything is functional
3. **Consistent patterns** - Most pages follow similar structure
4. **Good use of React Query** - Data fetching is standardized
5. **Protected routes** - Admin pages properly locked down
6. **Spanish localization** - UI is fully in Spanish

---

## 🎯 RECOMMENDATIONS

### Priority 1: Consolidation
1. **Remove `settings/team/`** - Redirect to `team/`
2. **Move `configuracion/creditos/`** - To `settings/credits/` or `settings/whatsapp/credits/`

### Priority 2: Refactoring Large Files
1. **`team/page.tsx`** - Split into 4-5 smaller components
2. **`map/page.tsx`** - Extract map layer logic
3. **`settings/ai-assistant/page.tsx`** - Split by config section

### Priority 3: Typography System
Apply the new typography system to all 92 pages for consistency.

### Priority 4: Code Quality
1. Run ESLint across all pages
2. Remove unused imports
3. Standardize error handling

---

## 📁 FINAL COUNT

| Category | Count |
|----------|-------|
| Production Pages | ~115 |
| Internal/Admin Pages | ~20 |
| Potentially Duplicate | 2-3 |
| Needing Refactor | 9 |
| Dead/Unused | 0 |

**Bottom Line:** The codebase is clean with no dead pages. The main issues are:
- 2 potential duplicates to consolidate
- 9 oversized files to refactor
- Typography inconsistencies (addressed by new system)
