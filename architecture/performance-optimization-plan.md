# Performance Optimization Plan

> **Status**: Pending - To be implemented after all UX/UI and features are complete  
> **Created**: January 2026  
> **Priority**: Phase 2 (Post-Feature Completion)

---

## 📋 Overview

This document outlines performance optimizations to implement once all features are working correctly. During development, the app may feel slow due to:

1. **Remote database access**: Your PC (Argentina) → Supabase (Brazil) = ~100-500ms per request
2. **Development mode**: Code recompiles on each change
3. **Debug logging**: Every database query is logged

**Production will be faster** because Vercel (app host) and Supabase (database) will be in the same region.

---

## 🏗️ Architecture Reminder

| Component | Service | Purpose |
|-----------|---------|---------|
| **Database** | Supabase (PostgreSQL) | Stores all data (customers, jobs, users) |
| **App Host** | Vercel | Runs the Next.js app 24/7 for customers |
| **File Storage** | Supabase Storage | Photos, documents, PDFs |
| **AI Service** | Python FastAPI | Voice transcription, AI features |

Both Supabase and Vercel should be configured in **South America (São Paulo/Brazil)** for best performance in Argentina.

---

## ✅ Optimization Checklist

### Phase 1: Database Indexes (High Impact, Low Effort)

**What**: Add indexes to frequently searched columns  
**Why**: Without indexes, database scans every row. With indexes, it jumps directly to matching rows.

**Columns to index:**

```sql
-- Customers
CREATE INDEX idx_customers_org_name ON "Customer"("organizationId", "name");
CREATE INDEX idx_customers_phone ON "Customer"("phone");

-- Jobs
CREATE INDEX idx_jobs_org_status ON "Job"("organizationId", "status");
CREATE INDEX idx_jobs_org_scheduled ON "Job"("organizationId", "scheduledDate");
CREATE INDEX idx_jobs_customer ON "Job"("customerId");
CREATE INDEX idx_jobs_technician ON "Job"("technicianId");

-- Users
CREATE INDEX idx_users_org_role ON "User"("organizationId", "role");
CREATE INDEX idx_users_email ON "User"("email");

-- Visits
CREATE INDEX idx_visits_job ON "JobVisit"("jobId");
CREATE INDEX idx_visits_date ON "JobVisit"("scheduledDate");
CREATE INDEX idx_visits_technician ON "JobVisit"("technicianId");

-- Vehicles
CREATE INDEX idx_vehicles_org_status ON "Vehicle"("organizationId", "status");
CREATE INDEX idx_vehicles_plate ON "Vehicle"("plateNumber");
```

**How to apply:**
1. Create a Prisma migration: `pnpm prisma migrate dev --name add_performance_indexes`
2. Or run directly in Supabase SQL Editor

**Risk**: Very low. Only uses slightly more storage.

---

### Phase 2: Reduce API Calls Per Page (Medium Impact, Medium Effort)

**What**: Combine multiple small API requests into fewer larger ones

**Current pattern (slow):**
```
Page Load:
  → GET /api/user          (150ms)
  → GET /api/notifications (200ms)
  → GET /api/settings      (180ms)
  → GET /api/jobs          (400ms)
  → GET /api/customers     (300ms)
  Total: 1,230ms (requests run in parallel but still slow)
```

**Optimized pattern:**
```
Page Load:
  → GET /api/dashboard/init  (returns user + settings + notifications)
  → GET /api/jobs?include=customer
  Total: ~500ms
```

**Pages to optimize:**
- [ ] Dashboard home page
- [ ] Jobs list page
- [ ] Customer detail page
- [ ] Calendar/Agenda view

**How**: Create combined API endpoints or use GraphQL-style includes

---

### Phase 3: Client-Side Caching (High Impact, Medium Effort)

**What**: Remember data for short periods instead of re-fetching

**Already configured**: React Query is set up with caching. Check configs:
- `apps/web/lib/api-client.ts`
- Query cache times in components

**Recommended cache times:**
| Data Type | Cache Time | Reason |
|-----------|------------|--------|
| Service types | 5 minutes | Rarely change |
| User settings | 2 minutes | Occasionally change |
| User profile | 1 minute | Sometimes change |
| Jobs list | 30 seconds | Frequently change |
| Notifications | No cache | Need real-time |

**Stale-while-revalidate**: Show cached data immediately, update in background.

---

### Phase 4: Server-Side Optimizations

**Connection Pooling** ✅ Already configured
- File: `apps/web/lib/db/connections.ts`
- Uses Supabase's PgBouncer pooler

**Query Optimization**:
- Use `select` to fetch only needed fields
- Use `include` instead of separate queries for relations
- Avoid N+1 queries (fetching list, then looping to fetch details)

**Example - Before (slow):**
```typescript
const jobs = await db.job.findMany();
for (const job of jobs) {
  job.customer = await db.customer.findUnique({ where: { id: job.customerId } });
}
```

**After (fast):**
```typescript
const jobs = await db.job.findMany({
  include: { customer: true }
});
```

---

### Phase 5: Production Build & Deployment

**Before deploying:**
1. Run production build locally to test: `pnpm build && pnpm start`
2. Verify Vercel region matches Supabase region (both São Paulo)
3. Enable Vercel Edge caching for static assets
4. Configure CDN for images and documents

**Vercel configuration:**
```json
// vercel.json
{
  "regions": ["gru1"],  // São Paulo
  "framework": "nextjs"
}
```

---

## 📊 Performance Targets

| Metric | Current (Dev) | Target (Prod) |
|--------|--------------|---------------|
| Page load | 2-5 seconds | < 1 second |
| API response | 1-3 seconds | < 300ms |
| First contentful paint | 3+ seconds | < 1.5 seconds |
| Database query | 200-500ms | < 50ms |

---

## 🔍 How to Measure Performance

### Terminal (Development)
Watch the terminal for API response times:
```
GET /api/jobs 200 in 1523ms  ← This shows the response time
```

### Browser DevTools
1. Open Chrome DevTools (F12)
2. Go to "Network" tab
3. Reload page
4. Look at "Time" column for each request

### Supabase Dashboard
1. Go to Supabase Dashboard
2. Navigate to "Database" → "Query Performance"
3. See which queries are slowest

---

## 📝 Notes

- Development will always be slower than production - this is normal
- Focus on features first, optimize later
- Always measure before and after optimizations
- Some optimizations require trade-offs (e.g., caching = slightly stale data)

---

## 🚀 When to Start Optimizing

Start this optimization work when:
- [ ] All core features are implemented
- [ ] UI/UX design is finalized
- [ ] Manual testing is complete
- [ ] Ready for beta users
