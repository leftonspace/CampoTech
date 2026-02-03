# Query Optimization Implementation Plan

> **Reference Pattern for CampoTech Database Queries**
> 
> Created: 2026-02-01
> Status: **Phase 1-4 ✅ COMPLETE** | Phase 5 Pending

---

## Executive Summary

This plan addresses critical performance issues affecting the Jobs page and Global Search functionality. The current architecture fetches large datasets client-side, causing 10-15 second delays when filtering. This plan introduces PostgreSQL views with full-text search to achieve sub-500ms response times while maintaining support for the AI Copilot's natural language search requirements.

---

## Current State Analysis

### Problem: Over-fetching + Client-Side Filtering

| File | Issue | Impact |
|------|-------|--------|
| `apps/web/app/dashboard/jobs/page.tsx:202` | `limit: '1000'` - fetches all jobs | 10-15s delay |
| `apps/web/app/dashboard/jobs/page.tsx:337-398` | `useMemo` client-side filtering | High CPU usage |
| `src/services/job.service.ts:57-93` | 11+ JOINs per query | Database bottleneck |
| `apps/web/app/api/search/route.ts:19` | `MAX_FETCH_FOR_FILTER = 500` | Fetch all, filter in JS |

### Current Job Query Architecture (Slow)

```
Frontend (Jobs Page)
    ↓ HTTP Request (limit: 1000)
API Route (/api/jobs)
    ↓ Prisma Query (11 JOINs)
Database (PostgreSQL)
    ↓ Returns 1000+ rows
API Response (large JSON payload)
    ↓ Back to Frontend
JavaScript Filtering (useMemo)
    ↓ Finally renders
```

### Target Architecture (Fast)

```
Frontend (Jobs Page)
    ↓ HTTP Request (status=COMPLETED, page=1, limit=50)
API Route (/api/jobs/v2)
    ↓ SQL Query on Optimized View (indexed)
Database (PostgreSQL View)
    ↓ Returns 50 pre-filtered rows
API Response (small JSON payload)
    ↓ Renders immediately
```

---

## Implementation Phases

### Phase 1: Database Views and Indexes (Migration)

**File:** `apps/web/prisma/migrations/YYYYMMDD_add_optimized_search_views/migration.sql`

#### 1.1 Jobs List View

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- JOBS LIST VIEW
-- Pre-joins customer and technician data for fast list queries
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_jobs_list AS
SELECT 
    j.id,
    j."jobNumber" AS job_number,
    j.status,
    j.urgency,
    j."serviceType" AS service_type,
    j."serviceTypeCode" AS service_type_code,
    j.description,
    j."scheduledDate" AS scheduled_date,
    j."scheduledTimeSlot" AS scheduled_time_slot,
    j."durationType" AS duration_type,
    j."pricingLockedAt" AS pricing_locked_at,
    j."estimatedTotal" AS estimated_total,
    j."techProposedTotal" AS tech_proposed_total,
    j."varianceApprovedAt" AS variance_approved_at,
    j."varianceRejectedAt" AS variance_rejected_at,
    j."createdAt" AS created_at,
    j."completedAt" AS completed_at,
    j."organizationId" AS organization_id,
    -- Pre-joined customer fields
    c.id AS customer_id,
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.address AS customer_address,
    -- Pre-joined technician fields
    u.id AS technician_id,
    u.name AS technician_name,
    -- Assignment count (for "+2 más" badge)
    (SELECT COUNT(*) FROM job_assignments WHERE "jobId" = j.id) AS assignment_count,
    -- Vehicle info
    v.id AS vehicle_id,
    v."plateNumber" AS vehicle_plate,
    v.make AS vehicle_make,
    v.model AS vehicle_model
FROM jobs j
LEFT JOIN customers c ON j."customerId" = c.id
LEFT JOIN users u ON j."technicianId" = u.id
LEFT JOIN vehicles v ON j."vehicleId" = v.id;

