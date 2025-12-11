# Employee Tracking, Fleet & Inventory - Implementation Plan

## Overview

Comprehensive field service management system for CampoTech that enables:
- Live map showing all technicians' current locations
- Click on employee to see their itinerary/schedule
- Find nearest available worker for job assignment
- Emergency dispatch to closest technician
- Traffic-aware routing for Buenos Aires
- **Calendar view** with job scheduling and assignment visualization
- **Fleet management** with vehicle compliance tracking (Buenos Aires laws)
- **Inventory management** for vehicles and hub/warehouse locations
- **Stock alerts** and dashboard notifications

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

### Phase 7: Calendar View

| Task | File | Description |
|------|------|-------------|
| 7.1 | `/dashboard/calendar/page.tsx` | **NEW** - Main calendar page with day/week/month views |
| 7.2 | `/components/calendar/CalendarView.tsx` | **NEW** - Interactive calendar component (react-big-calendar) |
| 7.3 | `/components/calendar/JobCard.tsx` | **NEW** - Popup card when clicking a time slot showing job details |
| 7.4 | `/api/jobs/calendar/route.ts` | Update to return jobs with assignee details |
| 7.5 | Add drag-and-drop job rescheduling | Enable dragging jobs to new time slots |
| 7.6 | Filter by technician | Show/hide specific technicians' schedules |

**Calendar Features:**
- **Day View**: Hour-by-hour breakdown with all scheduled jobs
- **Week View**: Overview of the week with color-coded jobs per technician
- **Month View**: High-level view with job counts per day
- **Job Card Popup**: Click any job to see:
  - Customer name & contact
  - Address & map link
  - Assigned technician(s)
  - Job status, priority, description
  - Quick actions (edit, reassign, complete)

---

### Phase 8: Fleet Management (Company Vehicles)

| Task | File | Description |
|------|------|-------------|
| 8.1 | Database schema | **NEW** - Create `vehicles`, `vehicle_documents`, `vehicle_assignments` tables |
| 8.2 | `/api/vehicles/route.ts` | **NEW** - CRUD for company vehicles |
| 8.3 | `/api/vehicles/[id]/documents/route.ts` | **NEW** - Upload/manage vehicle documents |
| 8.4 | `/dashboard/fleet/page.tsx` | **NEW** - Fleet management dashboard |
| 8.5 | `/components/fleet/VehicleCard.tsx` | **NEW** - Vehicle info card with status indicators |
| 8.6 | `/components/fleet/DocumentUpload.tsx` | **NEW** - Upload insurance, VTV, registration docs |
| 8.7 | `/api/vehicles/[id]/assign/route.ts` | **NEW** - Assign multiple workers to a vehicle |
| 8.8 | Document expiration alerts | Cron job to check expiring documents |

**Database Schema - Vehicles:**
```sql
vehicles
├── id (PK)
├── organization_id (FK → organizations)
├── plate_number (unique per org)
├── make (e.g., "Ford")
├── model (e.g., "Transit")
├── year
├── vin (Vehicle Identification Number)
├── color
├── status (active, maintenance, inactive)
├── current_mileage
├── fuel_type (gasoline, diesel, electric, gnc)
├── insurance_company
├── insurance_policy_number
├── insurance_expiry
├── vtv_expiry (Buenos Aires vehicle inspection)
├── registration_expiry
├── notes
├── created_at
├── updated_at

vehicle_documents
├── id (PK)
├── vehicle_id (FK → vehicles)
├── document_type (insurance, vtv, registration, title, green_card)
├── file_url
├── file_name
├── expiry_date
├── uploaded_at
├── uploaded_by (FK → users)

vehicle_assignments
├── id (PK)
├── vehicle_id (FK → vehicles)
├── user_id (FK → users)
├── assigned_from (date)
├── assigned_until (date, nullable for permanent)
├── is_primary_driver (boolean)
├── created_at
```

