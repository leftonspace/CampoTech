# Scraper Architecture & Security Plan
## CampoTech Registry Scraping System

**Created:** 2026-01-17
**Status:** In Progress
**Priority:** High (Security)

---

## Current State

### What Exists

| Component | Location | Status |
|-----------|----------|--------|
| Gasnor Web Scraper | `lib/scrapers/gasnor-web-scraper.ts` | ✅ Working |
| GasNEA Scraper | `lib/scrapers/gasnea-scraper.ts` | ⬜ Placeholder |
| CACAAV Scraper | `lib/scrapers/cacaav-playwright-scraper.ts` | ✅ Working |
| ERSEP Scraper | `lib/scrapers/ersep-playwright-scraper.ts` | ⚠️ Needs VPN |
| PDF Parser | `lib/scrapers/gas-pdf-parser.ts` | ✅ Working |
| Scraper APIs | `/api/admin/growth-engine/scrape/*` | ✅ Secured |
| Admin Dashboard | `/dashboard/admin/growth-engine` | ✅ Working |

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. PUBLIC REGISTRIES                                                         │
│    - naturgynoa.com.ar/instaladores (Gasnor)                                │
│    - cacaav.com.ar/matriculados (CACAAV)                                    │
│    - ersep.cba.gov.ar (ERSEP - requires VPN)                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ Playwright Scrapers
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. SCRAPER LAYER (apps/web/lib/scrapers/)                                   │
│    - Uses Playwright for dynamic pages                                       │
│    - Extracts: name, matricula, phone, email, province                       │
│    - Triggered via API endpoints (SUPER_ADMIN only)                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ prisma.unclaimedProfile.create()
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. DATABASE: UnclaimedProfile                                                │
│    - Full profile data for claiming                                          │
│    - Outreach tracking (WhatsApp, Email)                                     │
│    - Claim tokens and status                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ populate-verification-registry.ts
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. DATABASE: VerificationRegistry                                            │
│    - Optimized for matricula lookups                                         │
│    - Used by auto-verifier.ts                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Changes (Jan 17, 2026)

### ✅ Completed: Auth Upgrade to SUPER_ADMIN

All scraper endpoints now require `SUPER_ADMIN` role instead of `OWNER`:

| Endpoint | Before | After |
|----------|--------|-------|
| `POST /api/admin/growth-engine/scrape/gasnor-web` | OWNER | SUPER_ADMIN |
| `POST /api/admin/growth-engine/scrape/cacaav` | OWNER | SUPER_ADMIN |
| `POST /api/admin/growth-engine/scrape/ersep` | OWNER | SUPER_ADMIN |
| `POST /api/admin/growth-engine/scrape/cacaav/start` | OWNER | SUPER_ADMIN |
| `POST /api/admin/growth-engine/import/pdf` | OWNER | SUPER_ADMIN |
| `GET /api/admin/growth-engine/scraper-jobs` | OWNER | SUPER_ADMIN |
| `GET /api/admin/growth-engine/scraper-jobs/[id]` | OWNER | SUPER_ADMIN |
| `POST /api/admin/growth-engine/seed-test` | OWNER | SUPER_ADMIN |

### How to Create a SUPER_ADMIN User

The `SUPER_ADMIN` role was added to the `UserRole` enum. To promote yourself:

```bash
cd apps/web
pnpm prisma db push  # Sync schema to database (adds SUPER_ADMIN to enum)
npx tsx scripts/make-super-admin.ts admin@campotech.ar
```

Then log out and log back in.

### Direct Database Update (Alternative)

```sql
UPDATE "users" SET role = 'SUPER_ADMIN' WHERE email = 'your-email@campotech.ar';
```

---

## Architecture Discussion: Where Should Scrapers Live?

### Current: `apps/web/lib/scrapers/`

**Pros:**
- Shares Prisma client with main app
- Dashboard UI already in apps/web
- Works today

**Cons:**
- Scrapers are admin-only, not user-facing
- Runs in web process context
- Could be moved to a worker for long-running jobs

### Option A: Keep in apps/web (Recommended Short-Term)

The scrapers stay where they are, but:
1. ✅ Auth upgraded to SUPER_ADMIN (done)
2. Dashboard accessible only to SUPER_ADMIN
3. Long-running scrapes use background jobs (ScraperJob table)

**Decision:** Keep for now. The UI you built works well!

### Option B: Move to Shared Package (Future)

```
packages/
└── scrapers/
    ├── src/
    │   ├── gasnor.ts
    │   ├── cacaav.ts
    │   └── ersep.ts
    └── package.json
```

Then both `apps/web` and `apps/admin` can import from `@campotech/scrapers`.

### Option C: Standalone Service (Enterprise Scale)

```
services/
└── scrapers/
    ├── src/
    │   └── worker.ts  # Bull/Redis queue consumer
    └── package.json
```

Scrapers run as a separate process, triggered by queue messages.

---

## Open Issues

### 1. Duplicate Matrícula Problem

**Issue:** If User A claims a profile and gets a badge, User B can still submit the same matrícula and get auto-verified.

**Fix Needed:** Check for existing approved submissions before auto-approving.

```typescript
// In auto-verifier.ts, before approving:
const existingClaim = await prisma.verificationSubmission.findFirst({
  where: {
    submittedValue: normalizedMatricula,
    status: 'approved',
    organizationId: { not: submission.organizationId },
  },
});

if (existingClaim) {
  return { needsReview: true, reason: 'Matrícula already claimed by another org' };
}
```

### 2. VerificationRegistry Doesn't Track Claims

**Issue:** When a profile is claimed, the VerificationRegistry entry should be marked as claimed to prevent others from using it.

**Fix:** Add `claimedByOrgId` column to VerificationRegistry.

---

## Files Modified (Jan 17, 2026)

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added `SUPER_ADMIN` to UserRole enum |
| `scripts/make-super-admin.ts` | Created promotion script |
| `api/admin/growth-engine/scrape/gasnor-web/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/scrape/cacaav/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/scrape/cacaav/start/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/scrape/ersep/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/import/pdf/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/scraper-jobs/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/scraper-jobs/[jobId]/route.ts` | Auth → SUPER_ADMIN |
| `api/admin/growth-engine/seed-test/route.ts` | Auth → SUPER_ADMIN |