-- Add comment for documentation
COMMENT ON VIEW v_jobs_list IS 'Optimized view for jobs list queries with pre-joined customer/technician data';
```

#### 1.2 Jobs Counts View (for Tab Badges)

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- JOBS COUNTS VIEW
-- Instant counts for tabs: Todos, Activos, Cancelados
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_jobs_counts AS
SELECT 
    "organizationId" AS organization_id,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE status != 'CANCELLED') AS active_count,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_count,
    COUNT(*) FILTER (
        WHERE status = 'COMPLETED' 
        AND "completedAt" >= date_trunc('month', CURRENT_DATE)
    ) AS completed_this_month,
    COUNT(*) FILTER (
        WHERE "scheduledDate" >= CURRENT_DATE 
        AND "scheduledDate" < CURRENT_DATE + INTERVAL '1 day'
        AND status != 'CANCELLED'
    ) AS scheduled_today,
    COUNT(*) FILTER (
        WHERE "techProposedTotal" IS NOT NULL 
        AND "varianceApprovedAt" IS NULL 
        AND "varianceRejectedAt" IS NULL
        AND "pricingLockedAt" IS NULL
    ) AS pending_variance
FROM jobs
GROUP BY "organizationId";

COMMENT ON VIEW v_jobs_counts IS 'Aggregated job counts by organization for dashboard stats';
```