**Buenos Aires Compliance Features:**
- **VTV Tracking** (Verificación Técnica Vehicular): Track inspection expiry dates
- **Insurance Expiry Alerts**: 30, 15, 7 day warnings before expiration
- **Green Card** (Tarjeta Verde): Track vehicle registration card
- **Document Storage**: Upload and organize all vehicle paperwork
- **Compliance Dashboard**: Quick view of all vehicle statuses

---

### Phase 9: Inventory Management

| Task | File | Description |
|------|------|-------------|
| 9.1 | Database schema | **NEW** - Create `inventory_items`, `inventory_locations`, `inventory_transactions` tables |
| 9.2 | `/api/inventory/items/route.ts` | **NEW** - CRUD for inventory items |
| 9.3 | `/api/inventory/locations/route.ts` | **NEW** - Manage storage locations (hub, vehicles) |
| 9.4 | `/api/inventory/transactions/route.ts` | **NEW** - Record stock movements |
| 9.5 | `/dashboard/inventory/page.tsx` | **NEW** - Inventory dashboard |
| 9.6 | `/components/inventory/StockTable.tsx` | **NEW** - Filterable inventory table |
| 9.7 | `/components/inventory/LocationSelector.tsx` | **NEW** - Select hub or vehicle for stock operations |
| 9.8 | `/api/inventory/alerts/route.ts` | **NEW** - Get low stock alerts |
| 9.9 | Dashboard widget | Add stock alerts to main dashboard |

**Database Schema - Inventory:**
```sql
inventory_items
├── id (PK)
├── organization_id (FK → organizations)
├── sku (unique per org)
├── name
├── description
├── category (parts, tools, consumables, equipment)
├── unit (pieza, metro, litro, kg, etc.)
├── min_stock_level (for alerts)
├── cost_price
├── sale_price
├── is_active
├── created_at
├── updated_at

inventory_locations
├── id (PK)
├── organization_id (FK → organizations)
├── location_type (hub, vehicle)
├── name (e.g., "Depósito Central", "Camioneta Ford #1")
├── vehicle_id (FK → vehicles, nullable)
├── address
├── is_active
├── created_at

inventory_stock
├── id (PK)
├── item_id (FK → inventory_items)
├── location_id (FK → inventory_locations)
├── quantity
├── last_counted_at
├── updated_at
├── UNIQUE(item_id, location_id)

inventory_transactions
├── id (PK)
├── item_id (FK → inventory_items)
├── from_location_id (FK → inventory_locations, nullable for purchase)
├── to_location_id (FK → inventory_locations, nullable for sale/use)
├── quantity
├── transaction_type (purchase, transfer, use, adjustment, return)
├── job_id (FK → jobs, nullable - link to job that used the item)
├── notes
├── performed_by (FK → users)
├── performed_at
```

**Inventory Features:**

**Hub/Warehouse:**
- Central storage location for bulk inventory
- Track all items with quantities
- Set minimum stock levels for automatic alerts
- Record purchases and incoming stock

**Vehicle Inventory:**
- Each vehicle has its own inventory
- Track what tools/parts each technician has
- Transfer items from hub to vehicle
- Record items used on jobs

**Stock Alerts Dashboard:**
- Low stock warnings (below minimum level)
- Out of stock alerts
- Items expiring soon (for dated materials)
- Quick reorder suggestions

**Transaction History:**
- Full audit trail of all stock movements
- Filter by item, location, date, user
- Link inventory usage to specific jobs
- Cost tracking for job profitability

---

### Phase 10: Dashboard Enhancements

| Task | File | Description |
|------|------|-------------|
| 10.1 | `/components/dashboard/StockAlerts.tsx` | **NEW** - Widget showing critical stock alerts |
| 10.2 | `/components/dashboard/FleetStatus.tsx` | **NEW** - Widget showing vehicle compliance status |
| 10.3 | `/components/dashboard/TodaySchedule.tsx` | **NEW** - Mini calendar with today's jobs |
| 10.4 | `/api/dashboard/alerts/route.ts` | **NEW** - Aggregate alerts from all systems |
| 10.5 | Update main dashboard layout | Integrate new widgets |

