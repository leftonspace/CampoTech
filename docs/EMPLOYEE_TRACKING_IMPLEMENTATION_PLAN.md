# Employee Tracking & Live Map - Implementation Plan

## Overview

Real-time employee location tracking system for CampoTech that enables:
- Live map showing all technicians' current locations
- Click on employee to see their itinerary/schedule
- Find nearest available worker for job assignment
- Emergency dispatch to closest technician
- Traffic-aware routing for Buenos Aires

---

## What's Already Built ✅

| Component | Status |
|-----------|--------|
| Database tables (`technician_locations`, `tracking_sessions`) | ✅ Ready |
| Mobile background location service | ✅ Built |
| WebSocket server infrastructure | ✅ Built |
| Map provider abstraction (Google/Leaflet) | ✅ Built |
| Role-based access (ADMIN, DISPATCHER) | ✅ Built |
| Job assignment flow | ✅ Built |
| Multi-location with zones | ✅ Built |

---

## What Needs Implementation 🔨

### Phase 1: Core Tracking API (Backend)

| Task | File | Description |
|------|------|-------------|
| 1.1 | `/api/tracking/start/route.ts` | Complete the tracking session start endpoint |
| 1.2 | `/api/tracking/update/route.ts` | Accept location updates, store in DB |
| 1.3 | `/api/tracking/locations/route.ts` | **NEW** - Get all active technician locations for map |
| 1.4 | `/api/tracking/nearest/route.ts` | **NEW** - Find nearest available technicians to a job address |

---

### Phase 2: Live Map Dashboard (Frontend)

| Task | File | Description |
|------|------|-------------|
| 2.1 | `/dashboard/map/page.tsx` | **NEW** - Main live map page |
| 2.2 | `/components/maps/LiveTechnicianMap.tsx` | **NEW** - Map component showing all technicians |
| 2.3 | `/components/maps/TechnicianMarker.tsx` | **NEW** - Clickable marker with popup (name, status, current job) |
| 2.4 | `/components/maps/TechnicianPanel.tsx` | **NEW** - Side panel showing technician details & itinerary |
| 2.5 | Add "Mapa" to sidebar navigation | Update `layout.tsx` |

---

### Phase 3: Real-time Updates (WebSocket)

| Task | File | Description |
|------|------|-------------|
| 3.1 | `/lib/websocket/tracking-client.ts` | **NEW** - WebSocket client hook for dashboard |
| 3.2 | Update existing WebSocket server | Add `technician_location_update` message type |
| 3.3 | `/api/tracking/subscribe/route.ts` | **NEW** - Subscribe to technician location updates |

---

### Phase 4: Find Nearest Technician

| Task | File | Description |
|------|------|-------------|
| 4.1 | `/api/tracking/nearest/route.ts` | Calculate nearest available technicians using Distance Matrix API |
| 4.2 | `/components/jobs/NearestTechnicians.tsx` | **NEW** - Component showing ranked technicians by ETA |
| 4.3 | Update job creation form | Add "Find nearest available" button |

---

### Phase 5: Technician Itinerary View

| Task | File | Description |
|------|------|-------------|
| 5.1 | `/api/technicians/[id]/itinerary/route.ts` | **NEW** - Get technician's scheduled jobs for the day |
| 5.2 | `/components/maps/ItineraryTimeline.tsx` | **NEW** - Visual timeline of technician's day |

---

### Phase 6: Integration & Polish

| Task | File | Description |
|------|------|-------------|
| 6.1 | Update dispatch page | Add "View on Map" button, integrate nearest technician |
| 6.2 | Add location analytics | Track technician movement patterns |
| 6.3 | Mobile app integration | Ensure location updates flow to dashboard |

---

## Architecture Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │     │   Web Dashboard │     │    Database     │
│  (Technician)   │     │  (Admin/Owner)  │     │   (Postgres)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │ POST /api/tracking/   │                       │
         │ update (every 15s)    │                       │
         │──────────────────────►│                       │
         │                       │ Store location        │
         │                       │──────────────────────►│
         │                       │                       │
         │                       │◄─────WebSocket────────│
         │                       │  (broadcast to map)   │
         │                       │                       │
         │                       │ GET /api/tracking/    │
         │                       │ nearest?jobId=xxx     │
         │                       │──────────────────────►│
         │                       │◄──────────────────────│
         │                       │  [Ranked technicians] │
         │                       │                       │
         │         ┌─────────────┴─────────────┐         │
         │         │    Google Distance        │         │
         │         │    Matrix API             │         │
         │         │  (Calculate real ETAs)    │         │
         │         └───────────────────────────┘         │
```

---

## Database Tables (Already Created)

```sql
-- Current technician locations (real-time)
technician_locations
├── user_id (PK, FK → users)
├── latitude
├── longitude
├── accuracy
├── heading
├── speed
├── updated_at

-- Location history (for analytics)
technician_location_history
├── id (PK)
├── user_id (FK → users)
├── job_id (FK → jobs, nullable)
├── latitude
├── longitude
├── recorded_at

-- Active tracking sessions
tracking_sessions
├── id (PK)
├── job_id (FK → jobs)
├── technician_id (FK → users)
├── current_lat, current_lng
├── eta_minutes
├── status
```

---

## Google APIs Required

| API | Purpose | Cost |
|-----|---------|------|
| **Maps JavaScript API** | Display map | Free up to 28K loads/mo |
| **Places API (New)** | Address autocomplete | $17/1K requests |
| **Geocoding API** | Address ↔ coordinates | $5/1K requests |
| **Directions API** | Route polylines | $5/1K requests |
| **Distance Matrix API** | Find nearest technician | $5/1K elements |

---

## Recommended Implementation Order

```
Week 1: Phase 1 (Backend APIs)
        └── Get tracking endpoints working
        └── Test with Postman/curl

Week 2: Phase 2 (Live Map UI)
        └── Build the map dashboard
        └── Show static technician positions

Week 3: Phase 3 (Real-time)
        └── Add WebSocket for live updates
        └── Map updates in real-time

Week 4: Phase 4-5 (Nearest + Itinerary)
        └── Find nearest technician feature
        └── Show technician schedules

Week 5: Phase 6 (Integration)
        └── Polish, test, deploy
```

---

## Key Features Summary

### For Admin/Owner Dashboard
- **Live Map View**: See all technicians on a map in real-time
- **Technician Status**: Click marker to see current job, schedule, contact info
- **Itinerary View**: Full day schedule for each technician
- **Zone Overlay**: Visual service zones on the map

### For Job Assignment
- **Nearest Available**: Ranked list of technicians by ETA to job location
- **Traffic-Aware**: Uses Google Distance Matrix for real driving times
- **Availability Check**: Only shows technicians not currently on a job
- **Specialty Match**: Filter by plumber, electrician, etc.

### For Emergency Dispatch
- **Instant Location**: See where all technicians are right now
- **Quick Assign**: One-click assign to nearest available
- **ETA Display**: Know exactly when help will arrive

### For Analytics
- **Route Efficiency**: Compare planned vs actual routes
- **Time on Site**: Track how long jobs take by location
- **Coverage Gaps**: Identify areas with slow response times
