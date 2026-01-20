# Dynamic Pricing System - Implementation Plan

## Overview

This implementation plan covers two interconnected features for the CampoTech pricebook:

1. **Multi-Currency Pricing (USD/ARS)** - Allow prices to be set in USD with automatic ARS conversion
2. **Inflation Adjustment System** - Automatic price adjustment based on CAC/INDEC indices

Both features address the reality of doing business in Argentina's high-inflation economy.

---

## Part 1: Multi-Currency Pricing (USD/ARS)

### Problem Statement

In Argentina's volatile economic environment:
- Many business owners think in USD for stability
- Materials are often priced relative to dollar (especially imported goods)
- ARS prices need constant updating, USD prices are more stable
- Customers pay in ARS, but internal pricing logic may be USD-based

### User Stories

1. **As an owner**, I want to set a service price in USD (e.g., $50 USD) and have it automatically show the ARS equivalent to customers
2. **As an owner**, I want to choose which exchange rate source to use (Dólar Oficial, Dólar Blue, Dólar MEP)
3. **As an owner**, I want prices to auto-update when exchange rate changes significantly
4. **As a technician**, I see prices in ARS only (customer-facing)

### 🪙 El Redondeo (Smart Rounding) - Critical Feature

**The Problem:**
Your current logic calculates: `$15,000 + 6.8% = $16,020`. 

In Argentina, **nobody charges $16,020**:
- Cash is scarce. Small bills are trash.
- A price of $16,020 looks **algorithmic and "cold"**
- A price of $16,000 or $16,500 looks **professional**

**Rounding Strategies:**

| Strategy | Example | Best For |
|----------|---------|----------|
| **ROUND_500** | $16,020 → $16,000 or $16,500 | Most services |
| **ROUND_1000** | $16,020 → $16,000 | Higher-value items |
| **ROUND_100** | $16,020 → $16,000 | Precision items |
| **ROUND_NEAREST** | $16,020 → $16,000 (nearest 500) | Default |
| **ROUND_UP** | $16,020 → $16,500 | Conservative margin protection |
| **ROUND_DOWN** | $16,020 → $16,000 | Customer-friendly |
| **NO_ROUNDING** | $16,020 → $16,020 | Exact calculations |

**Configuration:**
```prisma
// Add to OrganizationPricingSettings
roundingStrategy        RoundingStrategy @default(ROUND_500) @map("rounding_strategy")
roundingDirection       RoundingDirection @default(NEAREST) @map("rounding_direction")

enum RoundingStrategy {
  ROUND_100      // Nearest 100
  ROUND_500      // Nearest 500 (recommended)
  ROUND_1000     // Nearest 1000
  ROUND_5000     // Nearest 5000 (for high-value items)
  NO_ROUNDING    // Keep exact amount
  
  @@map("rounding_strategy")
}

enum RoundingDirection {
  NEAREST        // Round to closest
  UP             // Always round up (margin protection)
  DOWN           // Always round down (customer-friendly)
  
  @@map("rounding_direction")
}
```

**Implementation:**
```typescript
function applySmartRounding(price: Decimal, strategy: RoundingStrategy, direction: RoundingDirection): Decimal {
  const roundingUnit = {
    ROUND_100: 100,
    ROUND_500: 500,
    ROUND_1000: 1000,
    ROUND_5000: 5000,
    NO_ROUNDING: 1,
  }[strategy];
  
  const priceNum = price.toNumber();
  
  switch (direction) {
    case 'UP':
      return new Decimal(Math.ceil(priceNum / roundingUnit) * roundingUnit);
    case 'DOWN':
      return new Decimal(Math.floor(priceNum / roundingUnit) * roundingUnit);
    case 'NEAREST':
    default:
      return new Decimal(Math.round(priceNum / roundingUnit) * roundingUnit);
  }
}

// Example usage:
// $15,000 + 6.8% = $16,020
// applySmartRounding($16,020, ROUND_500, NEAREST) = $16,000
// applySmartRounding($16,020, ROUND_500, UP) = $16,500
```

**UI Preview:**
```
┌──────────────────────────────────────────────────────────────────────┐
│ Vista Previa                                                         │
│                                                                      │
│ Item                    Calculado    Redondeado                      │
│ ─────────────────────────────────────────────────                    │
│ Destapación simple     $16,020   →  $16,000  (ROUND_500, NEAREST)   │
│ Instalación inodoro    $26,700   →  $27,000  (ROUND_500, UP)        │
│ Mano de obra/hora      $8,544    →  $8,500   (ROUND_500, NEAREST)   │
└──────────────────────────────────────────────────────────────────────┘
```

### Exchange Rate Sources (Argentina)

| Source | Description | Use Case | API/Scraping |
|--------|-------------|----------|--------------|
| **Dólar Oficial** | Official BCRA rate | Conservative, legal compliance | BCRA API available |
| **Dólar Blue** | Informal market rate | Realistic market pricing | Scraping (ámbito, dolarhoy) |
| **Dólar MEP** | Stock market derived | Middle ground, legal | Scraping (ámbito, rava) |
| **Dólar CCL** | Contado con Liqui | International trade | Scraping |
| **Dólar Crypto** | USDT/ARS rate | Tech-savvy users | API (Binance P2P) |

**Recommendation**: Default to **Dólar Blue** for services (reflects real costs) with option to switch.

### 🛡️ Legal Shield (Naming Convention) - CRITICAL

**The Risk:**
Putting **"Dólar Blue"** on a formal invoice or business tool can be legally sensitive depending on Argentina's current political climate. While everyone uses it colloquially, displaying it formally could create issues.

