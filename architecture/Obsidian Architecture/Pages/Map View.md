---
tags:
  - page
  - app
  - core
status: 🟡 In Progress
type: Application Page
path: apps/web/app/dashboard/map/page.tsx
---

# 🗺️ Map View

> [!INFO] **Purpose**
> Real-time visualization of technician locations, job sites, and service zones. Enables dispatchers to optimize routing and monitor field operations.

---

## 📸 Preview
![[map-view.png]]

---

## 🧩 Key Features

### 1. Map Display
- **Provider:** Google Maps / Mapbox (configurable)
- **Default View:** Centered on organization's primary zone
- **Zoom Level:** Auto-fit to show all active markers

### 2. Map Markers

| Marker Type | Icon | Color | Description |
|:---|:---:|:---:|:---|
| Technician (Available) | 👤 | 🟢 Green | Ready for assignment |
| Technician (En Route) | 🚗 | 🔵 Blue | Traveling to job |
| Technician (Working) | 🔧 | 🟠 Orange | At job site |
| Job (Pending) | 📍 | ⚪ Gray | Unassigned job |
| Job (Scheduled) | 📍 | 🟣 Purple | Has assigned tech |
| Job (Urgent) | ⚠️ | 🔴 Red | High priority |

### 3. Sidebar Panel
- List of active jobs for today
- Filter by status, technician, zone
- Quick job details on hover

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| Technician Marker | `Click` | Show info popup with current status |
| Job Marker | `Click` | Show job details card |
| Job Marker | `Double-click` | Navigate → [[Job Detail Page]] |
| Map Area | `Click` | Create new job at location |
| Filter Dropdown | `Change` | Filter visible markers |
| Refresh Button | `Click` | Reload technician positions |

---

## 📊 Real-Time Features

### Live Tracking (Phase 3+)
- Technician GPS positions update every 30 seconds
- Route lines showing path to next job
- ETA calculations based on traffic

### Geofencing
- Alert when technician enters/exits service zone
- Auto-arrival detection at job site

---

## 🔐 Access Control

| Role | Access Level |
|:---|:---|
| OWNER | Full view + all technicians |
| ADMIN | Full view + managed technicians |
| TECHNICIAN | Own location + assigned jobs only |

---

## 🛠️ Technical Context

- **Component Path:** `apps/web/app/dashboard/map/page.tsx`
- **Map Library:** `@react-google-maps/api` or `mapbox-gl`
- **API Endpoints:**
  - `GET /api/technicians/locations` - Current positions
  - `GET /api/jobs/today` - Today's jobs with coordinates
  - `WS /api/ws/locations` - Live position updates

### Environment Variables
```env
NEXT_PUBLIC_GOOGLE_MAPS_KEY=xxx
NEXT_PUBLIC_MAPBOX_TOKEN=xxx
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Related:**
  - [[Locations Page]] (Zone management)
  - [[Job Detail Page]] (From marker click)
  - [[Team Page]] (Technician management)
  - [[Dispatch View]] (Assignment workflow)

---

## 📝 Notes

- [ ] TODO: Implement live GPS tracking
- [ ] TODO: Add route optimization suggestions
- [ ] TODO: Traffic layer toggle
- [ ] TODO: Offline mode with cached tiles
- [ ] COST: Maps API calls are metered - implement caching
