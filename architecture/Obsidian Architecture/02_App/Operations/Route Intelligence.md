---
tags:
  - feature
  - operations
  - dispatch
  - phase-2
status: 🟢 Functional
type: Feature Architecture
path: apps/web/lib/integrations/google-maps/distance-matrix.ts
updated: 2026-02-13
---

# 🛣️ Route Intelligence

> [!SUCCESS] **Goal**
> Replace straight-line (Haversine) distance estimates with **real traffic-aware ETAs** using the Google Distance Matrix API. This is the foundation for intelligent dispatch and marketplace matching across Buenos Aires and all of Argentina.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    ROUTE INTELLIGENCE STACK                          │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │
│  │  Haversine    │   │  Distance    │   │  Buenos Aires       │     │
│  │  Pre-Filter   │──▶│  Matrix API  │──▶│  Traffic Context    │     │
│  │  (< 50/100km) │   │  (Live)      │   │  (Rush Hour Logic)  │     │
│  └──────────────┘   └──────────────┘   └──────────────────────┘     │
│         │                   │                      │                 │
│         ▼                   ▼                      ▼                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────┐     │
│  │  Fallback     │   │  In-Memory   │   │  Multi-Modal         │     │
│  │  Estimation   │   │  Cache       │   │  Comparison          │     │
│  │  (no API)     │   │  (5min TTL)  │   │  (driving/bici/      │     │
│  │              │   │  (500 max)   │   │   transit)            │     │
│  └──────────────┘   └──────────────┘   └──────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Components

### 1. Distance Matrix Service (`distance-matrix.ts`)

| Function | Purpose |
|:---|:---|
| `getBatchDistances()` | Batch API call for up to 25 origins → 1 destination |
| `getDistanceAndEta()` | Single origin → destination with caching |
| `compareMultiModal()` | Compare driving vs bicycling vs transit ETAs |
| `getBuenosAiresTrafficContext()` | Current traffic state: rush hour, period, multipliers |
| `estimateEtaFallback()` | Haversine-based ETA when API is unavailable |
| `haversineDistanceKm()` | Straight-line distance formula |
| `travelModeLabel()` | Spanish labels for travel modes |

### 2. Route Generation Service (`route-generation.service.ts`)

| Feature | Detail |
|:---|:---|
| **API** | Google Directions API |
| **Traffic Mode** | `departure_time=now`, `traffic_model=best_guess` |
| **Priority** | `duration_in_traffic` over `duration` when available |
| **Output** | Step-by-step route with polyline for map rendering |

### 3. PostgreSQL Spatial Layer (Feb 2026)

> [!TIP] **Lightweight Spatial Engine**
> Uses PostgreSQL's built-in `cube` + `earthdistance` extensions — no PostGIS installation required.

| Function | Purpose |
|:---|:---|
| `earth_distance(ll_to_earth(lat1, lng1), ll_to_earth(lat2, lng2))` | Great-circle distance in meters between two coordinates |
| `ll_to_earth(latitude, longitude)` | Converts lat/lng to a `cube`-based Earth position |

**Used by:** Marketplace v2 SQL query for pre-filtering 1,000+ organizations within a 100km radius — all inside a single PostgreSQL query that also checks schedules, vacations, and role/status filters.

**Setup:** `apps/web/scripts/enable-spatial-extensions.ts` (run once per database)

---

## 🚦 Buenos Aires Traffic Context

The system models BA's distinct traffic patterns:

### Rush Hour Detection

| Period | Hours | Multiplier |
|:---|:---|:---:|
| **Morning Rush** (`MORNING_RUSH`) | 07:00–10:00 | 1.6×–1.8× |
| **Midday** (`MIDDAY`) | 10:00–17:00 | 1.1× |
| **Evening Rush** (`EVENING_RUSH`) | 17:00–20:00 | 1.7×–2.0× |
| **Night** (`NIGHT`) | 20:00–07:00 | 0.8× |

### Congestion Ratios by Zone (Conceptual)