#### 1.3 Full-Text Search Index (AI Copilot Ready)

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- FULL-TEXT SEARCH SUPPORT
-- Enables fast natural language search for AI Copilot
-- Uses Spanish configuration for proper stemming (trabajar → trabaj)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper function for accent-insensitive search
CREATE OR REPLACE FUNCTION normalize_text(input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(
        TRANSLATE(
            input,
            'ÁÉÍÓÚÜÑáéíóúüñ',
            'AEIOUUNaeiouun'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add searchable text column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_text TEXT GENERATED ALWAYS AS (
    COALESCE("jobNumber", '') || ' ' ||
    COALESCE(description, '') || ' ' ||
    COALESCE("serviceTypeCode", '')
) STORED;

-- Add tsvector column for full-text search
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_vector tsvector 
    GENERATED ALWAYS AS (
        to_tsvector('spanish', 
            COALESCE("jobNumber", '') || ' ' ||
            COALESCE(description, '')
        )
    ) STORED;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_jobs_search_vector 
ON jobs USING GIN (search_vector);

-- Create index for normalized text search (accent-insensitive)
CREATE INDEX IF NOT EXISTS idx_jobs_search_text_norm 
ON jobs (normalize_text(search_text));

-- Add similar columns/indexes to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS search_text TEXT GENERATED ALWAYS AS (
    name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(email, '')
) STORED;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS search_vector tsvector 
    GENERATED ALWAYS AS (
        to_tsvector('spanish', name || ' ' || COALESCE(phone, '') || ' ' || COALESCE(email, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_customers_search_vector 
ON customers USING GIN (search_vector);
```

#### 1.4 Global Search View (AI Copilot)

```sql
-- ═══════════════════════════════════════════════════════════════════════════════
-- GLOBAL SEARCH VIEW
-- Unified view for cross-entity search (AI Copilot compatible)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_global_search AS
-- Jobs
SELECT 
    j.id,
    'jobs' AS entity_type,
    j."jobNumber" AS title,
    j.description AS subtitle,
    j.status AS badge,
    j."organizationId" AS organization_id,
    j.search_vector,
    normalize_text(
        COALESCE(j."jobNumber", '') || ' ' ||
        COALESCE(j.description, '') || ' ' ||
        COALESCE(c.name, '')
    ) AS normalized_text,
    j."createdAt" AS created_at
FROM jobs j
LEFT JOIN customers c ON j."customerId" = c.id

UNION ALL

-- Customers
SELECT 
    c.id,
    'customers' AS entity_type,
    c.name AS title,
    COALESCE(c.email, c.phone) AS subtitle,
    NULL AS badge,
    c."organizationId" AS organization_id,
    c.search_vector,
    normalize_text(c.name || ' ' || COALESCE(c.phone, '') || ' ' || COALESCE(c.email, '')) AS normalized_text,
    c."createdAt" AS created_at
FROM customers c

UNION ALL

-- Team Members
SELECT 
    u.id,
    'team' AS entity_type,
    u.name AS title,
    COALESCE(u.email, '') AS subtitle,
    u.role AS badge,
    u."organizationId" AS organization_id,
    to_tsvector('spanish', u.name || ' ' || COALESCE(u.email, '')) AS search_vector,
    normalize_text(u.name || ' ' || COALESCE(u.email, '')) AS normalized_text,
    u."createdAt" AS created_at
FROM users u

UNION ALL

-- Vehicles
SELECT 
    v.id,
    'vehicles' AS entity_type,
    v.make || ' ' || v.model AS title,
    v."plateNumber" || ' • ' || v.year::text AS subtitle,
    v.status AS badge,
    v."organizationId" AS organization_id,
    to_tsvector('spanish', 
        v."plateNumber" || ' ' || v.make || ' ' || v.model || ' ' || COALESCE(v.color, '')
    ) AS search_vector,
    normalize_text(
        v."plateNumber" || ' ' || v.make || ' ' || v.model || ' ' || COALESCE(v.color, '')
    ) AS normalized_text,
    v."createdAt" AS created_at
FROM vehicles v

UNION ALL

-- Invoices
SELECT 
    i.id,
    'invoices' AS entity_type,
    i."invoiceNumber" AS title,
    COALESCE(c.name, 'Sin cliente') AS subtitle,
    i.status AS badge,
    i."organizationId" AS organization_id,
    to_tsvector('spanish', 
        COALESCE(i."invoiceNumber", '') || ' ' || COALESCE(c.name, '')
    ) AS search_vector,
    normalize_text(
        COALESCE(i."invoiceNumber", '') || ' ' || COALESCE(c.name, '')
    ) AS normalized_text,
    i."createdAt" AS created_at
FROM invoices i
LEFT JOIN customers c ON i."customerId" = c.id;

COMMENT ON VIEW v_global_search IS 'Unified search view for AI Copilot natural language queries';
```

---

### Phase 2: Service Layer Updates

**File:** `src/services/job.service.ts`

Add new optimized methods alongside existing ones (non-breaking):

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// OPTIMIZED QUERY METHODS (Phase 2)
// Uses SQL views for sub-500ms response times
// ═══════════════════════════════════════════════════════════════════════════════

interface JobListResult {
  id: string;
  job_number: string;
  status: string;
  urgency: string;
  service_type: string;
  service_type_code: string | null;
  description: string;
  scheduled_date: Date | null;
  scheduled_time_slot: unknown;
  duration_type: string;
  pricing_locked_at: Date | null;
  estimated_total: string | null;
  created_at: Date;
  completed_at: Date | null;
  organization_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: unknown;
  technician_id: string | null;
  technician_name: string | null;
  assignment_count: number;
  vehicle_id: string | null;
  vehicle_plate: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
}

interface JobCountsResult {
  organization_id: string;
  total_count: number;
  active_count: number;
  cancelled_count: number;
  in_progress_count: number;
  completed_this_month: number;
  scheduled_today: number;
  pending_variance: number;
}

/**
 * Fast job list query using optimized view
 * Replaces listJobs for performance-critical paths
 */
static async listJobsFast(
  orgId: string,
  filters: JobFilter = {},
  pagination: { page?: number; limit?: number; sort?: string; order?: 'asc' | 'desc' } = {}
): Promise<{ items: JobListResult[]; pagination: { page: number; limit: number; total: number; totalPages: number } }> {
  const { status, search, durationType, technicianId } = filters;
  const { page = 1, limit = 50, sort = 'scheduled_date', order = 'desc' } = pagination;
  const offset = (page - 1) * limit;

  // Build WHERE conditions
  const conditions: string[] = ['organization_id = $1'];
  const params: (string | number)[] = [orgId];
  let paramIndex = 2;

  if (status && status !== 'all') {
    if (Array.isArray(status)) {
      const placeholders = status.map((_, i) => `$${paramIndex + i}`);
      conditions.push(`status IN (${placeholders.join(', ')})`);
      params.push(...status.map(s => s.toUpperCase()));
      paramIndex += status.length;
    } else {
      conditions.push(`status = $${paramIndex}`);
      params.push(status.toUpperCase());
      paramIndex++;
    }
  }

  if (durationType && durationType !== 'all') {
    conditions.push(`duration_type = $${paramIndex}`);
    params.push(durationType.toUpperCase());
    paramIndex++;
  }

  if (technicianId && technicianId !== 'all') {
    conditions.push(`technician_id = $${paramIndex}`);
    params.push(technicianId);
    paramIndex++;
  }

  if (search) {
    // Accent-insensitive search using normalized text
    const normalizedSearch = search.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    conditions.push(`(
      normalize_text(job_number || ' ' || COALESCE(description, '') || ' ' || COALESCE(customer_name, ''))
      LIKE '%' || $${paramIndex} || '%'
    )`);
    params.push(normalizedSearch);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');
  const orderColumn = sort.replace(/([A-Z])/g, '_$1').toLowerCase(); // camelCase to snake_case
  const orderDirection = order.toUpperCase();

  // Get items
  const items = await prisma.$queryRawUnsafe<JobListResult[]>(`
    SELECT * FROM v_jobs_list
    WHERE ${whereClause}
    ORDER BY ${orderColumn} ${orderDirection} NULLS LAST
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `, ...params, limit, offset);

  // Get total count
  const countResult = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT COUNT(*) as count FROM v_jobs_list
    WHERE ${whereClause}
  `, ...params.slice(0, paramIndex - 1));

  const total = Number(countResult[0]?.count || 0);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Fast job counts using optimized view
 * Returns all counts in single query (instant)
 */
static async getJobCountsFast(orgId: string): Promise<JobCountsResult | null> {
  const result = await prisma.$queryRaw<JobCountsResult[]>`
    SELECT * FROM v_jobs_counts
    WHERE organization_id = ${orgId}
  `;
  return result[0] || null;
}

/**
 * AI Copilot search using full-text search
 * Supports natural language queries in Spanish
 */
static async aiSearch(
  orgId: string,
  naturalLanguageQuery: string,
  options: { entityType?: string; limit?: number } = {}
): Promise<Array<{ id: string; entity_type: string; title: string; subtitle: string; badge: string | null; relevance: number }>> {
  const { entityType, limit = 10 } = options;
  
  // Normalize query for accent-insensitive search
  const normalizedQuery = naturalLanguageQuery.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Convert to tsquery format
  const tsQuery = normalizedQuery
    .split(/\s+/)
    .filter(word => word.length > 1)
    .join(' & ');

  const entityFilter = entityType ? `AND entity_type = ${entityType}` : '';

  return prisma.$queryRawUnsafe<Array<{ id: string; entity_type: string; title: string; subtitle: string; badge: string | null; relevance: number }>>(`
    SELECT 
      id,
      entity_type,
      title,
      subtitle,
      badge,
      ts_rank(search_vector, plainto_tsquery('spanish', $2)) AS relevance
    FROM v_global_search
    WHERE organization_id = $1
      ${entityFilter}
      AND (
        search_vector @@ plainto_tsquery('spanish', $2)
        OR normalized_text LIKE '%' || $3 || '%'
      )
    ORDER BY relevance DESC, created_at DESC
    LIMIT $4
  `, orgId, naturalLanguageQuery, normalizedQuery, limit);
}
```

---

### Phase 3: API Route Updates

#### 3.1 New Optimized Jobs Endpoint

**File:** `apps/web/app/api/jobs/v2/route.ts`

```typescript
/**
 * Optimized Jobs API v2
 * Uses SQL views for sub-500ms response times
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const durationType = searchParams.get('durationType');
    const technicianId = searchParams.get('technicianId');
    const search = searchParams.get('search') || searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');
    const sort = searchParams.get('sort') || 'scheduledDate';
    const order = (searchParams.get('order') || 'desc') as 'asc' | 'desc';

    const result = await JobService.listJobsFast(session.organizationId, {
      status: status && status !== 'all' ? status : undefined,
      durationType: durationType && durationType !== 'all' ? durationType : undefined,
      technicianId: technicianId && technicianId !== 'all' ? technicianId : undefined,
      search: search || undefined,
    }, {
      page,
      limit,
      sort,
      order,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('Jobs v2 list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}
```

#### 3.2 Optimized Stats Endpoint

**File:** `apps/web/app/api/jobs/stats/v2/route.ts`

```typescript
/**
 * Optimized Jobs Stats API v2
 * Single query for all counts
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const counts = await JobService.getJobCountsFast(session.organizationId);

    if (!counts) {
      return NextResponse.json({
        success: true,
        data: {
          totalCount: 0,
          inProgressCount: 0,
          scheduledTodayCount: 0,
          completedThisMonthCount: 0,
          pendingVarianceCount: 0,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCount: counts.active_count,
        inProgressCount: counts.in_progress_count,
        scheduledTodayCount: counts.scheduled_today,
        completedThisMonthCount: counts.completed_this_month,
        pendingVarianceCount: counts.pending_variance,
        // Also expose raw counts for tabs
        activeCount: counts.active_count,
        cancelledCount: counts.cancelled_count,
      },
    });
  } catch (error) {
    console.error('Jobs stats v2 error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching job stats' },
      { status: 500 }
    );
  }
}
```

---

### Phase 4: Frontend Updates

#### 4.1 Update Jobs Page

**File:** `apps/web/app/dashboard/jobs/page.tsx`

Key changes:
1. Remove `limit: 1000`
2. Add pagination support
3. Use server-side filtering

```typescript
// Before (slow)
const { data: jobsData } = useQuery({
  queryKey: ['jobs', { status: statusFilter, durationType: durationTypeFilter, sortBy }],
  queryFn: () => {
    const params: Record<string, string> = {
      limit: '1000', // ❌ REMOVE THIS
      sort,
      order,
    };
    if (statusFilter) params.status = statusFilter;
    return api.jobs.list(params);
  },
});

// After (fast)
const [page, setPage] = useState(1);

const { data: jobsData, isLoading: jobsLoading } = useQuery({
  queryKey: ['jobs-v2', { 
    status: statusFilter, 
    durationType: durationTypeFilter, 
    technicianId: technicianFilter,
    search,  // ← Move search to server
    sortBy, 
    page 
  }],
  queryFn: () => {
    const params: Record<string, string> = {
      limit: '50',
      page: String(page),
      sort,
      order,
    };
    if (statusFilter) params.status = statusFilter;
    if (durationTypeFilter) params.durationType = durationTypeFilter;
    if (technicianFilter) params.technicianId = technicianFilter;
    if (search) params.search = search; // ← Server-side search
    
    return fetch(`/api/jobs/v2?${new URLSearchParams(params)}`).then(r => r.json());
  },
  keepPreviousData: true, // Smooth pagination
});

// Remove the useMemo client-side filtering
// const filteredAndSortedJobs = useMemo(() => { ... }); // ❌ DELETE

// Use server-returned data directly
const jobRows = jobsData?.data || [];
```

#### 4.2 Update Global Search API

**File:** `apps/web/app/api/search/route.ts`

Replace the 7 separate fetch+filter blocks with single view query:

```typescript
// Before (slow) - 7 separate queries + JS filtering
const allJobs = await prisma.job.findMany({
  where: { organizationId: orgId },
  take: MAX_FETCH_FOR_FILTER, // 500
});
const jobs = allJobs.filter(job => { ... }); // JS filtering

// After (fast) - Single query with SQL filtering
const searchResults = await prisma.$queryRaw`
  SELECT id, entity_type, title, subtitle, badge
  FROM v_global_search
  WHERE organization_id = ${orgId}
    AND (
      search_vector @@ plainto_tsquery('spanish', ${query})
      OR normalized_text LIKE '%' || ${normalizedQuery} || '%'
    )
  ORDER BY 
    CASE entity_type
      WHEN 'jobs' THEN 1
      WHEN 'customers' THEN 2
      WHEN 'team' THEN 3
      WHEN 'vehicles' THEN 4
      WHEN 'inventory' THEN 5
      WHEN 'invoices' THEN 6
      WHEN 'payments' THEN 7
    END,
    created_at DESC
  LIMIT 35
`;

// Group by entity_type
const groupedResults = searchResults.reduce((acc, item) => {
  if (!acc[item.entity_type]) {
    acc[item.entity_type] = [];
  }
  if (acc[item.entity_type].length < 5) {
    acc[item.entity_type].push(item);
  }
  return acc;
}, {} as Record<string, typeof searchResults>);
```

---

### Phase 5: AI Copilot Integration

**File:** `src/services/ai-search.service.ts` (new)

```typescript
/**
 * AI Search Service
 * Provides natural language search for the AI Copilot
 */

import { JobService } from './job.service';

export class AISearchService {
  /**
   * Search across all entities using natural language
   * Called by the AI Copilot when user asks questions like:
   * "encuentrame los trabajos de Juan de la semana pasada"
   */
  static async search(
    orgId: string,
    query: string,
    options: { entityType?: string; limit?: number } = {}
  ) {
    return JobService.aiSearch(orgId, query, options);
  }

  /**
   * Get jobs for a specific customer by name
   * "¿qué trabajos tiene pendientes María González?"
   */
  static async getJobsForCustomer(orgId: string, customerName: string) {
    return JobService.aiSearch(orgId, customerName, { 
      entityType: 'jobs',
      limit: 20 
    });
  }

  /**
   * Get today's schedule
   * "¿qué trabajos hay programados para hoy?"
   */
  static async getTodaysSchedule(orgId: string) {
    const counts = await JobService.getJobCountsFast(orgId);
    const jobs = await JobService.listJobsFast(orgId, {
      // Filter for today would need date params
    }, { limit: 50 });
    
    return {
      scheduledCount: counts?.scheduled_today || 0,
      jobs: jobs.items,
    };
  }
}
```

---

## Migration Checklist

### Pre-Migration
- [ ] Backup database
- [ ] Test migration on staging
- [ ] Verify indexes exist: `@@index([organizationId, status])` in schema.prisma

### Migration Steps
1. [ ] Create migration file with views
2. [ ] Run `pnpm prisma migrate deploy`
3. [ ] Verify views exist: `SELECT * FROM v_jobs_list LIMIT 1`
4. [ ] Add service methods (non-breaking)
5. [ ] Create v2 API routes (parallel to v1)
6. [ ] Update frontend to use v2
7. [ ] Monitor performance
8. [ ] Deprecate v1 routes after validation

### Rollback Plan
```sql
-- If needed, drop views (non-destructive to data)
DROP VIEW IF EXISTS v_jobs_list;
DROP VIEW IF EXISTS v_jobs_counts;
DROP VIEW IF EXISTS v_global_search;
DROP FUNCTION IF EXISTS normalize_text;

-- Remove generated columns
ALTER TABLE jobs DROP COLUMN IF EXISTS search_text;
ALTER TABLE jobs DROP COLUMN IF EXISTS search_vector;
ALTER TABLE customers DROP COLUMN IF EXISTS search_text;
ALTER TABLE customers DROP COLUMN IF EXISTS search_vector;
```

---

## Performance Expectations

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Jobs list (500 jobs) | 10-15s | <200ms | 50-75x |
| Status filter | 10-15s | <100ms | 100-150x |
| Text search | N/A (client) | <50ms | ∞ |
| Tab counts | 4 queries | 1 query | 4x |
| Global search | 7 queries | 1 query | 7x |
| AI search | Would fail | <100ms | ✓ |

---

## Entities to Extend This Pattern

After Jobs is complete, apply the same pattern to:

| Entity | Priority | View Name |
|--------|----------|-----------|
| Customers | 🟡 Medium | `v_customers_list` |
| Invoices | 🟡 Medium | `v_invoices_list` |
| Payments | 🟢 Low | `v_payments_list` |
| Vehicles | 🟢 Low | `v_vehicles_list` |
| Inventory | 🟢 Low | `v_inventory_list` |

---

## Files Modified Summary

| File | Action |
|------|--------|
| `apps/web/prisma/migrations/YYYYMMDD_.../migration.sql` | Create (views) |
| `src/services/job.service.ts` | Add methods |
| `apps/web/app/api/jobs/v2/route.ts` | Create |
| `apps/web/app/api/jobs/stats/v2/route.ts` | Create |
| `apps/web/app/api/search/route.ts` | Refactor |
| `apps/web/app/dashboard/jobs/page.tsx` | Update |
| `apps/web/lib/api-client.ts` | Add v2 methods |
| `src/services/ai-search.service.ts` | Create |

---

## Next Steps

1. Review this plan and approve
2. Create migration file
3. Test on development database
4. Implement service methods
5. Create v2 API routes
6. Update Jobs page frontend
7. Test and validate performance
8. Deploy to staging
9. Monitor and tune
10. Production deployment
