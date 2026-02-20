# Inflation-Aware Billing Analytics — Architecture Proposal

> **Phase**: Analytics Enhancement (Future)
> **Market**: Argentina (130%+ annual inflation, Feb 2026)
> **Status**: Architecture Draft
> **Author**: CampoTech Engineering
> **Created**: 2026-02-13

---

## 1. Problem Statement

Argentine field service entrepreneurs face a critical blind spot: **they don't know how much purchasing power they're losing between job completion and invoicing.**

### The Time Gap Problem

```
Timeline:
  Day 0:  Job completed, cobro received        → $ 100.000 ARS = ~USD 83
  Day 30: Factura created, sent to AFIP         → $ 100.000 ARS = ~USD 76
  Day 60: Customer pays remaining balance       → $ 100.000 ARS = ~USD 69

  Purchasing power lost over 60 days: ~17%
```

### Why This Matters for CampoTech Users

1. **Trade workers price in ARS** — they quote a number, collect it, and invoice later
2. **They don't mentally track inflation erosion** — $ 100.000 feels like $ 100.000
3. **Their costs go up** — materials, fuel (nafta), labor all rise with inflation
4. **AFIP taxes nominal profits** — no inflation adjustment, creating "phantom profit" taxation
5. **The average gap in our Cobrado stage is 30-150 days** — this is a LOT of erosion

### Business Value for CampoTech

- **Urgency driver**: "You're losing 8% by not invoicing" nudges faster invoicing
- **Pricing intelligence**: "Your real margin is 15%, not 30%" helps them price correctly
- **Differentiation**: No other Argentine field service tool shows inflation-adjusted analytics
- **Retention**: Users who understand their real economics are stickier

---

## 2. Design Principles

1. **AFIP compliance is unaffected** — Facturas are always in ARS. This is management accounting only.
2. **Non-intrusive** — Don't add friction to the billing flow. Show insights, don't block actions.
3. **Simple language** — "Perdiste 7% mientras esperabas" not "El tipo de cambio MEP depreció..."
4. **Honest rates** — Use dólar MEP/CCL (legal market rate), not blue (informal) or oficial (artificial).
5. **Snapshot, don't recalculate** — Store the rate at event time, don't retroactively update.

---

## 3. Exchange Rate Source

### Rate Options for Argentina

| Rate | Source | Legal? | Accuracy | Notes |
|------|--------|--------|----------|-------|
| **Dólar oficial** | BCRA | ✅ Yes | ❌ Artificial, controlled | Not representative of real purchasing power |
| **Dólar MEP** (Bolsa) | BYMA/Rava | ✅ Yes | ✅ Market-based | Legal arbitrage rate, widely used in business |
| **Dólar CCL** | CNV | ✅ Yes | ✅ Market-based | Contado con Liquidación, similar to MEP |
| **Dólar blue** | Ámbito/Criptoya | ❌ Informal | ⚠️ Street rate | Not legal to reference officially |
| **USD index (UVA)** | BCRA | ✅ Yes | ✅ Inflation-linked | Tracks inflation directly, not USD |

### Recommended: **Dólar MEP** as primary, **UVA** as secondary

- **MEP**: Legal, market-based, what businesses actually use for accounting
- **UVA**: BCRA's own inflation-linked unit, useful for year-over-year reporting
- **API sources**: 
  - `api.bluelytics.com.ar/v2/latest` (free, includes oficial/blue/MEP)
  - BCRA API for UVA values
  - Rava Bursátil for real-time MEP

### Rate Refresh Strategy

```
Frequency: Every 4 hours during market hours (10am-5pm ART)
Storage:   Daily closing rate cached in DB
Fallback:  If API fails, use last known rate (max 48h stale)
Weekend:   Use Friday's closing rate
```

---

## 4. Data Architecture

### 4.1 New Schema Fields

```prisma
// On jobs table — snapshot at completion
model Job {
  // ... existing fields ...
  usd_rate_at_completion  Decimal?  @db.Decimal(10,4)  // MEP rate when job completed
  usd_value_at_completion Decimal?  @db.Decimal(10,2)  // total / rate = USD value
}

// On invoices table — snapshot at creation
model Invoice {
  // ... existing fields ...  
  usd_rate_at_creation    Decimal?  @db.Decimal(10,4)  // MEP rate when factura created
  usd_value_at_creation   Decimal?  @db.Decimal(10,2)  // total / rate = USD value
}

// Daily rate cache
model ExchangeRate {
  id        String   @id @default(cuid())
  date      DateTime @db.Date @unique
  mep_buy   Decimal  @db.Decimal(10,4)
  mep_sell  Decimal  @db.Decimal(10,4)
  oficial   Decimal  @db.Decimal(10,4)
  uva_value Decimal  @db.Decimal(10,6)
  source    String   // "bluelytics" | "bcra" | "manual"
  createdAt DateTime @default(now())
}
```

### 4.2 Rate Snapshot Flow

```
Job Completed (status → COMPLETED)
    ↓
    Fetch today's MEP rate from ExchangeRate cache
    ↓
    Store: job.usd_rate_at_completion = rate
           job.usd_value_at_completion = job.total / rate
    ↓
    
Invoice Created (factura draft)
    ↓
    Fetch today's MEP rate from ExchangeRate cache
    ↓
    Store: invoice.usd_rate_at_creation = rate
           invoice.usd_value_at_creation = invoice.total / rate
    ↓
    
Delta = job.usd_value_at_completion - invoice.usd_value_at_creation
      = purchasing power lost to inflation
```

---

## 5. User-Facing Features

### 5.1 Pipeline Card Enhancement (Billing Page)

Show a subtle inflation indicator on cards sitting in Cobrado for 7+ days:

