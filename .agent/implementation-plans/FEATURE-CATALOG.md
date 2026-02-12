# CampoTech - Complete Feature Catalog

**CampoTech** is a comprehensive management platform for technical service companies in Argentina, specialized in refrigeration, gas, plumbing, and multi-trade services. It connects certified technicians with clients who need professional services, providing complete tools to manage jobs, teams, inventory, invoicing, and customer communication.

---

## 1. Dashboard

**Route:** `/dashboard`  
**Component:** `apps/web/app/dashboard/page.tsx`

### Current Functionality
- **Personalized overview** with contextual greeting based on time of day (Buenos Aires timezone)
- **4 main stat cards:**
  - Today's Jobs (with trend vs yesterday)
  - Active Customers (with trend)
  - Today's Revenue (in ARS)
  - Average Rating (with review count)
- **Today's jobs table** showing:
  - Job number, service type, urgency
  - Customer and address
  - Assigned technician
  - Status and scheduled time
- **Quick actions panel:**
  - New Job
  - New Customer
  - Schedule
  - New Invoice
- **Team status** showing active technicians with their current job
- **Inflation alert widget** (Phase 6 pricing)
- **Onboarding checklist** for pending configurations

### APIs Used
- `GET /api/dashboard/stats` - Daily statistics
- `GET /api/jobs/today` - Today's scheduled jobs
- `GET /api/users?role=TECHNICIAN` - Technician list

### Interactions with Other Modules
- Jobs: Shows today's jobs, allows creating new ones
- Customers: Allows creating new customers
- Team: Shows real-time technician status
- Calendar: Link to schedule jobs
- Invoices: Link to create invoices

---

### Future Enhancement: Role-Based Customizable Dashboard

**Status:** 🔮 **PLANNED** - Not yet implemented  
**Target Implementation:** Q2 2026

#### Vision

A flexible, widget-based dashboard system where the **OWNER** can customize both their own view and the default view for **ADMIN** role. Users see different information based on their role and business needs, with a simple dropdown and checkbox customization UI.

#### Core Concept

1. **Fixed Top Section:** Always shows 4 primary stat cards (configurable via dropdowns)
2. **Scrollable Widget Grid:** Below the stats, widgets can be shown/hidden via checkboxes
3. **Role-Based Defaults:** Different defaults for OWNER vs ADMIN
4. **Owner Controls All:** Owner can configure their own view, the default for ALL ADMINs, AND individual dashboards for specific ADMINs
5. **3-Tier Hierarchy:** System default → Org default for role → Individual user override
6. **One Configuration Point:** All customization happens in the settings panel on the dashboard (no other entry points)

---

### Available Dashboard Widgets

All possible widgets that can be included in the dashboard. Each widget has role permissions and data access requirements.

#### A. Stats Cards (Pick 4 for Top Section)

**Base Widgets with Configurable Filters:**

Each stat widget is configurable via dropdown/settings to show different views.

| Widget ID | Display Name | Configurable Options | OWNER | ADMIN |
|-----------|--------------|---------------------|-------|------------|
| `stat_revenue` | Revenue | **Period:** Today / This Week / This Month / Outstanding (Unpaid) | ✅ | ❌ |
| `stat_jobs` | Jobs | **Type:** Today / Active / Pending Assignment ⭐ / Completed Today / Completed Month | ✅ | ✅ |
| `stat_customers` | Customers | **Type:** Active / New This Month / VIP | ✅ | ✅ |
| `stat_technicians` | Technicians | **Type:** Active (Working) ⭐ / Available / Total | ✅ | ✅ |
| `stat_invoices` | Invoices | **Type:** Pending / Overdue / Issued This Month | ✅ | ❌ |
| `stat_rating` | Customer Rating | **Period:** Overall / This Month / This Week | ✅ | ✅ |
| `stat_fleet` | Fleet/Vehicles | **Type:** Active / In Maintenance / With Alerts | ✅ | ✅ |

⭐ = Recommended default filter for role