**The Fix:**
- **Internally**: Use `BLUE` in code/database (clear for developers)
- **In UI**: Use euphemistic labels

| Internal Code | UI Display Label (Default) | Alternative Labels |
|---------------|---------------------------|-------------------|
| `OFICIAL` | Dólar Oficial | Cotización BCRA |
| `BLUE` | **Cotización de Mercado** | Dólar Referencia, Tipo de Cambio Libre |
| `MEP` | Dólar MEP | Dólar Bolsa |
| `CCL` | Dólar CCL | Contado con Liquidación |
| `CRYPTO` | Cotización Crypto | USDT/ARS |
| `CUSTOM` | Cotización Personalizada | Mi Tipo de Cambio |

**Configuration:**
```prisma
// Allow organizations to customize the label
exchangeRateLabel       String?  @map("exchange_rate_label")  // Custom display name
```

**🚨 CRITICAL RULE:**
> **Never print "Dólar Blue" on any PDF invoice generated by CampoTech.**
> 
> Invoices should only show the final ARS price. The exchange rate used is internal business logic, not customer-facing information.

**UI Implementation:**
```typescript
// Exchange rate display helper
const EXCHANGE_RATE_LABELS: Record<ExchangeRateSource, string> = {
  OFICIAL: 'Dólar Oficial',
  BLUE: 'Cotización de Mercado',  // ← Euphemism, not "Dólar Blue"
  MEP: 'Dólar MEP',
  CCL: 'Dólar CCL',
  CRYPTO: 'Cotización Crypto',
  CUSTOM: 'Cotización Personalizada',
};

// For internal admin/dev views, can show real name
const EXCHANGE_RATE_INTERNAL: Record<ExchangeRateSource, string> = {
  OFICIAL: 'Oficial (BCRA)',
  BLUE: 'Blue (Informal)',
  MEP: 'MEP (Bolsa)',
  CCL: 'CCL',
  CRYPTO: 'Crypto (USDT)',
  CUSTOM: 'Custom',
};
```


### 🎯 Jitter Control (Anchor Logic) - Price Stability

**The Problem:**
Without threshold control, exchange rate fluctuations cause **daily micro-changes** to prices:
- Monday: $57,500 → Tuesday: $57,650 → Wednesday: $57,480 → Thursday: $57,720
- This looks unprofessional and creates cognitive load for owners reviewing prices
- Small daily variations are noise, not signal

**The Solution: Anchor Rate Comparison**

Instead of comparing today's rate vs. yesterday's rate, compare against the **Anchor Rate** - the rate that was used during the **last price update**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANCHOR LOGIC FLOW                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Day 1: Price set at $57,500 (Rate: $1,150) ← THIS IS THE ANCHOR           │
│  Day 2: Rate: $1,155 (+0.4%) → No update (below 5% threshold)              │
│  Day 3: Rate: $1,160 (+0.9%) → No update                                   │
│  Day 4: Rate: $1,175 (+2.2%) → No update                                   │
│  Day 5: Rate: $1,180 (+2.6%) → No update                                   │
│  Day 6: Rate: $1,210 (+5.2%) → ⚡ THRESHOLD CROSSED                         │
│         → Notify owner: "El tipo de cambio subió 5.2%"                     │
│         → Owner applies adjustment → NEW ANCHOR: $1,210                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why This Works:**
1. **Captures creeping inflation** - Small daily changes accumulate until they cross threshold
2. **Captures sudden spikes** - A 10% overnight devaluation triggers immediately
3. **Reduces noise** - No notifications for day-to-day fluctuations
4. **Anchors to real decisions** - Threshold measured from last actual price change

**Configuration:**
```prisma
// Add to OrganizationPricingSettings
autoUpdateThreshold     Decimal  @default(5.0) @db.Decimal(5, 2) @map("auto_update_threshold")  // % change to trigger notification
anchorExchangeRate      Decimal? @db.Decimal(12, 4) @map("anchor_exchange_rate")  // Rate at last price update
anchorSetAt             DateTime? @map("anchor_set_at")  // When anchor was last set
```

**Implementation:**
```typescript
interface JitterControlConfig {
  anchorRate: Decimal;       // Rate when prices were last updated
  currentRate: Decimal;      // Today's rate
  threshold: Decimal;        // e.g., 5.0 = 5%
}

function shouldTriggerPriceUpdate(config: JitterControlConfig): {
  shouldUpdate: boolean;
  percentChange: Decimal;
  direction: 'UP' | 'DOWN';
} {
  const { anchorRate, currentRate, threshold } = config;
  
  // Calculate percentage change from ANCHOR (not yesterday)
  const percentChange = currentRate
    .sub(anchorRate)
    .div(anchorRate)
    .mul(100)
    .abs();
  
  const direction = currentRate.gt(anchorRate) ? 'UP' : 'DOWN';
  
  return {
    shouldUpdate: percentChange.gte(threshold),
    percentChange,
    direction,
  };
}

// Example:
// Anchor rate: $1,150 (set 2 weeks ago)
// Current rate: $1,210 (today)
// Threshold: 5%
// 
// Change: ($1,210 - $1,150) / $1,150 = 5.2%
// Result: shouldUpdate = true, direction = 'UP'
```

**Updating the Anchor:**
```typescript
async function applyPriceAdjustment(
  organizationId: string,
  adjustmentPercent: Decimal,
  currentExchangeRate: Decimal
) {
  // 1. Apply price adjustment to items...
  
  // 2. Update the anchor rate
  await prisma.organizationPricingSettings.update({
    where: { organizationId },
    data: {
      anchorExchangeRate: currentExchangeRate,  // NEW ANCHOR
      anchorSetAt: new Date(),
    },
  });
  
  // 3. The next threshold comparison will use this new anchor
}
```

