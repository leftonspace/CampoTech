---
tags:
  - feature
  - operations
  - dispatch
  - ai
status: 🟢 Functional
type: Feature Architecture
path: apps/web/app/dashboard/dispatch/page.tsx
updated: 2026-02-13
---

# 📡 Dispatch System

> [!SUCCESS] **Goal**
> Intelligent technician dispatch that combines real-time traffic data, AI scoring, and multi-modal travel options to assign the right technician to the right job at the right time.

---

## 🏗️ System Overview

```
                    DISPATCH SYSTEM
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
    ┌──────────┐  ┌──────────┐  ┌──────────────┐
    │  Manual   │  │  Nearest │  │  AI-Scored   │
    │  Assign   │  │  Search  │  │  Recommend   │
    │           │  │ (ETA)    │  │  (Multi-     │
    │           │  │          │  │   Factor)    │
    └──────────┘  └──────────┘  └──────────────┘
                       │               │
                       ▼               ▼
              ┌──────────────────────────────┐
              │   Distance Matrix API        │
              │   (Live Traffic ETAs)        │
              ├──────────────────────────────┤
              │   Multi-Modal Comparison     │
              │   (Auto/Bici/Transporte)     │
              └──────────────────────────────┘
```

---

## 📄 Dispatch Page (`/dashboard/dispatch`)

### Page Layout

| Section | Description |
|:---|:---|
| **Job Selector** | Choose job to dispatch (pending/assigned jobs) |
| **Map View** | Live map showing job location + available technicians |
| **Recommendation Panel** | AI-scored recommendations with ETA |
| **Route Preview** | Selected technician's route overlay |
| **Traffic Info** | Current BA traffic conditions + mode recommendations |

### Key Components

| Component | File | Purpose |
|:---|:---|:---|
| `TechnicianRouteWidget` | `components/dispatch/TechnicianRouteWidget.tsx` | Route visualization with ETA display |
| Dispatch Page | `app/dashboard/dispatch/page.tsx` | Main dispatch interface |

---

## 🔌 API Endpoints

### 1. Find Nearest Technicians

**`GET /api/tracking/nearest`**

| Parameter | Type | Description |
|:---|:---|:---|
| `jobId` | string | Job to find technicians for |
| `lat`, `lng` | float | Destination coordinates |
| `specialty` | string | Filter by trade specialty |
| `limit` | int | Max results (default: 10) |
| `availableOnly` | bool | Exclude busy technicians |
| `multiModal` | bool | Include transit/bike comparison |

**Pipeline:**
1. **Haversine Pre-Filter** — Eliminate techs > 50km (straight-line)
2. **Distance Matrix API** — Real driving ETAs with live traffic
3. **Sort by ETA** — Available technicians first, then by arrival time
4. **Multi-Modal** — During rush hour, compare auto vs moto vs transporte

**Response Shape:**
```json
{
  "technicians": [{
    "name": "Carlos",
    "etaMinutes": 8,
    "etaText": "8 min",
    "distance": 3.2,
    "isRealEta": true,
    "isOnline": true,
    "isAvailable": true
  }],
  "traffic": {
    "context": { "isRushHour": true, "trafficLabel": "Hora pico matutina" },
    "multiModal": { "fastestMode": "bicycling", "fastestEtaText": "5 min" }
  }
}
```

### 2. AI Dispatch Recommendations

**`POST /api/dispatch/recommend`**

| Scoring Factor | Weight | Description |
|:---|:---:|:---|
| **Proximity (ETA)** | 35% | Real traffic-aware ETA via Distance Matrix |
| **Availability** | 25% | Current workload and schedule conflicts |
| **Skill Match** | 20% | Trade specialty alignment |
| **Performance** | 10% | Historical completion rate + rating |
| **Cost** | 10% | Labor rate optimization |

**AI Enhancement (when enabled):**
- OpenAI analyzes the full context: job urgency, customer history, tech performance
- Provides natural-language summary: "Carlos está a 8 min y tiene experiencia con este tipo de trabajo"
- Suggests alternative strategies when primary option is suboptimal

---

## 🚦 Traffic-Aware Features

### Rush Hour Detection
- **Morning:** 07:00–10:00 → suggests moto/bici if faster
- **Evening:** 17:00–20:00 → suggests transporte público if faster

### Mode Recommendation Logic
```
if (transitEta < drivingEta * 0.8) → "Transporte público llegaría en X min"
if (bicyclingEta < drivingEta * 0.8) → "Moto/bici llegaría en X min"
else → no recommendation (driving is optimal)
```

---

## 🔐 Access Control

| Role | Access |
|:---|:---|
| OWNER | Full dispatch access |
| ADMIN | Full dispatch access |
| TECHNICIAN | ❌ No dispatch access (sees only own assignments) |

**Tier Requirement:** PROFESIONAL or higher

---

## 🛠️ Technical Context

- **Page Path:** `apps/web/app/dashboard/dispatch/page.tsx`
- **Nearest API:** `apps/web/app/api/tracking/nearest/route.ts`
- **Recommend API:** `apps/web/app/api/dispatch/recommend/route.ts`
- **Distance Matrix:** `apps/web/lib/integrations/google-maps/distance-matrix.ts`
- **AI Dispatch:** `apps/web/lib/services/ai-dispatch.ts`
- **Route Widget:** `apps/web/components/dispatch/TechnicianRouteWidget.tsx`

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Depends On:** [[Route Intelligence]], [[Map View]]
- **Uses:** [[AI Dispatch Intelligence]], Google Distance Matrix API
- **Related:** [[Jobs Page]], [[Team Page]], [[Calendar Page]], [[Schedule Page]]

---

## 📝 Notes & TODOs

- [x] Real-time traffic-aware ETA ranking
- [x] AI-scored multi-factor recommendations
- [x] Multi-modal comparison (auto, bici, transporte)
- [x] Rush hour mode suggestions
- [ ] TODO: Drag-and-drop reassignment on map
- [ ] TODO: Batch dispatch for multiple jobs
- [ ] TODO: Predictive scheduling (pre-position technicians)

---

*The Dispatch System is the command center for field service operations.*