**How It Works:**
- OWNER configures stats in settings panel using 2 dropdowns per stat
- First dropdown: Widget type (Revenue, Jobs, Customers, etc.)
- Second dropdown: Filter/period (Today, Week, Active, etc.)
- Configuration saved per role (owner's view, admin default, or specific admin)

**Example Configurations:**
```typescript
// OWNER configures Stat #1 as Revenue showing "Today" 
{ widgetId: 'stat_revenue', config: { period: 'today' } }

// OWNER configures admin default Stat #1 as Jobs showing "Pending"
{ widgetId: 'stat_jobs', config: { type: 'pending' } }

// OWNER configures Stat #4 as Technicians showing "Available"
{ widgetId: 'stat_technicians', config: { type: 'available' } }
```

#### B. Data Table Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `table_jobs_today` | Today's Jobs Table | Detailed job list for today | ✅ | ✅⭐ |
| `table_jobs_unassigned` | Unassigned Jobs | Jobs needing technician | ✅ | ✅⭐ |
| `table_jobs_active` | Active Jobs | All in-progress jobs | ✅ | ✅ |
| `table_jobs_completed` | Recent Completions | Last 10 completed | ✅ | ✅ |
| `table_invoices_pending` | Pending Invoices | Awaiting payment | ✅ | ❌ |
| `table_payments_recent` | Recent Payments | Last 10 payments | ✅ | ❌ |

#### C. Team & Resource Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `team_status_cards` | Team Status Cards | Tech with current job/status | ✅ | ✅⭐ |
| `team_performance` | Team Performance | Top performers this month | ✅ | ✅ |
| `team_availability` | Availability Calendar | Who's available when | ✅ | ✅⭐ |
| `fleet_status` | Fleet Status | Vehicle availability | ✅ | ✅ |
| `inventory_alerts` | Low Stock Alerts | Items needing restock | ✅ | ✅ |

#### D. Financial Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `revenue_chart_week` | Revenue Trend (7 days) | Daily revenue line chart | ✅ | ❌ |
| `revenue_chart_month` | Revenue Trend (30 days) | Monthly trend | ✅ | ❌ |
| `financial_health` | Financial Health Summary | Revenue, unpaid, trends | ✅ | ❌ |
| `profit_margin` | Profit Margin Widget | Gross margin % | ✅ | ❌ |
| `payment_methods` | Payment Methods Breakdown | Cash/MP/Transfer split | ✅ | ❌ |

#### E. Scheduling & Calendar Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `schedule_upcoming` | Upcoming Schedule | Next 3 days preview | ✅ | ✅⭐ |
| `schedule_tomorrow` | Tomorrow's Jobs | All jobs for tomorrow | ✅ | ✅⭐ |
| `schedule_conflicts` | Schedule Conflicts | Overlapping times | ✅ | ✅⭐ |
| `schedule_mini_calendar` | Mini Calendar | Month view with dots | ✅ | ✅ |

#### F. Analytics & Insights Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `analytics_kpis` | Key Performance Indicators | Top 6 KPIs | ✅ | ✅ |
| `analytics_growth` | Growth Metrics | MoM/WoW growth % | ✅ | ❌ |
| `customer_satisfaction` | Customer Satisfaction Trend | Rating over time | ✅ | ✅ |
| `ai_insights` | AI Copilot Insights | Usage and performance | ✅ | ✅ |

#### G. Alert Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `alerts_urgent` | Urgent Alerts | Critical issues | ✅ | ✅⭐ |
| `alerts_financial` | Financial Alerts | Payment issues, overdue | ✅ | ❌ |

#### H. Special Widgets

| Widget ID | Name | Description | OWNER | ADMIN |
|-----------|------|-------------|-------|------------|
| `marketplace_leads` | Marketplace Leads | New leads from public | ✅ | ✅ |

**Removed Widgets** (redundant - available elsewhere in UI):
- ❌ WhatsApp widgets - WhatsApp tab is one click away
- ❌ Quick Actions - Always visible in dashboard header
- ❌ Onboarding Checklist - Appears automatically when incomplete
- ❌ Inflation Alert - Notification system handles this
- ❌ Map Preview - Map tab is one click away
- ❌ Team Availability - Team section already shows this
- ❌ Operational Alerts - Moved to notifications section

---

### Default Dashboard Configurations

#### OWNER Default Dashboard

**Philosophy:** Strategic business overview with financial health focus

**Top 4 Stats:**
1. Revenue - "Today" (`stat_revenue` with `{ period: 'today' }`)
2. Jobs - "Active" (`stat_jobs` with `{ type: 'active' }`)
3. Customers - "Active" (`stat_customers` with `{ type: 'active' }`)
4. Customer Rating - "Overall" (`stat_rating` with `{ period: 'overall' }`)

**Scrollable Widgets (in order):**
1. Financial Health Summary (`financial_health`)
2. Revenue Trend - 7 days (`revenue_chart_week`)
3. Pending Invoices Table (`table_invoices_pending`)
4. Today's Jobs Table (Compact) (`table_jobs_today`)
5. Team Performance (`team_performance`)
6. Upcoming Schedule - 3 days (`schedule_upcoming`)
7. Analytics KPIs (`analytics_kpis`)

**Note:** Quick Actions (New Job/Customer/etc) are always visible in header, not a widget. Onboarding checklist appears automatically when incomplete.

**Size:** ~3-4 scrolls to see everything

---

#### ADMIN Default Dashboard

**Philosophy:** Operational command center for daily coordination

**Top 4 Stats:**
1. Jobs - "Pending Assignment" (`stat_jobs` with `{ type: 'pending' }`) ⚠️
2. Jobs - "Today" (`stat_jobs` with `{ type: 'today' }`)
3. Technicians - "Active" (`stat_technicians` with `{ type: 'active' }`)
4. Technicians - "Available" (`stat_technicians` with `{ type: 'available' }`)

**Scrollable Widgets (in order):**
1. Urgent Alerts (`alerts_urgent`)
2. Unassigned Jobs Table (`table_jobs_unassigned`) ⚠️
3. Today's Jobs Table (Detailed) (`table_jobs_today`)
4. Team Status Cards (Expanded) (`team_status_cards`)
5. Schedule Conflicts (`schedule_conflicts`)
6. Tomorrow's Jobs (`schedule_tomorrow`)
7. Recent Completions (`table_jobs_completed`)

**Note:** WhatsApp, Team Availability, and Map are one click away in navigation - no need for preview widgets. Quick Actions in header.

**Size:** ~4-5 scrolls (more detail-oriented)

**Note:** ADMIN can have 2 stat widgets of the same type (Jobs) but with different filters - this is intentional for operational focus.

---

### Customization Mechanism

#### UI Design - Simple Settings Panel

**Access:**
- "⚙️ Customize" button in dashboard header (visible only to OWNER)
- Clicking opens settings panel on right side of screen (slide-in)

**Settings Panel Structure:**

**Step 1: Select View**
```
┌─────────────────────────────────────┐
│ Customize Dashboard                 │
├─────────────────────────────────────┤
│ Editing:                            │
│ ○ My Dashboard (Owner)              │
│ ○ Admin Dashboard                   │
│                                     │
│ If "Admin Dashboard" selected:      │
│ ☐ Default for all admins           │
│ OR                                  │
│ ☐ Specific admin: [Dropdown ▼]    │
│   └─ María González               │
│   └─ Juan Pérez                   │
│   └─ Pedro López                  │
└─────────────────────────────────────┘
```

**Step 2: Configure Stats (Top 4)**
```
┌─────────────────────────────────────┐
│ Top 4 Stats                         │
├─────────────────────────────────────┤
│ Stat 1: [Revenue ▼] [Today ▼]     │
│ Stat 2: [Jobs ▼] [Active ▼]       │
│ Stat 3: [Customers ▼] [Active ▼]  │
│ Stat 4: [Rating ▼] [Overall ▼]    │
└─────────────────────────────────────┘
```
Each stat has 2 dropdowns:
- First dropdown: Widget type (Revenue, Jobs, Customers, etc.)
- Second dropdown: Filter/period (Today, Week, Active, etc.)

**Step 3: Configure Widgets (Scrollable Section)**
```
┌─────────────────────────────────────┐
│ Dashboard Widgets                   │
├─────────────────────────────────────┤
│ ☑ Financial Health Summary          │
│ ☑ Revenue Trend (7 days)            │
│ ☑ Pending Invoices Table            │
│ ☑ Today's Jobs Table                │
│ ☑ Team Performance                  │
│ ☐ Team Status Cards                 │
│ ☑ Upcoming Schedule (3 days)        │
│ ☐ Schedule Conflicts                │
│ ☑ Analytics KPIs                    │
│ ☐ Unassigned Jobs Table             │
└─────────────────────────────────────┘
```
Simple checkboxes - checked = visible on dashboard
Order = top to bottom as shown

**Step 4: Save**
```
┌─────────────────────────────────────┐
│ [Reset to Default]  [Save Changes] │
└─────────────────────────────────────┘
```

**That's It.** No drag-and-drop, no modals, no sidebars. Just dropdowns and checkboxes.

---

### Technical Implementation

#### Data Model

```typescript
interface DashboardConfig {
  id: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN';  // Which role this config is for
  userId?: string;  // If null, it's the default for the role
  isDefault: boolean;  // Is this the org default for this role?
  
  topStats: [
    { widgetId: string; config?: Record<string, any> },  // Stat 1
    { widgetId: string; config?: Record<string, any> },  // Stat 2
    { widgetId: string; config?: Record<string, any> },  // Stat 3
    { widgetId: string; config?: Record<string, any> },  // Stat 4
  ];
  
  widgets: {
    widgetId: string;
    order: number;  // Determines display order (checkbox list order)
    config?: Record<string, any>;  // Widget-specific settings
    visible: boolean;  // Checkbox state
  }[];
  
  createdAt: string;
  updatedAt: string;
}
```

#### APIs

```typescript
// Get dashboard config
GET /api/dashboard/config?role=OWNER
// Returns user's custom config, or org default, or system default

// Save dashboard config
PATCH /api/dashboard/config
Body: { role, isDefault, topStats, widgets }
// OWNER can save their own OR the org default for ADMIN

// Reset to default
DELETE /api/dashboard/config?role=OWNER
// Removes custom config, falls back to org/system default

// Get available widgets for role
GET /api/dashboard/widgets?role=ADMIN
// Returns list of widgets ADMIN is allowed to see
```

#### Permission Logic

```typescript
// OWNER permissions
- Can view/edit their own dashboard
- Can view/edit organization default for ADMIN role (affects all ADMINs)
- Can view/edit individual dashboards for SPECIFIC ADMINs (optional, per-user)
- Has access to ALL widgets (including financial)

// ADMIN permissions  
- Can ONLY VIEW their assigned dashboard (cannot edit)
- Dashboard assigned by owner (either org default OR custom individual config)
- Has access only to non-financial widgets
- Cannot see revenue, invoices, payments, profit widgets
- Cannot customize their own view
```

**Dashboard Resolution Flow for ADMIN:**
1. Check if OWNER set a custom dashboard for THIS specific ADMIN → Use it
2. Else, check if org has a default ADMIN dashboard → Use it  
3. Else, use system default ADMIN dashboard

**Example:**
- Organization has 3 ADMINs: María, Juan, Pedro
- OWNER sets org default for ADMIN role → All 3 see it
- OWNER customizes María's dashboard individually → María sees custom, Juan & Pedro see org default
- OWNER customizes Juan's dashboard → María sees her custom, Juan sees his custom, Pedro sees org default

---

### User Flows

#### Flow 1: OWNER Customizes Their Own Dashboard

1. Owner logs in → sees their current dashboard
2. Clicks "⚙️ Customize" button in header
3. Settings panel slides in from right
4. "Editing: My Dashboard (Owner)" is selected by default
5. Owner changes Stat #2 from [Jobs][Active] to [Revenue][This Week]
6. Owner unchecks "Team Performance" widget
7. Owner checks "Profit Margin Widget"
8. Widgets reorder automatically based on checkbox order
9. Clicks "Save Changes"
10. Settings panel closes, dashboard updates instantly

#### Flow 2: OWNER Sets Default for All ADMINs

1. Owner clicks "⚙️ Customize" button
2. Settings panel opens
3. Selects "○ Admin Dashboard"
4. Checks "☐ Default for all admins"
5. Adjusts stats and widgets for typical ADMIN needs
6. Checks "Unassigned Jobs Table" and "Schedule Conflicts"
7. Clicks "Save Changes"
8. **All ADMINs** without individual customizations see this new default

#### Flow 3: OWNER Customizes Individual Admin Dashboard

1. Owner clicks "⚙️ Customize" button on dashboard
2. Settings panel opens
3. Selects "○ Admin Dashboard"
4. Selects "☐ Specific admin: [María González ▼]"
5. Panel shows "Now editing: María González's Dashboard"
6. Owner adjusts María's stats/widgets:
   - More customer-focused stats
   - Adds communication widgets
   - Removes logistics widgets she doesn't need
7. Clicks "Save Changes"
8. María now sees her custom view, other ADMINs still see org default

#### Flow 4: ADMIN Uses System

1. ADMIN "María" logs in
2. Sees her assigned dashboard (either custom or org default)
3. **No "Customize Dashboard" button visible** (María cannot edit)
4. María can only use the dashboard as configured by owner
5. Financial widgets never appear (permissions block them)
6. María refreshes browser → sees updated data
7. If owner later changes María's dashboard → María sees changes on next login

#### Flow 5: New Organization First Time

1. Solo owner creates account
2. Sees system default OWNER dashboard
3. Goes through onboarding
4. Onboarding checklist widget shows setup tasks
5. Owner completes setup
6. Checklist auto-hides
7. Owner adds first ADMIN "Juan":
   - Juan sees system default ADMIN dashboard
   - Owner gets notification: "Customize your team's dashboard"
8. Owner clicks notification → customizes ADMIN default OR Juan's specific view

---

### Responsive Behavior

**Desktop (>1024px):**
- Top 4 stats: 4 columns
- Widgets: 2 columns (some full-width)
- Smooth scrolling

**Tablet (768-1024px):**
- Top 4 stats: 2 rows × 2 columns
- Widgets: 1-2 columns (adaptive)
- Condensed tables

**Mobile (<768px):**
- Top 4 stats: 1 column (stack)
- All widgets: 1 column
- Swipe for more stats
- Simplified tables (fewer columns)
- **Edit mode ENABLED** with touch-friendly interface:
  - Tap to open settings panel
  - Easy-to-tap dropdowns for stat selection
  - Large checkboxes for widget toggles
  - Mobile-optimized "Save" and "Cancel" buttons

---

### Benefits

1. **Flexibility:** Each business configures what matters to them
2. **Role Clarity:** OWNER sees business, ADMIN sees operations
3. **Trust:** ADMINs never see financials (Argentine culture)
4. **Scalability:** As we add features, just add new widgets
5. **Onboarding:** Perfect defaults, easy to adjust
6. **Power Users:** Advanced users can create complex dashboards
7. **Simplicity:** Beginners use defaults

---

### Migration Strategy

**Phase 1:** Build widget system (Foundation)
- Create all widget components with configurable filters
- Build widget registry and permission system
- Implement data fetching per widget
- WebSocket integration for real-time widgets

**Phase 2:** Basic customization (Owner + Role Defaults)
- Implement system defaults for OWNER and ADMIN roles
- Build settings panel UI (desktop)
- Dropdown and checkbox controls
- Save/load configs for owner's own view
- Implement org default for ADMIN role
- Test with real data

**Phase 3:** Multi-admin customization (Individual Overrides)
- Add admin dropdown in settings panel
- Individual admin dashboard customization
- 3-tier hierarchy (system → org → individual)
- Admin dashboard assignment logic

**Phase 4:** Mobile support
- Mobile edit mode with touch interface
- Responsive widget sizing
- Mobile-specific widget variations

**Phase 5:** Rollout
- Beta testing with select organizations
- Provide migration from current single dashboard
- Gather feedback and iterate
- Full production launch

**Phase 6:** Advanced features (Future)
- Custom presets ("Revenue Focus", "Ops Focus")
- Dashboard templates in marketplace
- Export/share configurations
- A/B testing different layouts

---

### Design Decisions

**The following decisions have been made:**

1. **Widget Refresh Rates:** ✅ **DECIDED**
   - Widgets refresh on page reload (user manually refreshes browser)
   - Real-time critical widgets (like WhatsApp messages, job status) use WebSocket updates
   - No auto-refresh timer needed for now

2. **Widget Size:** ✅ **DECIDED**
   - All widgets same height for simplicity
   - No masonry layout (for now)
   - Future: Can be enhanced if demand exists

3. **Mobile Customization:** ✅ **DECIDED - YES**
   - **MUST support mobile** - Many Argentinians don't have computers
   - Mobile settings panel with touch-friendly controls
   - Large dropdowns and checkboxes optimized for touch

4. **Dashboard Sharing & Multi-Admin Architecture:** ✅ **DECIDED**
   - **OWNER controls everything:**
     - Owner can customize their own dashboard
     - Owner sets **default dashboard for ALL admins**
     - Owner can **optionally customize individual admin dashboards**
   - **Hierarchy:**
     1. System default (fallback)
     2. Organization default for role (set by owner)
     3. Individual user override (set by owner for specific admin)
   - **Admins CANNOT see owner's dashboard**
   - **Admins CANNOT customize their own view** (owner controls all admin views)
   
5. **Notifications:** ✅ **DECIDED - NO widget badges**
   - No widget-level notification badges
   - Notifications handled in dedicated Notifications section/page
   - Keeps dashboard clean

6. **Export Dashboard:** ✅ **DECIDED - NO**
   - No PDF/image export from dashboard
   - Not needed for now

---

### Multi-Admin Customization Detail

**Scenario:** Organization has 1 OWNER and 3 ADMINS (admins)

**OWNER Options:**

1. **Set Default for All Admins:**
   - Clicks "⚙️ Customize" on dashboard
   - Settings panel opens
   - Selects "○ Admin Dashboard"
   - Checks "☐ Default for all admins"
   - Configures stats and widgets for typical admin needs
   - Saves
   - **ALL 3 ADMINs see this by default**

2. **Customize Individual Admin (Optional):**
   - Clicks "⚙️ Customize" on dashboard
   - Settings panel opens
   - Selects "○ Admin Dashboard"
   - Selects "☐ Specific admin: [María González ▼]"
   - Panel shows "Now editing: María González's Dashboard"
   - Configures María-specific layout
   - Saves
   - **María now sees her custom dashboard, other 2 admins still see org default**

3. **Example Use Cases:**
   - General default: Balanced operations view
   - Admin A (Scheduler): More calendar/scheduling widgets
   - Admin B (Customer Service): More communication-focused widgets
   - Admin C (Logistics): More job tracking and team status widgets

**Access:**
All customization happens via the "⚙️ Customize" button on dashboard - no other entry points.

---

### Remaining Open Questions

**None** - All key decisions made. Ready for implementation planning.

---




## 2. Map (Real-Time Tracking)

**Route:** `/dashboard/map`  
**Component:** `apps/web/app/dashboard/map/page.tsx`

### Current Functionality
- **Interactive Buenos Aires map** (Leaflet + OpenStreetMap/Google Maps/Satellite)
- **Real-time tracking** using WebSockets
- **Three marker layers:**
  - **Customers** (clustered with MarkerCluster)
    - Differentiates customers with/without active jobs
    - Shows job history and last service
  - **Technicians** with statuses:
    - Online (green)
    - En route (orange)
    - Working (blue)
    - Offline (gray)
  - **Today's jobs** with statuses:
    - Pending, Assigned, En route, In progress, Completed
- **Route calculation** using OSRM (Open Source Routing Machine)
- **Route deviation detection** (500m threshold)
- **Layer-based filters** (individual toggles)
- **Side panel** with technician and job lists
- **Search** for customers/technicians/jobs

### APIs Used
- `GET /api/map/data` - Map data (customers, technicians, jobs)
- `GET /api/routes?origin=...&dest=...` - Route calculation
- WebSocket: `/api/ws/tracking` - Real-time location updates

### Interactions with Other Modules
- Jobs: Visualizes jobs on map, allows viewing details
- Team: Shows technician locations
- Customers: Shows customer locations
- Tracking: Connected to mobile tracking system

### Missing/Incomplete Features
- Service zones (removed in Jan 2026 simplification)
- Drag-and-drop assignment from map
- Automatic deviation notifications

---

## 3. Calendar

**Route:** `/dashboard/calendar`  
**Component:** `apps/web/app/dashboard/calendar/page.tsx`

### Current Functionality
- **Weekly view** of scheduled jobs
- **Columns per technician** (vertical timeline)
- **Week navigation** with arrows
- **Filter by technician** (individual or all)
- **JobCard** in each slot showing:
  - Job number
  - Customer and address
  - Scheduled time
  - Status with colors
- **"New Job" button** to create from calendar
- **Manual refresh** of events
- **Automatic date range** (week start/end)

### APIs Used
- `GET /api/calendar/events?start=...&end=...&technicianId=...` - Calendar events

### Interactions with Other Modules
- Jobs: Shows jobs in calendar view, allows creation
- Team: Filters by specific technician
- Dashboard: Linked from quick actions

### Missing/Incomplete Features
- Monthly view
- Drag-and-drop to reschedule
- Multi-visit jobs visualization (recurring visits)
- Technician availability
- Highlighted schedule conflicts

---

## 4. Jobs

**Route:** `/dashboard/jobs`  
**Component:** `apps/web/app/dashboard/jobs/page.tsx` (1442 lines)

### Current Functionality
- **Optimized v2 view** with SQL views for performance (<200ms)
- **4 quick stats:**
  - Total jobs
  - In progress
  - Scheduled today
  - Completed this month
- **Quick filter tabs:**
  - Active (excludes CANCELLED and COMPLETED)
  - Pending
  - In progress
  - Completed
  - Cancelled
- **Advanced filters:**
  - Global search (customer, number, description)
  - By status
  - By assigned technician
  - By service type
  - By scheduled date
  - By urgency
- **JobCard** showing:
  - Job number and status
  - Customer with phone/address
  - Assigned technician (or "Unassigned")
  - Date and time
  - Actions button (View, Edit, Assign, Cancel)
- **Multi-visit jobs support** (recurring visits)
- **Pagination** with infinite scroll
- **Actions menu** with:
  - View details
  - Edit
  - Assign technician
  - Cancel

### Supported Job Types
Based on `SERVICE_TYPE_LABELS`:
- Split Installation
- Split Maintenance
- Split Repair
- Installation
- Repair
- Maintenance
- Diagnosis
- Emergency

### Job Statuses
- `PENDING` - Pending assignment
- `ASSIGNED` - Assigned to technician
- `EN_ROUTE` - Technician en route
- `IN_PROGRESS` - In progress
- `COMPLETED` - Completed (terminal state)
- `CANCELLED` - Cancelled (terminal state)

### Pricing Modes (Phase 1.2 Multi-trade)
- `FIXED_TOTAL` - Fixed total price
- `PER_VISIT` - Price per visit
- `HYBRID` - Hybrid (visits + additional work)

### APIs Used
- `GET /api/jobs/v2/list` - Optimized job list
- `GET /api/jobs/v2/stats` - Statistics by tabs
- `GET /api/users?role=TECHNICIAN` - Technicians for assignment
- `PATCH /api/jobs/[id]` - Update job
- `DELETE /api/jobs/[id]` - Cancel job

### Interactions with Other Modules
- Customers: Shows customer information
- Team: Technician assignment
- Invoices: Linked to invoice
- Payments: Job payment status
- Map: Job location
- Calendar: Calendar view
- Inventory: Materials used
- Vehicle: Vehicle assigned to job

### Missing/Incomplete Features
- Multi-technician assignment from UI
- Multi-visit job creation wizard
- Pricing compliance view (variances)
- Approval workflow for price variances
- Materials used form
- Customer signature capture
- Job photos

---

## 5. Customers

**Route:** `/dashboard/customers`  
**Component:** `apps/web/app/dashboard/customers/page.tsx` (1489 lines)

### Current Functionality
- **4 statistics:**
  - Total customers
  - New this month
  - VIP customers
  - Average rating
- **Filter tabs:**
  - All
  - VIPs
  - New (last 30 days)
  - High activity
- **Column filters:**
  - Customer type (INDIVIDUAL, CONDO, BUSINESS, MUNICIPALITY, GOVERNMENT, etc.)
  - Jobs (0, 1-5, 6-10, 11+)
  - Total billed (ranges in ARS)
  - Rating (1-5 stars)
  - Last service (last month, last 3 months, etc.)
- **Sorting:**
  - Alphabetical (A-Z, Z-A)
  - By jobs
  - By revenue
  - By rating
  - By last service
- **Table/grid view**
- **Global search** (name, phone, email, CUIT)
- **Multi-select** for batch actions
- **"NEW" badge** for recent customers
- **Quick VIP toggle**
- **Pagination** (20 per page with load more)

### CustomerCard Shows
- Name and VIP badge
- Phone and email
- Complete address
- Customer type
- Statistics: total jobs, billed, rating
- Last service date
- Actions menu

### Customer Types (customerType)
- `PARTICULAR` - Individual
- `CONSORCIO` - Condo/HOA
- `EMPRESA` - Business
- `MUNICIPIO` - Municipality
- `GOBIERNO` - Government
- `COOPERATIVA` - Cooperative
- `ONG` - NGO

### VAT Conditions (Argentina)
- `responsable_inscripto` - Registered Taxpayer
- `monotributista` - Simplified Tax Regime
- `consumidor_final` - Final Consumer
- `exento` - Exempt

### APIs Used
- `GET /api/customers/v2/list` - Optimized list with stats
- `GET /api/customers/stats` - General statistics
- `PATCH /api/customers/[id]` - Update (VIP toggle)

### Interactions with Other Modules
- Jobs: Customer job history
- Invoices: Customer billing
- Payments: Payments received
- Ratings: Rating system
- WhatsApp: Customer conversations
- Map: Geographic location

### Missing/Incomplete Features
- Customer creation/edit (modal exists but incomplete)
- Bulk customer import
- CSV/Excel export
- Advanced segmentation for marketing
- Notes/interaction history
- Customer document attachments

---

## 6. Team (Technicians)

**Route:** `/dashboard/team`  
**Component:** `apps/web/app/dashboard/team/page.tsx`

### Current Functionality
- **Team member search**
- **Technician list** with:
  - Name and avatar
  - Role (OWNER, ADMIN, TECHNICIAN)
  - Phone and email
  - Active/inactive status
  - Specialty
  - Statistics: completed jobs, rating
- **Filter by role**
- **Member edit modal**
- **Delete confirmation**

### APIs Used
- `GET /api/team` - Team member list (alternative: `/api/users`)
- `GET /api/employees/technicians` - Technicians with statistics

### User Roles
- `SUPER_ADMIN` - Super administrator (CampoTech)
- `OWNER` - organization owner
- `ADMIN` - ADMIN/Coordinator
- `TECHNICIAN` - Field technician

### Interactions with Other Modules
- Jobs: Job assignment to technicians
- Calendar: Availability and schedule
- Map: Location tracking
- Vehicle: Vehicle assignments
- Verification: Digital badges and professional verification
- Ratings: Ratings received

### Missing/Incomplete Features
- New member creation from UI
- Granular permission management (RBAC)
- Work availability/schedules
- Certifications and documents
- Per-technician notification settings
- Proximity search using "Proxy Search"

---

## 7. Fleet (Vehicles)

**Route:** `/dashboard/fleet`  
**Component:** `apps/web/app/dashboard/fleet/page.tsx`

### Current Functionality
- **4 statistics:**
  - Total vehicles
  - Active
  - In maintenance
  - With compliance alerts
- **Vehicle list** showing:
  - License plate (Argentine format)
  - Make, model, year
  - Color
  - Status (ACTIVE, MAINTENANCE, INACTIVE)
  - Fuel type (Nafta, Diesel, CNG, Electric)
  - Current mileage
  - Assigned technician (primary driver)
  - Expiration alerts (insurance, VTV, registration)
- **Filters:**
  - Search by plate/make/model
  - By status
- **VehicleDetailModal** with:
  - Complete vehicle information
  - Technician assignments
  - Documents (insurance, VTV, registration)
  - Maintenance logs

### Fuel Types (Localized for Argentina)
- `NAFTA` - Gasoline (not "gasolina")
- `DIESEL` - Diesel
- `GNC` - Compressed Natural Gas
- `ELECTRIC` - Electric
- `HYBRID` - Hybrid

### Compliance Tracking
- **Insurance** (insuranceExpiry)
- **VTV** (Vehicle Technical Verification - vtvExpiry)
- **Registration** (registrationExpiry)
- **Automatic alerts** when expirations approach

### APIs Used
- `GET /api/vehicles?search=...&status=...` - Vehicle list

### Interactions with Other Modules
- Team: Driver assignments
- Jobs: Vehicle used in each job (audit trail)
  - `vehiclePlateAtJob`, `driverNameAtJob`, `driverLicenseAtJob`
  - `vehicleMileageStart`, `vehicleMileageEnd`
- Inventory: Tools/parts in vehicle

### Missing/Incomplete Features
- Vehicle creation/editing
- Document uploads (PDF)
- Maintenance logs
- Fuel/expense management
- Push alerts before expirations

---

## 8. Inventory

**Route:** `/dashboard/inventory`  
**Component:** `apps/web/app/dashboard/inventory/page.tsx`

### Current Functionality
- **4 statistics (filtered by selection):**
  - Total products
  - Active products
  - Low stock
  - Out of stock
- **Quick status filters:**
  - All
  - Active
  - Low stock
  - Out of stock
- **Additional filters:**
  - By category
  - Search (SKU, name, description)
- **Product list** showing:
  - SKU and name
  - Category
  - Current/available/reserved stock
  - Minimum level
  - Stock progress bar
  - Cost and sale price
  - Unit of measure
  - Status (active/inactive)
- **Stock status badge:**
  - In stock (green)
  - Low stock (yellow)
  - Out of stock (red)
- **Actions menu:**
  - View details
  - Edit
  - Adjust stock
  - Locations (warehouses)

### Product Categories
- `PARTS` - Parts
- `CONSUMABLES` - Consumables
- `TOOLS` - Tools
- `EQUIPMENT` - Equipment
- `REFRIGERATION` - Refrigeration
- `ELECTRICAL` - Electrical
- `PLUMBING` - Plumbing
- `GAS` - Gas
- `OTHER` - Other

### Units of Measure
- unit, meter, liter, kg, roll, tube, piece, box, package

### Stock Calculation
- `quantityOnHand` - Physical quantity
- `quantityReserved` - Reserved for jobs
- `quantityAvailable` = onHand - reserved

### APIs Used
- `GET /api/inventory/products` - Product list
- `GET /api/inventory/stats` - Inventory statistics

### Interactions with Other Modules
- Jobs: Materials used in jobs
- Pricebook: Product/service prices
- Invoices: Invoice line items
- Vehicles: Stock in vehicles

### Missing/Incomplete Features
- Complete product CRUD
- Multi-warehouse management
- Stock movements (transfers, adjustments)
- Purchase orders
- Automatic replenishment alerts
- Supplier integration
- Barcodes/QR codes

---

## 9. Invoices

**Route:** `/dashboard/invoices`  
**Component:** `apps/web/app/dashboard/invoices/page.tsx`

### Current Functionality
- **Invoice list** showing:
  - Invoice number (format: type + point of sale + number)
  - Customer
  - Issue and due dates
  - Total amount
  - Status with colored badge
  - CAE (AFIP Electronic Authorization Code)
- **Search** by number, customer
- **Filter by invoice status**
- **Actions:**
  - View details
  - Download PDF
  - Send via email/WhatsApp

### Invoice Types (AFIP Argentina)
- **Type A** - For Registered Taxpayers (shows itemized VAT)
- **Type B** - For Simplified Regime and Final Consumers (VAT included)
- **Type C** - For exempt operations

### Invoice Statuses
- `draft` - Draft
- `pending_cae` - Awaiting AFIP CAE
- `issued` - Issued (with CAE)
- `sent` - Sent to customer
- `paid` - Paid
- `partially_paid` - Partially paid
- `overdue` - Overdue
- `cancelled` - Cancelled
- `rejected` - Rejected by AFIP

### Invoice Components
- **Line Items** with:
  - Description
  - Quantity
  - Unit price
  - VAT rate
  - Subtotal, VAT, Total
- **Subtotal** (without VAT)
- **Total VAT**
- **Final Total**
- **Point of Sale** (POS)
- **CAE** and CAE expiration date
- **QR Code** for validation

### APIs Used
- `GET /api/invoices?search=...&status=...` - Invoice list
- `GET /api/invoices/stats` - Statistics

### Interactions with Other Modules
- AFIP: Invoice authorization (CAE)
- Jobs: Billing for completed jobs
- Customers: Invoice customer
- Payments: Associated payments
- Pricebook: Items and prices

### Missing/Incomplete Features
- Invoice creation (complete wizard)
- Automatic generation from completed job
- Preview before requesting CAE
- Draft editing
- Credit notes
- Recurring invoicing
- Bulk sending

---

## 10. Payments

**Route:** `/dashboard/payments`  
**Component:** `apps/web/app/dashboard/payments/page.tsx`

### Current Functionality
- **Payment list** showing:
  - Associated invoice number
  - Customer
  - Payment method
  - Amount
  - Status with badge
  - Payment date
  - MercadoPago ID (if applicable)
- **Search** by invoice, customer
- **Filter by status**
- **Actions:**
  - View details
  - Refresh status (for processing payments)

### Payment Methods
- `cash` - Cash
- `bank_transfer` - Bank Transfer (Transferencias 3.0)
- `credit_card` - Credit Card
- `debit_card` - Debit Card
- `mercadopago` - MercadoPago

### Payment Statuses
- `pending` - Pending
- `processing` - Processing
- `approved` - Approved
- `rejected` - Rejected
- `cancelled` - Cancelled
- `refunded` - Refunded
- `charged_back` - Chargeback

### On-site Payment (Mobile Flow)
Based on knowledge and schema:
- Technician collects on-site from mobile app
- Methods: Cash, MercadoPago, Transfer
- Recorded in `SyncOperation` for audit
- Truth reconciliation (0.01 threshold)

### APIs Used
- `GET /api/payments?search=...&status=...` - Payment list
- `GET /api/payments/stats` - Statistics

### Interactions with Other Modules
- Invoices: Payments associated with invoices
- MercadoPago: OAuth integration + webhooks
- Jobs: Deposit and final payments
- Customers: Payment history
- Mobile Sync: Offline-recorded payments

### Missing/Incomplete Features
- Manual cash payment registration
- MercadoPago payment link
- Payment reconciliation
- Refunds
- Collection reports

---

## 11. Analytics

**Base Route:** `/dashboard/analytics`

### Implemented Sub-modules

#### 11.1 Overview (`/analytics/overview`)
- General dashboard with key metrics
- Main KPIs
- Trend charts

#### 11.2 Revenue (`/analytics/revenue`)
- Revenue by period
- Profitability analysis
- Projections

#### 11.3 Operations (`/analytics/operations`)
- Operational efficiency
- Average times
- Technician utilization

#### 11.4 Customers (`/analytics/customers`)
- Customer analysis
- Segmentation
- Lifetime value

#### 11.5 Technicians (`/analytics/technicians`)
- Technician performance
- Ratings
- Productivity

#### 11.6 Marketplace (if applicable)
- Leads received
- Conversion rate

#### 11.7 AI Analytics
- Copilot usage
- AI metrics

#### 11.8 Predictions
- Demand predictions
- Forecasting

#### 11.9 Reports
- Scheduled reports
- Report history
- Exports

### APIs Used
- `GET /api/analytics/overview`
- `GET /api/analytics/revenue`
- `GET /api/analytics/operations`
- `GET /api/analytics/customers`
- `GET /api/analytics/technicians`
- `GET /api/analytics/marketplace`
- `GET /api/analytics/ai`
- `GET /api/analytics/predictions`
- `GET /api/analytics/reports`
- `GET /api/analytics/kpis`

### Missing/Incomplete Features
- Custom dashboards
- Automatic alerts
- Period comparisons
- Benchmarking

---

## 12. WhatsApp

**Route:** `/dashboard/whatsapp`  
**Component:** `apps/web/app/dashboard/whatsapp/page.tsx`

### Current Functionality
- **Conversation panel** (left)
  - Customer chat list
  - Unread message badges
  - Last message and time
  - Conversation search
- **Chat panel** (center)
  - Customer messages and replies
  - Text message sending
  - Send approved templates
  - Read indicators
- **Info panel** (right)
  - Contact details
  - Associated jobs
  - Pending invoices
  - Interaction history
- **Copilot Panel**
  - AI response suggestions
  - Customer context
- **Simulation Panel** (dev/testing)
  - Simulate incoming messages

### WhatsApp Architecture
**Tier-based Strategy:**
- **FREE/INICIAL:** Manual Deep Link (wa.me)
- **PROFESIONAL/EMPRESA:** Managed Number (Direct Meta Cloud API)

**Managed Number System:**
- Purchase via Twilio
- Registration in Meta Business
- Automatic assignment via subscription hooks
- Reclamation cron for released numbers
- Early Access Waitlist to manage limits (2-20 numbers/account)

### AI Copilot Integration
See KI: "AI Service Architecture"
- LangGraph-powered agent (v3.2.1)
- Working Memory pattern
- Hybrid Routing (Regex + SLM)
- Parallel Multi-modal (GPT-4 Vision)
- Redis concurrency locking for message bursts

### Templates
Pre-approved templates by Meta:
- Appointment confirmation
- Service reminder
- Invoice available
- Payment link
- Etc.

### APIs Used
- `GET /api/whatsapp/conversations` - Chat list
- `GET /api/whatsapp/messages?conversationId=...` - Messages
- `POST /api/whatsapp/send` - Send message
- `POST /api/whatsapp/templates/send` - Send template
- `POST /api/copilot/suggest` - AI suggestions
- WebSocket: Real-time messages

### Interactions with Other Modules
- Customers: Conversations by customer
- Jobs: Job notifications
- Invoices: Send invoices
- Payments: Payment links
- AI Copilot: Automatic responses

### Missing/Incomplete Features
- File sending (PDF, images)
- Complete WhatsApp Business Profile
- Product catalog
- Custom quick replies
- Advanced automations
- Multi-agent (multiple operators)

---

## 13. Settings (Configuration)

**Route:** `/dashboard/settings`  
**Component:** `apps/web/app/dashboard/settings/page.tsx`

### Configuration Sub-modules

#### 13.1 Organization (`/settings/organization`)
- Company data
- CUIT
- Address
- Phone and email
- Logo

#### 13.2 Verification (`/settings/verification`)
- Business verification status
- "Marketplace Ready" badge
- Required documentation

#### 13.3 AFIP (`/settings/afip`)
- Electronic invoicing configuration
- Digital certificate (.pfx)
- Point of sale
- Enabled invoice types
- Testing in homologation

#### 13.4 MercadoPago (`/settings/mercadopago`)
- OAuth connection
- Client ID and Secret
- Integration status
- Webhook configuration

#### 13.5 WhatsApp (`/settings/whatsapp`)
- Number configuration
- Managed Number vs Deep Link
- Templates
- Meta verification status

#### 13.6 AI Assistant (`/settings/ai-assistant`)
- Copilot configuration
- Automatic responses
- Triggers and rules
- Evaluation datasets

#### 13.7 Service Types (`/settings/service-types`)
- Services offered by company
- Multi-trade configuration
- Specialties

#### 13.8 Pricebook (`/settings/pricebook`)
- Products and services
- Prices by category
- Inflation index tracking

#### 13.9 Labor Rates (`/settings/labor-rates`)
- Hourly rate by specialty
- Levels (junior, senior, etc.)
- UOCRA/ENARGAS compliance

#### 13.10 Notifications (`/settings/notifications`)
- Channels (email, WhatsApp, push)
- Reminders
- Preferences by event type

#### 13.11 Privacy (`/settings/privacy`)
- Privacy policy
- GDPR/Law 25.326 compliance
- Data retention

### APIs Used
- `GET /api/organization` - Organization data
- `PATCH /api/organization` - Update organization
- `GET /api/settings/...` - Specific settings
- `PATCH /api/settings/...` - Update settings

---

## Additional Modules (Not in Main Navigation)

### 14. Dispatch (`/dashboard/dispatch`)
- ADMIN view
- Intelligent job assignment
- Route optimization

### 15. Approvals (`/dashboard/approvals`)
- Pending approvals
- Price variances
- Status changes

### 16. Profile (`/dashboard/profile`)
- User profile
- Password change
- Personal preferences

### 17. Voice Review (`/dashboard/voice-review`)
- Customer audio review
- Transcriptions
- Sentiment analysis

### 18. Marketplace (`/dashboard/marketplace`)
- Leads received from public marketplace
- Public profile status
- Performance

### 19. Integrations (`/dashboard/integrations`)
- Third-party integrations
- Webhooks
- API keys

### 20. Admin (`/dashboard/admin`)
**SUPER_ADMIN only:**
- Organization management
- Queue dashboard
- System health
- AFIP migration tools
- Growth engine
- BSP readiness
- Verification queue
- Number inventory

---

## Complete End-to-End Flows

### Flow 1: New Customer → Job → Invoice → Payment

1. **New customer** registers or is created by ADMIN
2. **Job created** from Dashboard/Jobs/Calendar
3. **Technician assigned** manually or automatically (dispatch)
4. **Technician accepts** and goes en route (tracking on Map)
5. **Job completed** with:
   - Materials used (from Inventory)
   - Photos
   - Customer signature
   - Final pricing (may vary from estimate)
6. **Invoice generated** automatically or manually
   - CAE obtained from AFIP
   - PDF sent to customer via WhatsApp/Email
7. **Payment recorded**:
   - On-site (cash/transfer/MP from mobile)
   - MercadoPago payment link
   - Subsequent transfer
8. **Rating requested** from customer via WhatsApp

### Flow 2: Marketplace Lead → Conversion

1. **Lead received** from public profile
2. **Automatic WhatsApp** response (Copilot)
3. **ADMIN reviews** and contacts
4. **Job scheduled** in Calendar
5. Continues as Flow 1

### Flow 3: Multi-Visit Job

1. **Job created** with `pricingMode: PER_VISIT`
2. **Visits configured** (e.g., 3 visits, 1 per week)
3. **Each visit** scheduled in Calendar
4. **Technician completes** visit 1, 2, 3...
5. **At the end**, invoice generated for total visits
6. **Payment** can be initial deposit + final

---

## Key Technologies and Patterns

### Frontend
- **Next.js 14** with App Router
- **TypeScript** (strict mode)
- **Tailwind CSS**
- **React Query v5** for data fetching
- **Zustand** for global state (if applicable)
- **Leaflet** for maps
- **Chart.js** for charts

### Backend
- **Next.js API Routes** (serverless)
- **Prisma ORM** with PostgreSQL (Supabase)
- **BullMQ** for background jobs
- **Redis** for caching and locking
- **WebSockets** for real-time

### External Services
- **AFIP** - Electronic invoicing
- **MercadoPago** - Payments (OAuth + webhooks)
- **Meta Cloud API** - Direct WhatsApp
- **Twilio** - Number purchase for WhatsApp
- **OpenAI** - AI Copilot (GPT-4)
- **OSRM** - Routing and maps

### Architectural Patterns
- **Multi-tenant** with `organizationId` in all tables
- **RBAC** (Role-Based Access Control) with field-level permissions
- **SQL Views** for performance (`jobs_v2_list`, etc.)
- **Terminal State Guards** (COMPLETED/CANCELLED are immutable)
- **Truth Reconciliation** (0.01 variance threshold for financials)
- **Decimal for Money** (no floats, uses Prisma Decimal)
- **Audit Trail** (createdAt, updatedAt, forensic snapshots)
- **Feature Flags** by subscription tier
- **Graceful Degradation** with circuit breakers

---

## Next Steps / Roadmap

### High Priority
1. **Complete Jobs CRUD** with multi-visit wizard
2. **Complete Invoice form** with preview
3. **Complete mobile app sync** (offline-first)
4. **AFIP integration** end-to-end testing
5. **MercadoPago payments** complete with webhooks

### Medium Priority
6. **Inventory movements** (purchases, adjustments, transfers)
7. **Fleet compliance alerts** automatic
8. **Advanced analytics** dashboards
9. **WhatsApp file attachments**
10. **Approval workflows** UI for variances

### Low Priority
11. **Multi-warehouse** support
12. **Custom reports** builder
13. **Mobile push notifications**
14. **Voice AI** transcription and analysis
15. **Marketplace** bidding system

---

## Pending Decisions

1. **Multi-visit jobs UI**: 3-step wizard or single complex form?
2. **Pricing variance approval**: Automatic flow or manual by ADMIN?
3. **Inventory reservations**: Automatic when creating job or manual?
4. **Vehicle assignment**: Per job or per technician shift?
5. **WhatsApp managed numbers**: Limit by tier or by demand?
6. **AI Copilot boundaries**: What can it approve automatically?
7. **Analytics retention**: How long to keep historical data?
8. **Mobile offline limits**: How many jobs can a technician have offline?

---

**Document created:** 2026-02-11  
**Version:** 1.0  
**Next review:** After implementing missing features