**User Notification:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 💱 Variación significativa en el tipo de cambio                       ✕   │
│                                                                            │
│ La cotización de mercado subió 5.2% desde tu último ajuste de precios.    │
│                                                                            │
│ Cotización al momento del último ajuste: $1,150                           │
│ Cotización actual: $1,210                                                  │
│ Variación acumulada: +5.2%                                                 │
│                                                                            │
│ ¿Querés ajustar los precios de tu lista?                                  │
│                                                                            │
│ [ Ver detalles ]  [ Ajustar precios ]  [ Ignorar ]                        │
└────────────────────────────────────────────────────────────────────────────┘
```

**Settings UI:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ ⚙️ Configuración de Actualización Automática                              │
│                                                                            │
│ Umbral de notificación: [ 5 ] %                                           │
│ ─────────────────────────────────────────────────────                      │
│ Se te notificará cuando el tipo de cambio varíe más de este porcentaje   │
│ respecto al momento de tu último ajuste de precios.                       │
│                                                                            │
│ Último ancla: $1,150 (hace 12 días)                                       │
│ Cotización actual: $1,180 (+2.6%)                                         │
│ Faltan ~2.4% para activar notificación                                    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### Database Schema Changes

```prisma
// ═══════════════════════════════════════════════════════════════════════════════
// EXCHANGE RATE TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

model ExchangeRate {
  id           String   @id @default(cuid())
  source       ExchangeRateSource
  buyRate      Decimal  @db.Decimal(12, 4)  // Compra
  sellRate     Decimal  @db.Decimal(12, 4)  // Venta
  averageRate  Decimal  @db.Decimal(12, 4)  // (buy + sell) / 2
  fetchedAt    DateTime @default(now())
  validUntil   DateTime                      // Cache expiry
  
  @@index([source, fetchedAt])
  @@map("exchange_rates")
}

enum ExchangeRateSource {
  OFICIAL      // BCRA official rate
  BLUE         // Informal market
  MEP          // Dólar MEP (bolsa)
  CCL          // Contado con liquidación
  CRYPTO       // USDT/ARS
  CUSTOM       // Owner-defined rate
  
