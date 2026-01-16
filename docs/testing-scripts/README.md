# Testing Scripts

This folder contains scripts for generating realistic test data to simulate the application flow.

## Scripts

### `seed-500-customers.sql`
Generates 500 realistic customers located around Buenos Aires. Features:
- Real Buenos Aires streets, neighborhoods, and postal codes
- Multiple customers per building (different apartments) - realistic for Argentine cities
- Proper Argentine phone numbers (+54 9 11 format)
- Coordinates for map display (geocoded Buenos Aires locations)
- Mix of individual and business customers
- VIP flagging for some customers

**Usage (TypeScript - recommended):**
```bash
cd apps/web
npx tsx ../../docs/testing-scripts/seed-500-customers.ts [org-id] [count]
# Example: npx tsx ../../docs/testing-scripts/seed-500-customers.ts test-org-001 500
```

**Usage (SQL - Supabase):**
Run directly in Supabase SQL Editor or via `psql`:
```bash
psql $DATABASE_URL -f seed-500-customers.sql
```

### Future Scripts (Planned)
- `seed-jobs-for-week.sql` - Generate realistic job distribution across a week
- `seed-invoices.sql` - Generate invoice data with various statuses
- `seed-technician-locations.sql` - Simulate technician GPS trail data

## Notes
- All scripts are idempotent where possible (use INSERT ... ON CONFLICT)
- Phone numbers use the test-friendly +54 9 11 5XXX format
- Coordinates are real Buenos Aires locations for accurate map testing