```
┌─────────────────────────────────────────────────┐
│ • Laura Martínez                    $ 94.985,00 │
│   #JOB-2026-00539                               │
│   Cobro recibido                       9 días ⚠️│
│   ──────────────────────────────────────────     │
│   📉 -2,3% desde el cobro (~USD 1,80 menos)    │
└─────────────────────────────────────────────────┘
```

Rules:
- Only show after 7+ days in Cobrado stage
- Yellow at 5-10% erosion, red at >10%
- Single line, compact — not a chart

### 5.2 Analytics Tab — Inflation Impact Report

A dedicated section in the Analytics dashboard:

```
┌─────────────────────────────────────────────────────────┐
│  📊 IMPACTO INFLACIONARIO — Últimos 30 días            │
│                                                         │
│  Trabajos completados:           45                     │
│  Valor total (al cobrar):        USD 12.450             │
│  Valor al facturar:              USD 11.230             │
│  ──────────────────────────────────────────────         │
│  Erosión promedio:               -9,8%                  │
│  Pérdida total estimada:         ~USD 1.220             │
│                                                         │
│  ⏱️ Tiempo promedio cobro → factura: 23 días           │
│  💡 Si facturaras en 3 días, ahorrarías ~USD 980       │
│                                                         │
│  ┌─────────────────────────────────────────┐            │
│  │ [Gráfico: Erosión % por semana]        │            │
│  │ ██████████ 12%                         │            │
│  │ ████████ 9.8%                          │            │
│  │ █████ 6.2%                             │            │
│  │ ███ 3.1%                               │            │
│  │ Sem 1  Sem 2  Sem 3  Sem 4             │            │
│  └─────────────────────────────────────────┘            │
│                                                         │
│  Top items con mayor erosión:                           │
│  1. Consorcio Las Flores  $ 41.700  -15,2% (154 días)  │
│  2. María González        $ 22.400  -12,8% (87 días)   │
│  3. Martín Aquino         $ 15.700  -11,1% (111 días)  │
└─────────────────────────────────────────────────────────┘
```

### 5.3 Smart Nudge — "Facturá Ahora" Notification

When a Cobrado item has been sitting 14+ days:

```
🔔 Notificación (in-app + optional push)
───────────────────────────────────────────
"El trabajo de María González ($ 15.700)
 lleva 17 días sin facturar.
 Estimación de erosión: -3,4% (~USD 4,20)
 
 [Facturar ahora]  [Recordar mañana]"
```

---

## 6. Privacy and Sensitivity

1. **USD values are NEVER shown on facturas** — only internal analytics
2. **Customers never see USD amounts** — it's owner-only information
3. **No AFIP interaction** — this is management accounting, completely separate
4. **Rate source attribution** — always show "Ref: Dólar MEP, fecha X"
5. **Disclaimer**: "Valores referenciales para uso interno. No constituyen asesoramiento fiscal."

---

## 7. Implementation Phases

### Phase A: Rate Infrastructure (Backend)
- [ ] Create `ExchangeRate` model
- [ ] Build rate-fetching cron (every 4h)
- [ ] API integration with Bluelytics
- [ ] Fallback logic (stale rate handling)

### Phase B: Snapshot on Events (Backend)  
- [ ] Add `usd_rate_at_completion` to jobs
- [ ] Add `usd_rate_at_creation` to invoices
- [ ] Hook into job completion flow
- [ ] Hook into invoice creation flow
- [ ] Backfill existing data using historical rates

### Phase C: Pipeline Card Indicator (Frontend)
- [ ] Show inflation erosion on Cobrado cards (7+ days)
- [ ] Color-coded severity (yellow/red)
- [ ] Tooltip with full breakdown

### Phase D: Analytics Dashboard (Frontend)
- [ ] Inflation impact report section
- [ ] Weekly erosion chart
- [ ] Top erosion items list
- [ ] "If you invoiced in X days" projection

### Phase E: Smart Nudges (Frontend + Backend)
- [ ] In-app notification for 14+ day items
- [ ] Optional push notification
- [ ] "Facturar ahora" deep link

---

## 8. API Endpoints

```
GET  /api/exchange-rates/current      → Today's rates
GET  /api/exchange-rates/history      → Last 90 days
GET  /api/analytics/inflation-impact  → Dashboard report data
POST /api/exchange-rates/refresh      → Force rate refresh (admin)
```

---

## 9. Technical Considerations

### Decimal Precision
- Rates: 4 decimal places (1200.5025)
- USD values: 2 decimal places (83.33)
- Use `Decimal` (Prisma) / `NUMERIC` (Postgres), never `Float`

### Rate Availability
- Market hours only (10am-5pm ART, Mon-Fri)
- Weekends/holidays: last trading day's close
- API failure: serve stale rate with warning icon
- Max staleness: 48 hours before hiding USD values entirely

### Performance
- Rate lookup: simple date-indexed table, O(1)
- Snapshot writes: async, don't block job/invoice flows
- Analytics queries: pre-aggregated daily, recalculated hourly

---

## 10. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Rate API goes down | Medium | 48h stale cache + manual override |
| User confusion ("AFIP wants USD?") | Medium | Clear disclaimer: "Solo referencial" |
| Political sensitivity (showing dólar) | Low | Use MEP (legal), not blue |
| Monotributo users thinking they need USD invoicing | Medium | Education tooltip |
| Rate manipulation/arbitrage | Low | Read-only snapshots, no user editing |

---

## 11. Success Metrics

- **Invoicing speed**: Average days in Cobrado stage decreases
- **Feature engagement**: % of users viewing inflation analytics
- **Revenue impact**: Users raising prices after seeing real margins
- **Retention**: Users with analytics access have lower churn
