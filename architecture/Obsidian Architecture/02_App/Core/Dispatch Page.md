---
tags:
  - page
  - app
  - core
  - dispatch
status: 🟢 Functional
type: Application Page
path: apps/web/app/dashboard/dispatch/page.tsx
updated: 2026-02-13
---

# 📡 Dispatch Page

> [!SUCCESS] **Goal**
> Central command for assigning the right technician to the right job using AI-scored recommendations, real-time traffic data, and multi-modal travel comparisons.

---

## 🧩 Page Components

### Header Section
| Element | Description |
|:---|:---|
| Title | "Despacho Inteligente" |
| Subtitle | Current traffic conditions summary |
| Job Selector | Dropdown of unassigned/pending jobs |

### Map Panel (Left - 2/3 width)
| Feature | Description |
|:---|:---|
| Job marker | Selected job location with address |
| Tech markers | Available technicians with status colors |
| Route overlay | Preview route for selected tech → job |
| Traffic layer | Google Maps traffic overlay |
| ETA label | Real-time ETA on each tech marker |

### Recommendation Panel (Right - 1/3 width)
| Component | Description |
|:---|:---|
| **TechnicianRouteWidget** | Per-technician card with ETA, distance, score |
| Score breakdown | Proximity, availability, skill match, performance, cost |
| AI summary | Natural-language recommendation text |
| Assign button | 1-click assignment from recommendation |
| Traffic alert | Rush hour mode suggestion |

### Traffic Context Bar
| Element | Description |
|:---|:---|
| Current period | "Hora pico matutina" / "Hora normal" |
| Mode suggestion | "Moto/bici llegaría en 5 min" (when applicable) |
| Congestion level | Visual indicator of traffic severity |

---

## 🖱️ All Clickable Elements

| Element | Action | Result |
|:---|:---|:---|
| Job Selector | `Select` | Load recommendations for selected job |
| Technician Card | `Click` | Show route preview on map |
| "Asignar" Button | `Click` | Assign technician to job |
| Map Tech Marker | `Click` | Highlight technician in list |
| Map Route | `Click` | Toggle route visibility |
| Refresh | `Click` | Re-fetch latest ETAs and positions |

---

## 🔐 Access Control

| Role | Access |
|:---|:---|
| OWNER | ✅ Full dispatch |
| ADMIN | ✅ Full dispatch |
| TECHNICIAN | ❌ No access (sees own assignments only) |

**Tier Requirement:** PROFESIONAL or higher

---

## 🛠️ Technical Context

- **Page Path:** `apps/web/app/dashboard/dispatch/page.tsx`
- **Widget:** `apps/web/components/dispatch/TechnicianRouteWidget.tsx`
- **APIs:**
  - `GET /api/tracking/nearest` — Nearest technicians by ETA
  - `POST /api/dispatch/recommend` — AI-scored recommendations
- **State:** React Query for data fetching

---

## 🔗 Connections

- **Parent:** [[Sidebar Navigation]]
- **APIs:** [[Dispatch System]], [[Route Intelligence]]
- **Related:** [[Map View]], [[Jobs Page]], [[Calendar Page]], [[Team Page]]

---

## 📝 Notes & TODOs

- [x] Traffic-aware ETA display
- [x] Multi-modal mode suggestions
- [x] AI-scored recommendations
- [x] TechnicianRouteWidget component
- [ ] TODO: Drag-and-drop reassignment on map
- [ ] TODO: Batch dispatch for multiple jobs
- [ ] TODO: Historical dispatch pattern learning

---

*Dispatch is where intelligence meets operations — every assignment backed by live data.*