**Dashboard Alert Types:**
- 🔴 **Critical**: Vehicle document expired, item out of stock
- 🟡 **Warning**: Document expiring soon, low stock
- 🔵 **Info**: Scheduled maintenance due, stock order suggestions

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
Phase 1-3: Employee Tracking Foundation
├── Backend tracking APIs
├── Live map dashboard
└── Real-time WebSocket updates

Phase 4-6: Dispatch Optimization
├── Find nearest technician
├── Technician itinerary view
└── Integration & polish

Phase 7: Calendar View
├── Job scheduling calendar
├── Day/week/month views
└── Job card popups with details

Phase 8: Fleet Management
├── Vehicle database & CRUD
├── Document upload & storage
├── Buenos Aires compliance (VTV, insurance)
├── Multi-worker vehicle assignments
└── Expiration alerts

Phase 9: Inventory Management
├── Hub/warehouse inventory
├── Vehicle inventory tracking
├── Stock transfers between locations
├── Usage tracking linked to jobs
└── Low stock alerts

Phase 10: Dashboard Enhancements
├── Stock alerts widget
├── Fleet compliance status
├── Today's schedule mini-calendar
└── Unified alert system
```

---

## Key Features Summary

### For Admin/Owner Dashboard
- **Live Map View**: See all technicians on a map in real-time
- **Technician Status**: Click marker to see current job, schedule, contact info
- **Itinerary View**: Full day schedule for each technician
- **Zone Overlay**: Visual service zones on the map
- **Unified Alerts**: Stock, fleet compliance, and scheduling alerts in one place

### For Job Assignment
- **Nearest Available**: Ranked list of technicians by ETA to job location
- **Traffic-Aware**: Uses Google Distance Matrix for real driving times
- **Availability Check**: Only shows technicians not currently on a job
- **Specialty Match**: Filter by plumber, electrician, etc.

### For Emergency Dispatch
- **Instant Location**: See where all technicians are right now
- **Quick Assign**: One-click assign to nearest available
- **ETA Display**: Know exactly when help will arrive

### For Calendar & Scheduling
- **Interactive Calendar**: Day, week, and month views of all jobs
- **Job Card Popup**: Click any time slot to see full job details
- **Drag-and-Drop**: Reschedule jobs by dragging to new times
- **Technician Filter**: View one or multiple technicians' schedules
- **Color Coding**: Jobs color-coded by status, priority, or assignee

### For Fleet Management
- **Vehicle Registry**: Track all company vehicles with full details
- **Document Storage**: Upload insurance, registration, VTV certificates
- **Compliance Tracking**: Buenos Aires law compliance (VTV, insurance expiry)
- **Multi-Worker Assignment**: Assign 2+ workers to share a vehicle
- **Expiration Alerts**: 30/15/7 day warnings before document expiration
- **Mileage Tracking**: Record vehicle odometer readings

### For Inventory Management
- **Hub Inventory**: Central warehouse stock with quantities
- **Vehicle Inventory**: What tools/parts each vehicle carries
- **Stock Transfers**: Move items from hub to vehicles
- **Job Usage Tracking**: Link inventory consumption to specific jobs
- **Low Stock Alerts**: Automatic warnings when items below minimum
- **Transaction History**: Full audit trail of all stock movements
- **Cost Tracking**: Know the material cost of each job

### For Analytics
- **Route Efficiency**: Compare planned vs actual routes
- **Time on Site**: Track how long jobs take by location
- **Coverage Gaps**: Identify areas with slow response times
- **Inventory Turnover**: Track which items are used most frequently
- **Fleet Utilization**: See which vehicles are used most/least