| Zone | Congestion Level | Notes |
|:---|:---:|:---|
| Microcentro / Tribunales | Very High | Financial district gridlock |
| Palermo / Recoleta | High | Residential + commercial mix |
| Suburbs (GBA) | Medium | Highway-dependent |
| Interior Provinces | Low | Google returns actual data |

---

## 🔄 Multi-Modal Comparison

When `isRushHour === true`, the system compares:

| Mode | Google API Key | Use Case |
|:---|:---|:---|
| `driving` | `mode=driving` | Default for all technicians |
| `bicycling` | `mode=bicycling` | Motos/bicicletas in congested areas |
| `transit` | `mode=transit` | Subte, tren, colectivo where available |

> [!NOTE] **Transit Graceful Degradation**
> Google's Distance Matrix API returns `status: 'ZERO_RESULTS'` for transit mode in areas without public transport coverage (e.g., rural towns). The system handles this automatically — transit simply won't appear as the fastest option for those locations.

---

## 💾 Caching Strategy

| Parameter | Value | Rationale |
|:---|:---|:---|
| **TTL** | 5 minutes | Traffic changes are dynamic |
| **Max Entries** | 500 | Memory constraint for serverless |
| **Cache Key** | `${origin}|${destination}|${mode}` | Per-route per-mode isolation |
| **Eviction** | LRU-like (oldest first) | When max entries exceeded |

---

## 📊 Cost Control

| Metric | Value |
|:---|:---|
| **Free Tier** | $200/month Google Maps credit |
| **Elements per Request** | Up to 25 origins × 1 destination |
| **Cost per Element** | ~$0.005 (Advanced tier) |
| **Monthly Budget** | ~40,000 elements free |
| **Rate Limit** | Max 25 origins per API call |

---

## 🛠️ Technical Context

- **Service Path:** `apps/web/lib/integrations/google-maps/distance-matrix.ts`
- **Config Path:** `apps/web/lib/integrations/google-maps/config.ts`
- **Route Gen Path:** `apps/web/lib/services/route-generation.service.ts`
- **Environment Variables:**
  - `GOOGLE_MAPS_SERVER_KEY` — Server-side Distance Matrix + Directions
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — Client-side Maps JavaScript

### Consumers

| API Endpoint | Usage | Spatial Engine |
|:---|:---|:---|
| `GET /api/tracking/nearest` | Internal: rank org technicians by ETA | Prisma + haversine |
| `POST /api/dispatch/recommend` | Internal: AI-scored dispatch with ETA | AI scoring |
| `GET /api/marketplace/nearest` | Public: cross-org nearest search | **PostgreSQL `earth_distance()`** |

---

## 🔗 Connections

- **Parent:** [[AI Systems Overview]], [[Dispatch System]]
- **Children:** [[Marketplace Smart Matching]], [[Dispatch Page]]
- **Uses:** Google Distance Matrix API, Google Directions API
- **Used By:** [[Marketplace Nearest API]], [[Dispatch System]], [[TechnicianRouteWidget]]
- **Related:** [[Map View]], [[Schedule Page]], [[Fleet Page]]

---

## 📝 Notes & TODOs

- [x] Phase 1: Distance Matrix integration with live traffic
- [x] Phase 2: Multi-modal comparison (driving, bicycling, transit)
- [x] Phase 3: Marketplace cross-org search
- [x] **Phase 3+: PostgreSQL `earth_distance()` spatial pre-filter for marketplace (Feb 2026)**
- [x] **Phase 3+: Schedule-aware filtering in marketplace SQL query (Feb 2026)**
- [x] **Phase 3+: Composite DB indexes for spatial + schedule queries (Feb 2026)**
- [ ] TODO: Province-based service area filtering (requires reverse geocoding)
- [ ] TODO: Historical traffic pattern learning for predictive scheduling
- [ ] TODO: Motorcycle-specific routing (not supported by Google Maps natively)
- [ ] MONITOR: Google Maps API usage and costs

---

*Route Intelligence powers every ETA displayed in CampoTech — from dispatch to marketplace.*
