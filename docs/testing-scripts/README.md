# Testing Scripts

This folder contains scripts for generating realistic test data to simulate the application flow.

## Scripts

### `seed-500-customers.ts`
Generates 500 realistic customers located around Buenos Aires. Features:
- Real Buenos Aires streets, neighborhoods, and postal codes
- Multiple customers per building (different apartments) - realistic for Argentine cities
- Proper Argentine phone numbers (+54 9 11 format)
- Coordinates for map display (geocoded Buenos Aires locations)
- Mix of individual and business customers
- VIP flagging for some customers

**Usage:**
```bash
cd apps/web
npx tsx ../../docs/testing-scripts/seed-500-customers.ts <org-id> [count]
# Example: npx tsx ../../docs/testing-scripts/seed-500-customers.ts cm6gvnj5q0003vu3c9s1frlkj 500
```

---

### `seed-services-and-products.ts` 🆕
Generates realistic services and products for a multi-trade company offering:
- 🔧 **PLOMERÍA (Plumbing)** - 7 service types, 12 services, 10 products
- ⚡ **ELECTRICIDAD (Electrical)** - 7 service types, 12 services, 10 products
- 🔥 **GAS (Gas installations)** - 7 service types, 10 services, 8 products
- ❄️ **REFRIGERACIÓN (HVAC)** - 6 service types, 11 services, 10 products

Creates:
1. **ServiceTypeConfig** - Organization-specific service types (27 total)
2. **PriceItem (SERVICES)** - Priced services with varying models (45 total)
3. **PriceItem (PRODUCTS)** - Materials and parts (38 total)

**Pricing Models Used:**
- `FIXED` - One fixed price (visitas, instalaciones)
- `HOURLY` - Por hora (mano de obra)
- `PER_UNIT` - Por punto, metro, unidad
- `QUOTE` - Presupuesto personalizado

**Usage:**
```bash
cd apps/web
npx tsx ../../docs/testing-scripts/seed-services-and-products.ts <org-id>
# Example: npx tsx ../../docs/testing-scripts/seed-services-and-products.ts cm6gvnj5q0003vu3c9s1frlkj
```

---

### `delete-all-customers.ts`
Deletes all seeded customers (matching ID pattern `cust-seed-*`).

**Usage:**
```bash
cd apps/web
npx tsx ../../docs/testing-scripts/delete-all-customers.ts <org-id>
```

---

### `delete-all-jobs.ts`
Deletes all jobs for an organization (with cascade to assignments, visits, etc.).

**Usage:**
```bash
cd apps/web
npx tsx ../../docs/testing-scripts/delete-all-jobs.ts <org-id>
```

---

## ✅ Specialty Linking (Implemented)

The following features link services to professions:

| Component | Field | Purpose |
|-----------|-------|---------|
| `ServiceTypeConfig.specialty` | String? | Links job type to trade (PLOMERO, ELECTRICISTA, etc.) |
| `PriceItem.specialty` | String? | Links pricebook item to trade |
| `User.specialties` | String[] | Technician's trade qualifications |

### Dispatch Recommendation API

The `/api/dispatch/recommend` endpoint now supports specialty filtering:

```json
POST /api/dispatch/recommend
{
  "jobLocation": { "lat": -34.6, "lng": -58.4 },
  "filterBySpecialty": "GASISTA",       // Optional: filter by trade
  "strictSpecialtyFilter": false        // If true, exclude non-matching techs
}
```

**Behavior:**
- `strictSpecialtyFilter: false` (default): All technicians shown, matching specialty gets +15 score bonus
- `strictSpecialtyFilter: true`: Only technicians with matching specialty are shown

**Important:** This is a *convenience feature*, not enforcement. See `/terms` for platform liability disclaimer.

---

## Notes
- All scripts are idempotent (use upsert where possible)
- Phone numbers use the test-friendly +54 9 11 5XXX format
- Coordinates are real Buenos Aires locations for accurate map testing
- Prices are in ARS (Argentine Pesos) reflecting 2026 market rates
