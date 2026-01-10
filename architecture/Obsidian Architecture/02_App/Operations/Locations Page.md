---
tags:
  - page
  - app
  - locations
status: 🟡 In Progress
type: Application Page
path: apps/web/app/dashboard/locations/page.tsx
---

# 🗺️ Locations / Zones Page (Zonas)

> [!INFO] **Purpose**
> Define and manage service zones for the organization. Control where technicians operate and set zone-specific pricing or rules.

---

## 📸 Preview
![[zones-map.png]]

---

## 🧩 Page Structure

### Header Section
| Element | Description |
|:---|:---|
| Page Title | "Zonas de Servicio" |
| Zone Count | Number of active zones |
| `+ Nueva Zona` | Primary CTA button |

### Layout
| Section | Description |
|:---|:---|
| Left Panel | Zone list with details |
| Right Panel | Interactive map |

---

## 🗺️ Zone Management

### Zone Properties
| Field | Description |
|:---|:---|
| Nombre | Zone name (e.g., "CABA", "Zona Norte") |
| Tipo | Draw type (polygon, radius, neighborhood) |
| Color | Display color on map |
| Estado | Active / Inactive |
| Cobertura | Enabled/disabled for new jobs |
| Técnicos | Assigned technicians |

### Zone Pricing (Optional)
- Base price adjustment (+/- %)
- Travel fee
- Minimum charge

---

## 🖱️ Interactions

| Element | Action | Result |
|:---|:---|:---|
| `+ Nueva Zona` | `Click` | Enter draw mode on map |
| Zone Card | `Click` | Highlight zone on map |
| Map Polygon | `Click` | Select zone, show details |
| Zone Card | `Drag` | Reorder priority (optional) |
| Draw Tool | `Click points` | Create polygon boundaries |
| Edit Button | `Click` | Enter edit mode for zone |
| Delete Button | `Click` | Confirm dialog → Remove zone |

---

## 🎨 Map Drawing Tools

### Drawing Modes
| Tool | Description |
|:---|:---|
| Polygon | Draw custom shape by clicking points |
| Circle | Set center + radius |
| Rectangle | Draw rectangular area |
| Neighborhood | Select from predefined admin areas |

### Editing
- Drag points to adjust boundaries
- Add/remove vertices
- Resize radius (for circles)

---

## 📍 Zone Assignment

### Technician Assignment
- Each zone can have primary technicians
- Fallback technicians for overflow
- Auto-routing suggestions based on zone

### Job Zone Detection
- New jobs auto-tagged with zone
- Based on customer address geocoding
- "Out of zone" warning for unserved areas

---

## 🔐 Access Control

| Role | Permissions |
|:---|:---|
| OWNER | Full zone management |
| ADMIN | View zones, suggest changes |
| TECHNICIAN | View assigned zones only |

---

## 🛠️ Technical Context

- **List Page:** `apps/web/app/dashboard/locations/page.tsx`
- **Detail Page:** `apps/web/app/dashboard/locations/[id]/page.tsx`

### API Endpoints
- `GET /api/locations` - List zones
- `POST /api/locations` - Create zone
- `GET /api/locations/:id` - Get details
- `PATCH /api/locations/:id` - Update zone
- `DELETE /api/locations/:id` - Delete zone
- `POST /api/locations/check` - Check if point is in zone

### Mapping Libraries
- Google Maps Drawing Manager
- or Mapbox Draw

### Data Structure
```typescript
interface Zone {
  id: string;
  name: string;
  type: 'polygon' | 'circle' | 'rectangle';
  coordinates: GeoJSON.Geometry;
  color: string;
  isActive: boolean;
  pricingAdjustment?: number;
  assignedTechnicians: string[];
}
```

---

## 🔗 Connections

- **Parent:** [[Dashboard Home]]
- **Children:**
  - [[Zone Detail Page]]
- **Related:**
  - [[Map View]] (Zone visualization)
  - [[Team Page]] (Technician assignments)
  - [[New Job Page]] (Zone detection)
  - [[Settings - Organization]] (Default zone)

---

## 📝 Notes

- [ ] TODO: Import zones from shapefile
- [ ] TODO: Zone overlap warnings
- [ ] TODO: Service availability times per zone
- [ ] TODO: Zone-specific working hours
- [ ] Consider: Dynamic pricing by zone demand