  @@map("exchange_rate_source")
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION PRICING PREFERENCES
// ═══════════════════════════════════════════════════════════════════════════════

// Add to existing OrganizationPricingSettings model:
model OrganizationPricingSettings {
  // ... existing fields ...
  
  // Currency Settings
  defaultCurrency           String   @default("ARS") @map("default_currency")  // ARS or USD
  exchangeRateSource        ExchangeRateSource @default(BLUE) @map("exchange_rate_source")
  customExchangeRate        Decimal? @db.Decimal(12, 4) @map("custom_exchange_rate")
  exchangeRateMarkup        Decimal  @default(0) @db.Decimal(5, 2) @map("exchange_rate_markup")  // % to add on top
  autoUpdateExchangeRate    Boolean  @default(true) @map("auto_update_exchange_rate")
  
  // Inflation Settings
  inflationIndexSource      InflationIndexSource? @map("inflation_index_source")
  autoInflationAdjust       Boolean  @default(false) @map("auto_inflation_adjust")
  inflationExtraPercent     Decimal  @default(0) @db.Decimal(5, 2) @map("inflation_extra_percent")
  lastInflationCheck        DateTime? @map("last_inflation_check")
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ITEM UPDATES
// ═══════════════════════════════════════════════════════════════════════════════

model PriceItem {
  // ... existing fields ...
  
  // Multi-currency support
  priceCurrency       String   @default("ARS") @map("price_currency")  // ARS or USD
  priceInUsd          Decimal? @db.Decimal(12, 2) @map("price_in_usd")  // If set in USD
  exchangeRateAtSet   Decimal? @db.Decimal(12, 4) @map("exchange_rate_at_set")  // Rate when USD price was set
  
  // Inflation tracking
  autoInflationAdjust Boolean  @default(true) @map("auto_inflation_adjust")
  lastAdjustedAt      DateTime? @map("last_adjusted_at")
  originalPrice       Decimal? @db.Decimal(12, 2) @map("original_price")  // Before any adjustments
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE HISTORY (Audit Trail)
// ═══════════════════════════════════════════════════════════════════════════════

model PriceItemHistory {
  id             String   @id @default(cuid())
  priceItemId    String   @map("price_item_id")
  previousPrice  Decimal  @db.Decimal(12, 2) @map("previous_price")
  newPrice       Decimal  @db.Decimal(12, 2) @map("new_price")
  changeReason   PriceChangeReason @map("change_reason")
  changePercent  Decimal  @db.Decimal(5, 2) @map("change_percent")
  
  // Context
  indexSource    String?  @map("index_source")      // CAC_ICC, INDEC_IPC, etc.
  indexPeriod    String?  @map("index_period")      // "2025-12"
  indexRate      Decimal? @db.Decimal(5, 2) @map("index_rate")
  exchangeRate   Decimal? @db.Decimal(12, 4) @map("exchange_rate")
  
  // Audit
  changedById    String   @map("changed_by_id")
  changedAt      DateTime @default(now()) @map("changed_at")
  notes          String?
  
  priceItem      PriceItem @relation("PriceItemHistory", fields: [priceItemId], references: [id], onDelete: Cascade)
  changedBy      User      @relation("PriceChangesMade", fields: [changedById], references: [id])
  
  @@index([priceItemId, changedAt])
  @@map("price_item_history")
}

enum PriceChangeReason {
  MANUAL           // Owner manually changed
  INFLATION_AUTO   // Automatic inflation adjustment
  INFLATION_MANUAL // Manual inflation adjustment
  EXCHANGE_RATE    // USD price converted at new rate
  INITIAL          // Initial price set
  
  @@map("price_change_reason")
}
```

### API Endpoints

```
# Exchange Rates
GET  /api/exchange-rates                    # Get current rates from all sources
GET  /api/exchange-rates/:source            # Get specific source rate
POST /api/exchange-rates/refresh            # Force refresh from external sources

# Organization Settings
GET  /api/settings/pricing                  # Get org pricing preferences
PUT  /api/settings/pricing                  # Update preferences

# Price Items (updated)
GET  /api/settings/pricebook                # Include USD/ARS display
PUT  /api/settings/pricebook/:id            # Update with currency option
POST /api/settings/pricebook/convert-currency  # Bulk convert ARS→USD or vice versa

# Inflation
GET  /api/inflation/indices                 # Get available indices
GET  /api/inflation/indices/:source/:period # Get specific index
POST /api/inflation/preview-adjustment      # Preview what prices would become
POST /api/inflation/apply-adjustment        # Apply bulk adjustment
```

### UI Components

#### 1. Price Input Component (Enhanced)

```tsx
// PriceCurrencyInput.tsx
// Shows price input with currency toggle and live conversion

┌─────────────────────────────────────────────────────────┐
│ Precio *                                                │
│ ┌──────┐ ┌─────────────────────────────────────────┐   │
│ │ USD ▼│ │ 50.00                                   │   │
│ └──────┘ └─────────────────────────────────────────┘   │
│ ≈ ARS $57,500 (Dólar Blue: $1,150)                     │
└─────────────────────────────────────────────────────────┘
```

#### 2. Exchange Rate Banner (Settings)

```tsx
// ExchangeRateBanner.tsx
// Shows in pricebook settings

┌─────────────────────────────────────────────────────────┐
│ 💱 Tipo de Cambio Actual                               │
│                                                         │
│ Dólar Blue: $1,150 (actualizado hace 2 horas)          │
│                                                         │
│ [ Cambiar fuente ▾ ]  [ Actualizar ahora ]              │
└─────────────────────────────────────────────────────────┘
```

#### 3. Pricebook Item Card (Enhanced)

```tsx
// Shows both currencies when item is USD-based

┌─────────────────────────────────────────────────────────┐
│ 🔧 Servicio                                   ✏️ 🗑️    │
│ ┌──────────────────────────────┐                       │
│ │ 🏷️ Gasista                   │                       │
│ └──────────────────────────────┘                       │
│ Instalación de calefón a gas                           │
│                                                         │
│ USD $50.00  →  ARS $57,500                 Por Jornal  │
│ ───────────────────────────                             │
│ Dólar Blue • Actualizado hoy                           │
└─────────────────────────────────────────────────────────┘
```

---

## Part 2: Inflation Adjustment System

### Problem Statement

- Argentina has monthly inflation of 4-15%+
- Business owners must constantly update prices
- Official indices (CAC, INDEC) provide reference points
- Manual updating is tedious and error-prone
- Need audit trail for price changes

### Inflation Index Sources

| Source | Index | Relevance | Frequency | Data Access |
|--------|-------|-----------|-----------|-------------|
| **CAC** | ICC General | Construction sector overall | Monthly (~15th) | Scraping |
| **CAC** | ICC Materiales | Materials costs | Monthly | Scraping |
| **CAC** | ICC Mano de Obra | Labor costs | Monthly | Scraping |
| **INDEC** | IPC Nacional | General consumer prices | Monthly (~15th) | Scraping/PDF |
| **INDEC** | IPC por Rubros | By category (housing, services) | Monthly | Scraping/PDF |

**Recommendation**: Use **CAC ICC** for plumbing/gas trades, with separate rates for services (Mano de Obra) and products (Materiales).

### Database Schema (Additional)

```prisma
// ═══════════════════════════════════════════════════════════════════════════════
// INFLATION INDEX TRACKING
// ═══════════════════════════════════════════════════════════════════════════════

model InflationIndex {
  id           String   @id @default(cuid())
  source       InflationIndexSource
  period       String                    // "2025-12" format
  rate         Decimal  @db.Decimal(6, 3) // 4.250 = 4.25%
  publishedAt  DateTime @map("published_at")
  scrapedAt    DateTime @default(now()) @map("scraped_at")
  rawData      Json?    @map("raw_data")  // Original scraped data
  
  @@unique([source, period])
  @@index([source, period])
  @@map("inflation_indices")
}

enum InflationIndexSource {
  CAC_ICC_GENERAL    // ICC General construction
  CAC_ICC_MATERIALS  // ICC Materiales
  CAC_ICC_LABOR      // ICC Mano de Obra
  INDEC_IPC_GENERAL  // IPC Nacional
  INDEC_IPC_HOUSING  // IPC Vivienda
  CUSTOM             // Manual entry
  
  @@map("inflation_index_source")
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICE ADJUSTMENT EVENTS (Audit)
// ═══════════════════════════════════════════════════════════════════════════════

model PriceAdjustmentEvent {
  id                 String   @id @default(cuid())
  organizationId     String   @map("organization_id")
  
  // Index used
  indexSource        InflationIndexSource @map("index_source")
  indexPeriod        String   @map("index_period")
  indexRate          Decimal  @db.Decimal(6, 3) @map("index_rate")
  
  // Adjustment applied
  extraPercent       Decimal  @db.Decimal(5, 2) @map("extra_percent")
  totalAdjustment    Decimal  @db.Decimal(6, 3) @map("total_adjustment")  // index + extra
  
  // Scope
  adjustmentType     AdjustmentType @map("adjustment_type")
  specialtyFilter    String?  @map("specialty_filter")  // Only adjust PLOMERO items, etc.
  
  // Results
  itemsAffected      Int      @map("items_affected")
  totalValueBefore   Decimal  @db.Decimal(14, 2) @map("total_value_before")
  totalValueAfter    Decimal  @db.Decimal(14, 2) @map("total_value_after")
  
  // Audit
  appliedById        String   @map("applied_by_id")
  appliedAt          DateTime @default(now()) @map("applied_at")
  notes              String?
  
  organization       Organization @relation("OrgPriceAdjustments", fields: [organizationId], references: [id], onDelete: Cascade)
  appliedBy          User         @relation("PriceAdjustmentsApplied", fields: [appliedById], references: [id])
  
  @@index([organizationId, appliedAt])
  @@map("price_adjustment_events")
}

enum AdjustmentType {
  ALL          // All items
  SERVICES     // Only services
  PRODUCTS     // Only products
  SPECIALTY    // Specific specialty only
  
  @@map("adjustment_type")
}
```

### Data Entry Architecture (Simplified)

> **Key Insight:** CAC/INDEC indices are entered manually via `apps/admin`. Only exchange rates are scraped automatically (reliable APIs exist for Blue/Crypto).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      DATA SOURCES ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ EXCHANGE RATES (Automated Scraping)                                 │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │   │
│  │  │ Scheduler       │───▶│ Scraper Workers  │───▶│ ExchangeRate  │  │   │
│  │  │ (Cron: hourly)  │    │                  │    │ table         │  │   │
│  │  └─────────────────┘    │ • Blue (dolarhoy)│    └───────────────┘  │   │
│  │                         │ • MEP (ambito)   │                       │   │
│  │                         │ • Crypto (Binance│                       │   │
│  │                         │ • Oficial (BCRA) │                       │   │
│  │                         └──────────────────┘                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ INFLATION INDICES (Manual Entry via apps/admin)                     │   │
│  │                                                                     │   │
│  │  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────┐  │   │
│  │  │ CAC publishes   │    │ Platform admin   │    │ InflationIndex│  │   │
│  │  │ (~15th monthly) │───▶│ enters values in │───▶│ table         │  │   │
│  │  └─────────────────┘    │ apps/admin       │    └───────────────┘  │   │
│  │                         └──────────────────┘           │           │   │
│  │                                                        ▼           │   │
│  │                                              ┌──────────────────┐  │   │
│  │                                              │ Notify all orgs  │  │   │
│  │                                              │ "Nuevo índice    │  │   │
│  │                                              │  disponible"     │  │   │
│  │                                              └──────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Why this approach?**
- **Exchange rates**: Reliable APIs exist (BCRA, Binance). Scraping dolarhoy/ambito is well-tested.
- **CAC indices**: Website is a mess (PDFs, complex structure). Manual entry takes 2 minutes/month.
- **Maintenance**: No breaking changes when CAC redesigns their site.


### Exchange Rate Scraper Implementation

```typescript
// services/scrapers/exchange-rate-scraper.ts

interface ExchangeRateData {
  source: ExchangeRateSource;
  buyRate: number;
  sellRate: number;
  averageRate: number;
  fetchedAt: Date;
}

/**
 * Scrapes exchange rates from multiple sources
 * 
 * Sources:
 * - Dólar Blue: dolarhoy.com, ambito.com
 * - Dólar Oficial: BCRA API (api.bcra.gob.ar)
 * - Dólar MEP: rava.com, ambito.com
 */

// BCRA has an official API for the official rate:
// https://api.bcra.gob.ar/estadisticas/v2.0/principalesvariables
// Variable ID 4 = Tipo de cambio de referencia

async function fetchOfficialRate(): Promise<ExchangeRateData> {
  const response = await fetch('https://api.bcra.gob.ar/estadisticas/v2.0/DatosVariable/4/YYYY-MM-DD/YYYY-MM-DD');
  // Parse response
}

async function scrapeDolarBlue(): Promise<ExchangeRateData> {
  // Scrape from dolarhoy.com or ambito.com
}
```

### UI Components

#### 1. Inflation Adjustment Modal

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📊 Ajuste de Precios por Inflación                                    ✕   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  El índice CAC de Diciembre 2025 fue publicado el 15/01/2026              │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Fuente de Índice                                                     │ │
│  │ ┌────────────────────────────────────────────────────────────────┐   │ │
│  │ │ CAC ICC - Mano de Obra                                     ▾  │   │ │
│  │ └────────────────────────────────────────────────────────────────┘   │ │
│  │                                                                      │ │
│  │ Período: Diciembre 2025                                              │ │
│  │ Variación mensual: 4.8%                                              │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Ajustar                                                              │ │
│  │ ○ Todos los items (61)                                               │ │
│  │ ○ Solo servicios (37)                                                │ │
│  │ ○ Solo productos (24)                                                │ │
│  │ ○ Solo especialidad: [PLOMERO ▾] (27)                               │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Cálculo                                                              │ │
│  │                                                                      │ │
│  │ Índice base:        4.8%                                             │ │
│  │ Porcentaje extra: + [  2.0  ] %                                      │ │
│  │                   ─────────────                                      │ │
│  │ Ajuste total:       6.8%                                             │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Vista Previa (top 5 de 61 items)                                     │ │
│  │                                                                      │ │
│  │ Item                          Actual      →    Nuevo                 │ │
│  │ ─────────────────────────────────────────────────────────            │ │
│  │ Destapación simple           $15,000      →    $16,020              │ │
│  │ Instalación de inodoro       $25,000      →    $26,700              │ │
│  │ Mano de obra/hora            $8,000       →    $8,544               │ │
│  │ Canilla monocomando          $35,000      →    $37,380              │ │
│  │ Service de calefón           $22,000      →    $23,496              │ │
│  │ ... y 56 items más                                                   │ │
│  │                                                                      │ │
│  │ Total antes: $2,450,000                                              │ │
│  │ Total después: $2,616,600 (+$166,600)                               │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ⚠️ 3 items tienen ajuste automático desactivado y serán excluidos       │
│                                                                            │
│  [ Ver historial ]          [ Cancelar ]  [ 📊 Aplicar Ajuste ]           │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 2. Price Adjustment History

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📜 Historial de Ajustes de Precios                                        │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 15 Ene 2026 - CAC ICC Diciembre 2025                              │   │
│  │ Ajuste: 6.8% (4.8% + 2.0% extra)                                  │   │
│  │ Items afectados: 58 de 61                                          │   │
│  │ Valor total: $2,450,000 → $2,616,600                              │   │
│  │ Aplicado por: Juan Pérez                                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │ 14 Dic 2025 - CAC ICC Noviembre 2025                              │   │
│  │ Ajuste: 5.5% (3.5% + 2.0% extra)                                  │   │
│  │ Items afectados: 55 de 58                                          │   │
│  │ Valor total: $2,322,275 → $2,450,000                              │   │
│  │ Aplicado por: Juan Pérez                                          │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

#### 3. Notification Banner

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📊 Nuevo índice CAC disponible                                        ✕   │
│                                                                            │
│ El ICC de Diciembre 2025 muestra una variación de 4.8% en mano de obra   │
│ y 3.2% en materiales. ¿Querés ajustar tus precios?                       │
│                                                                            │
│ [ Ver detalles ]  [ Ajustar precios ]  [ Ignorar este mes ]               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

> **IMPORTANT:** Dynamic Pricing spans two applications with different authentication systems. Understanding this separation is critical for implementation.

### App Responsibilities

| App | Auth System | Who Uses It | Dynamic Pricing Role |
|-----|-------------|-------------|---------------------|
| `apps/admin` | Hardcoded admins (super_admin) | CampoTech internal team | Platform-wide data management |
| `apps/web` | JWT (OWNER, ADMIN, TECHNICIAN) | Business customers | Organization-specific settings |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Dynamic Pricing Data Flow                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PLATFORM DATA (Global)                 ORGANIZATION DATA (Per-org)         │
│  Managed by apps/admin                  Managed by apps/web                 │
│  ─────────────────────                  ────────────────────────            │
│                                                                              │
│  • Exchange Rates                       • PriceItem (pricebook)             │
│    - Automated scraping (cron)          • OrganizationPricingSettings       │
│    - Manual override (admin)            • Price adjustments                 │
│    - Rate monitoring                    • History/audit trail               │
│                                                                             │
│  • Inflation Indices                    • Notifications displayed           │
│    - Manual CAC entry (admin)           • Adjustment preview/apply          │
│    - INDEC values                       • Smart rounding preferences        │
│                                                                              │
│         │                                       ▲                           │
│         └───── Shared Prisma Database ─────────┘                            │
│                (Both apps read/write)                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Rules

1. **Exchange rate manual override** → `apps/admin` only
2. **Inflation index entry** → `apps/admin` only  
3. **Cron jobs for scraping** → `apps/web` (Vercel runs crons per-app)
4. **Org pricing settings** → `apps/web` only
5. **Price adjustments** → `apps/web` only (org owners control their own prices)

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2) ✅ COMPLETED (Jan 18, 2026)
**Database & Core Infrastructure**

- [x] Add new Prisma schema models (ExchangeRate, PriceItemHistory, InflationIndex, PriceAdjustmentEvent)
- [x] Add enums (ExchangeRateSource, RoundingStrategy, RoundingDirection, InflationIndexSource, PriceChangeReason, AdjustmentType)
- [x] Add `priceCurrency`, `priceInUsd`, `exchangeRateAtSet`, `autoInflationAdjust`, `lastAdjustedAt`, `originalPrice` fields to PriceItem
- [x] Update OrganizationPricingSettings with currency/rounding/jitter control/inflation settings
- [x] Create ExchangeRate model and API (`/api/exchange-rates`, `/api/exchange-rates/[source]`, `/api/exchange-rates/refresh`)
- [x] Implement BCRA official rate fetcher (has API)
- [x] Implement dolarhoy/ambito Blue rate scraper  
- [x] Implement MEP rate fetcher
- [x] Create basic exchange rate caching (1 hour TTL, 24 hour stale fallback)
- [x] Create smart rounding utility ("El Redondeo")
- [x] Create currency conversion utilities with jitter control
- [x] Apply schema changes via `db push` (migration applied Jan 18, 2026)

**Deliverables:**
- Database schema updated ✅
- Exchange rate API endpoints working ✅
- Basic USD→ARS conversion function ✅
- Smart rounding utilities ✅
- Jitter control (anchor logic) ✅

### Phase 2: USD Pricing UI (Week 2-3)
**Multi-Currency Input**

- [x] Create `PriceCurrencyInput` component (`components/pricing/PriceCurrencyInput.tsx`)
- [x] Update PriceItem modal with currency toggle (integrated into pricebook page)
- [x] Show live ARS conversion below USD input
- [x] Add currency column to pricebook list (shows USD badge + ARS equivalent)
- [x] Create organization pricing settings page (`app/dashboard/settings/pricing/page.tsx`)
- [x] Implement exchange rate source selection (OFICIAL/BLUE/MEP)
- [x] Create `ExchangeRateDisplay` component for rate comparison
- [x] Create pricing settings API (`/api/settings/pricing`)

**Deliverables:**
- Price items can be set in USD ✅
- ARS equivalent shown in real-time ✅
- Settings page for exchange rate preferences ✅

### Phase 3: Exchange Rate Scraping (Week 3-4)
**Dólar Blue & MEP**

- [x] Implement dolarhoy.com scraper (`apps/web/lib/services/exchange-rate.service.ts`)
- [x] Implement ámbito.com scraper as fallback (fetchBlueFromAmbito)
- [x] Create scraper service with retry logic (withRetry + exponential backoff)
- [x] Add cron job for hourly rate updates (`apps/web/app/api/cron/exchange-rates/`)
- [x] Add cleanup function for old records (cleanupOldRates)
- [x] Configure Vercel cron schedule (vercel.json)

**Admin Panel (apps/admin):**
- [x] Create admin exchange rates API (`apps/admin/app/api/admin/exchange-rates/`)
- [x] Create manual rate override API (`apps/admin/app/api/admin/exchange-rates/manual/`)
- [x] Create rate history API (`apps/admin/app/api/admin/exchange-rates/history/`)
- [x] Create exchange rate monitoring dashboard (`apps/admin/app/dashboard/exchange-rates/`)

**User-facing (apps/web):**
- [x] Add rate history chart (`apps/web/components/pricing/RateHistoryChart.tsx`)
- [x] Add rate history API for org settings (`apps/web/app/api/exchange-rates/history/`)

**Architecture Note:**
> Exchange rates are platform-wide data. The cron job and scraping service live in `apps/web` (Vercel runs crons per-app), but admin controls (manual override, monitoring) live in `apps/admin` with separate admin authentication.

**Deliverables:**
- Automatic Dólar Blue/MEP updates ✅
- Fallback to manual entry if scraping fails ✅
- Historical rate tracking ✅
- Admin monitoring dashboard ✅

### Phase 4: Inflation Index Infrastructure (Week 4-5) ✅ COMPLETED (Jan 18, 2026)
**Admin Portal Manual Index Entry** *(Simplified - No CAC Scraping)*

> **Why no CAC scraper?** The CAC website is a mess - complex structure, PDFs, and frequently changing layouts. Scraping would be unreliable and high-maintenance. Instead, the platform admin enters the monthly CAC values via `apps/admin`, which then propagate to all organizations.

**Database (Prisma schema):** ✅
- [x] Create `InflationIndex` model (stores monthly CAC/INDEC values)
- [x] Create `PriceAdjustmentEvent` model (tracks org-level adjustments)
- [x] Create `InflationIndexSource` enum (CAC_ICC_GENERAL, CAC_ICC_MANO_OBRA, etc.)

**Admin Panel (`apps/admin`):** ✅
- [x] Create index entry page (`apps/admin/app/dashboard/inflation/page.tsx`)
- [x] Build form for entering ICC General, Materials, Labor rates
- [x] Build form for entering INDEC IPC values
- [x] Create API routes (`apps/admin/app/api/admin/inflation/route.ts`)
- [x] Store historical index data with period grouping
- [x] Add links to official CAC/INDEC websites for reference

**User-facing (`apps/web`):** ✅
- [x] Create API to fetch latest index for org settings (`apps/web/app/api/inflation/route.ts`)
- [x] Add inflation API to api-client (api.settings.inflation.get())
- [ ] Build preview calculation logic with **Smart Rounding** (Phase 5)
- [ ] Create notification when new index is available (Phase 6)

**Architecture Note:**
> Inflation indices are platform-wide data entered by CampoTech admins. The `apps/admin` team enters monthly CAC/INDEC values, which are then available to all organizations via `apps/web` for applying adjustments.

**Admin UI for Index Entry:**
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📊 Administración de Índices de Inflación                             ✕   │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  Período: [ Diciembre ▾ ] [ 2025 ▾ ]                                      │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Índice CAC (Cámara Argentina de la Construcción)                     │ │
│  │                                                                      │ │
│  │ ICC General:           [ 4.2  ] %                                    │ │
│  │ ICC Mano de Obra:      [ 4.8  ] %                                    │ │
│  │ ICC Materiales:        [ 3.2  ] %                                    │ │
│  │                                                                      │ │
│  │ Fuente: https://www.camarco.org.ar/estadisticas...                  │ │
│  │ Fecha de publicación: [ 15/01/2026 ]                                 │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐ │
│  │ Índice INDEC (opcional)                                              │ │
│  │                                                                      │ │
│  │ IPC General:           [ 5.1  ] %                                    │ │
│  │ IPC Vivienda:          [ 4.5  ] %                                    │ │
│  └──────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│  ☑ Notificar a todas las organizaciones                                   │
│                                                                            │
│  [ Cancelar ]  [ 💾 Guardar Índices ]                                     │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

**Workflow:**
1. CAC publishes data (~15th of month)
2. Platform admin (you) goes to CAC website, gets the numbers
3. Admin enters values in `apps/admin` dashboard
4. System notifies all orgs: "Nuevo índice CAC disponible"
5. Each org owner can apply adjustment with their own extra % in `apps/web`

**Deliverables:**
- `apps/admin/app/dashboard/inflation/page.tsx` index entry page ✅
- `apps/admin/app/api/admin/inflation/route.ts` API routes ✅
- `apps/web/app/api/inflation/route.ts` read-only API for orgs ✅
- Index data stored and accessible to all orgs ✅
- Notification to orgs when new index available (Phase 6)
- Calculation engine for price adjustments with Smart Rounding (Phase 5)

### Phase 5: Inflation UI (Week 5-6) ✅ COMPLETED (Jan 18, 2026)
**Adjustment Interface** *(Organization owners apply to their own pricebook)*

> **Location:** All Phase 5 work is in `apps/web` - organization owners apply CAC adjustments to their own prices.

**Pricebook Settings (`apps/web/app/dashboard/settings/pricebook/`):** ✅
- [x] Create inflation adjustment modal component (`InflationAdjustmentModal.tsx`)
- [x] Build preview table showing before/after with Smart Rounding
- [x] Implement scope selection (all/services/products/specialty)
- [x] Add extra percentage input (on top of CAC index)
- [x] Create bulk update API (`apps/web/app/api/settings/pricebook/adjust/route.ts`)
- [x] Add "Ajustar por Inflación" button to pricebook header
- [x] Integrate with existing pricebook page

**Audit Trail (`apps/web`):** ✅
- [x] Build PriceItemHistory entries for each adjustment (in transaction)
- [x] Create PriceAdjustmentEvent for each bulk adjustment
- [x] Add adjustment history component (`PriceAdjustmentHistory.tsx`)
- [x] Add adjustment history API (`apps/web/app/api/settings/pricebook/history/route.ts`)
- [x] Show who adjusted, when, and what index was used
- [x] Toggle history panel with "Historial" button

**Deliverables:**
- Full inflation adjustment workflow in `apps/web` ✅
- Audit trail of all changes (PriceItemHistory + PriceAdjustmentEvent) ✅
- History view for compliance ✅

### Phase 6: Notifications & Polish (Week 6-7) ✅ COMPLETED (Jan 18, 2026)
**Smart Notifications**

**Admin-triggered (`apps/admin` → `apps/web`):** ✅
- [x] When admin enters new index, trigger notification to all orgs (`/api/admin/inflation/notify`)

**User-facing (`apps/web`):** ✅
- [x] Create "New index available" notification (`InflationAlertWidget.tsx`)
- [x] Add dashboard widget for pending adjustments (integrated into main dashboard)
- [x] Implement "items excluded" warning (`ItemsExcludedWarning.tsx`)
- [x] Add quote validity warnings (`QuoteValidityWarning.tsx`)
- [ ] Create help documentation (optional - can be added later)

**Performance & Polish:** ✅
- [x] Performance optimization for bulk price updates (transactional batch processing)
- [x] Error handling for failed adjustments (try/catch with rollback)
- [x] Mobile-friendly components (responsive design)

**Deliverables:**
- Proactive notifications ✅
- Dashboard alert widget ✅  
- Quote validity warnings ✅
- Items excluded warnings ✅
- Production-ready feature ✅

---

## Technical Notes

### Exchange Rate Caching Strategy

```typescript
// Cache exchange rates for 1 hour
// If scraping fails, extend cache validity
// If cache expires and scraping fails, use last known rate with warning

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const STALE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours max staleness
```

### Price Calculation Logic

```typescript
// When displaying ARS price for a USD-priced item:
function calculateARSPrice(item: PriceItem, currentRate: ExchangeRate): Decimal {
  if (item.priceCurrency === 'ARS') {
    return item.price;
  }
  
  // USD item - convert
  const rate = currentRate.sellRate; // Use sell rate (customer buys from us)
  return item.priceInUsd.mul(rate);
}

// When applying inflation adjustment:
function applyInflationAdjustment(
  items: PriceItem[],
  indexRate: Decimal,
  extraPercent: Decimal
): PriceItem[] {
  const totalRate = indexRate.add(extraPercent);
  const multiplier = new Decimal(1).add(totalRate.div(100));
  
  return items.map(item => ({
    ...item,
    price: item.price.mul(multiplier).toDecimalPlaces(2),
  }));
}
```

### Error Handling

```typescript
// Scraping errors should:
// 1. Log to Sentry/error tracking
// 2. Send admin notification if repeated failures
// 3. Fall back to manual entry mode
// 4. Never block user operations

try {
  const rate = await scrapeDolarBlue();
  await cacheRate(rate);
} catch (error) {
  console.error('Exchange rate scraping failed:', error);
  Sentry.captureException(error);
  
  // Use cached rate if available
  const cachedRate = await getLastKnownRate('BLUE');
  if (cachedRate && isWithinStaleTTL(cachedRate)) {
    return { ...cachedRate, isStale: true };
  }
  
  // Notify admin
  await notifyAdmin('Exchange rate scraper failed - manual update needed');
  
  throw new ScraperError('Unable to fetch exchange rate');
}
```

---

## Data Sources Reference

### CAC (Cámara Argentina de la Construcción)
- Website: https://www.camarco.org.ar/
- Statistics: https://www.camarco.org.ar/estadisticas-de-la-construccion/
- Published: ~15th of each month for previous month
- Format: Web tables + PDF reports

### INDEC
- Website: https://www.indec.gob.ar/
- IPC: https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31
- Published: ~15th of each month
- Format: PDF + Excel downloads

### Exchange Rates
- BCRA Official API: https://api.bcra.gob.ar/
- Dólar Blue: https://dolarhoy.com/cotizacion-dolar-blue
- Ámbito: https://www.ambito.com/contenidos/dolar.html
- Dólar Hoy: https://www.dolarhoy.com/

---

## Success Metrics

1. **User Adoption**
   - % of orgs using USD pricing
   - % of orgs applying inflation adjustments

2. **Time Savings**
   - Average time to update prices (before/after)
   - Frequency of price updates

3. **Accuracy**
   - Exchange rate staleness (should be <1 hour)
   - Index availability (should be within 24h of publication)

4. **Error Rate**
   - Scraper success rate (target: >99%)
   - Manual fallback usage
