-- ═══════════════════════════════════════════════════════════════════════════════
-- OPTIMIZED SEARCH VIEWS MIGRATION
-- Phase 1: Database Views and Full-Text Search Indexes
-- 
-- Purpose: Improve query performance for Jobs page and Global Search
-- Expected improvement: 10-15s → <500ms
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1.3: FULL-TEXT SEARCH SUPPORT (Must come first - function used by views)
-- Enables fast natural language search for AI Copilot
-- Uses Spanish configuration for proper stemming
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper function for accent-insensitive search (Argentine names: Pérez, González, etc.)
CREATE OR REPLACE FUNCTION normalize_search_text(input TEXT)
RETURNS TEXT AS $$
BEGIN
    IF input IS NULL THEN
        RETURN '';
    END IF;
    RETURN LOWER(
        TRANSLATE(
            input,
            'ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòù',
            'AEIOUUNaeiouunAEIOUaeiou'
        )
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

COMMENT ON FUNCTION normalize_search_text(TEXT) IS 'Normalizes text for accent-insensitive search. Handles Argentine Spanish diacritics.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1.1: JOBS LIST VIEW
-- Pre-joins customer and technician data for fast list queries
-- Note: Column names match database schema (camelCase for non-@map, snake_case for @map)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_jobs_list AS
SELECT 
    j.id,
    j."jobNumber" AS job_number,
    j.status,
    j.urgency,
    j."serviceType" AS service_type,
    j.service_type_code,  -- Has @map("service_type_code")
    j.description,
    j."scheduledDate" AS scheduled_date,
    j."scheduledTimeSlot" AS scheduled_time_slot,
    j."durationType" AS duration_type,
    j.pricing_locked_at,  -- Has @map("pricing_locked_at")
    j.estimated_total,    -- Has @map("estimated_total")
    j.tech_proposed_total, -- Has @map("tech_proposed_total")
    j.variance_approved_at,  -- Has @map
    j.variance_rejected_at,  -- Has @map
    j."createdAt" AS created_at,
    j."completedAt" AS completed_at,
    j."organizationId" AS organization_id,
    j."customerId" AS customer_id,
    -- Pre-joined customer fields
    c.name AS customer_name,
    c.phone AS customer_phone,
    c.address AS customer_address,
    -- Pre-joined technician fields
    j."technicianId" AS technician_id,
    u.name AS technician_name,
    -- Assignment count (for "+2 más" badge)
    (SELECT COUNT(*) FROM job_assignments WHERE "jobId" = j.id) AS assignment_count,
    -- Vehicle info
    j."vehicleId" AS vehicle_id,
    v."plateNumber" AS vehicle_plate,
    v.make AS vehicle_make,
    v.model AS vehicle_model
FROM jobs j
LEFT JOIN customers c ON j."customerId" = c.id
LEFT JOIN users u ON j."technicianId" = u.id
LEFT JOIN vehicles v ON j."vehicleId" = v.id;

COMMENT ON VIEW v_jobs_list IS 'Optimized view for jobs list queries with pre-joined customer/technician data. Phase 1.1';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1.2: JOBS COUNTS VIEW
-- Instant counts for tabs: Todos, Activos, Cancelados
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_jobs_counts AS
SELECT 
    "organizationId" AS organization_id,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
    COUNT(*) FILTER (WHERE status != 'CANCELLED') AS active_count,
    COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') AS in_progress_count,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_count,
    COUNT(*) FILTER (
        WHERE status = 'COMPLETED' 
        AND "completedAt" >= date_trunc('month', CURRENT_DATE)
    ) AS completed_this_month,
    COUNT(*) FILTER (
        WHERE "scheduledDate" >= CURRENT_DATE 
        AND "scheduledDate" < CURRENT_DATE + INTERVAL '1 day'
        AND status NOT IN ('CANCELLED', 'COMPLETED')
    ) AS scheduled_today,
    COUNT(*) FILTER (
        WHERE tech_proposed_total IS NOT NULL 
        AND variance_approved_at IS NULL 
        AND variance_rejected_at IS NULL
        AND pricing_locked_at IS NULL
    ) AS pending_variance
FROM jobs
GROUP BY "organizationId";

COMMENT ON VIEW v_jobs_counts IS 'Aggregated job counts by organization for dashboard stats and tab badges. Phase 1.2';

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1.3 CONTINUED: Create indexes for faster filtering
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create indexes on jobs table for faster filtering
-- (These may already exist from previous migration, so use IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_jobs_org_status_date 
ON jobs ("organizationId", status, "scheduledDate" DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_org_created 
ON jobs ("organizationId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_org_completed 
ON jobs ("organizationId", "completedAt" DESC) 
WHERE "completedAt" IS NOT NULL;

-- Create indexes on customers table for search
CREATE INDEX IF NOT EXISTS idx_customers_org_name 
ON customers ("organizationId", name);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 1.4: GLOBAL SEARCH VIEW
-- Unified view for cross-entity search (AI Copilot compatible)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW v_global_search AS
-- Jobs
SELECT 
    j.id,
    'jobs'::text AS entity_type,
    j."jobNumber" AS title,
    j.description AS subtitle,
    j.status::text AS badge,
    j."organizationId" AS organization_id,
    normalize_search_text(
        COALESCE(j."jobNumber", '') || ' ' ||
        COALESCE(j.description, '') || ' ' ||
        COALESCE(c.name, '') || ' ' ||
        COALESCE(j.service_type_code, '')
    ) AS normalized_text,
    j."createdAt" AS created_at,
    j."scheduledDate" AS sort_date
FROM jobs j
LEFT JOIN customers c ON j."customerId" = c.id

UNION ALL

-- Customers
SELECT 
    c.id,
    'customers'::text AS entity_type,
    c.name AS title,
    COALESCE(c.email, c.phone) AS subtitle,
    CASE WHEN c."isVip" = true THEN 'VIP' ELSE NULL END AS badge,
    c."organizationId" AS organization_id,
    normalize_search_text(
        c.name || ' ' || 
        COALESCE(c.phone, '') || ' ' || 
        COALESCE(c.email, '')
    ) AS normalized_text,
    c."createdAt" AS created_at,
    c."createdAt" AS sort_date
FROM customers c

UNION ALL

-- Team Members (Users)
SELECT 
    u.id,
    'team'::text AS entity_type,
    u.name AS title,
    COALESCE(u.email, u.phone) AS subtitle,
    u.role::text AS badge,
    u."organizationId" AS organization_id,
    normalize_search_text(
        u.name || ' ' || 
        COALESCE(u.email, '') || ' ' ||
        COALESCE(u.phone, '')
    ) AS normalized_text,
    u."createdAt" AS created_at,
    u."createdAt" AS sort_date
FROM users u

UNION ALL

-- Vehicles
SELECT 
    v.id,
    'vehicles'::text AS entity_type,
    v.make || ' ' || v.model AS title,
    v."plateNumber" || ' • ' || v.year::text AS subtitle,
    v.status::text AS badge,
    v."organizationId" AS organization_id,
    normalize_search_text(
        v."plateNumber" || ' ' || 
        v.make || ' ' || 
        v.model || ' ' || 
        COALESCE(v.color, '')
    ) AS normalized_text,
    v."createdAt" AS created_at,
    v."createdAt" AS sort_date
FROM vehicles v

UNION ALL

-- Inventory Items
SELECT 
    i.id,
    'inventory'::text AS entity_type,
    i.name AS title,
    'SKU: ' || i.sku || ' • ' || i.category::text AS subtitle,
    i.category::text AS badge,
    i."organizationId" AS organization_id,
    normalize_search_text(
        i.name || ' ' || 
        i.sku || ' ' || 
        COALESCE(i.description, '')
    ) AS normalized_text,
    i."createdAt" AS created_at,
    i."createdAt" AS sort_date
FROM inventory_items i
WHERE i."isActive" = true

UNION ALL

-- Invoices
SELECT 
    inv.id,
    'invoices'::text AS entity_type,
    inv."invoiceNumber" AS title,
    COALESCE(c.name, 'Sin cliente') AS subtitle,
    inv.status::text AS badge,
    inv."organizationId" AS organization_id,
    normalize_search_text(
        COALESCE(inv."invoiceNumber", '') || ' ' || 
        COALESCE(c.name, '')
    ) AS normalized_text,
    inv."createdAt" AS created_at,
    inv."createdAt" AS sort_date
FROM invoices inv
LEFT JOIN customers c ON inv."customerId" = c.id

UNION ALL

-- Payments
SELECT 
    p.id,
    'payments'::text AS entity_type,
    '$' || p.amount::text AS title,
    COALESCE(inv."invoiceNumber", 'Sin factura') || ' • ' || COALESCE(c.name, '') AS subtitle,
    p.status::text AS badge,
    p."organizationId" AS organization_id,
    normalize_search_text(
        COALESCE(inv."invoiceNumber", '') || ' ' || 
        COALESCE(c.name, '') || ' ' ||
        COALESCE(p.reference, '')
    ) AS normalized_text,
    p."createdAt" AS created_at,
    p."createdAt" AS sort_date
FROM payments p
LEFT JOIN invoices inv ON p."invoiceId" = inv.id
LEFT JOIN customers c ON inv."customerId" = c.id;

COMMENT ON VIEW v_global_search IS 'Unified search view for Global Search and AI Copilot natural language queries. Phase 1.4';

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADDITIONAL INDEXES FOR GLOBAL SEARCH VIEW PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════

-- Ensure all base tables have organization indexes for view performance
CREATE INDEX IF NOT EXISTS idx_users_org_name 
ON users ("organizationId", name);

CREATE INDEX IF NOT EXISTS idx_vehicles_org_plate 
ON vehicles ("organizationId", "plateNumber");

CREATE INDEX IF NOT EXISTS idx_inventory_org_name 
ON inventory_items ("organizationId", name) 
WHERE "isActive" = true;

CREATE INDEX IF NOT EXISTS idx_invoices_org_number 
ON invoices ("organizationId", "invoiceNumber");

CREATE INDEX IF NOT EXISTS idx_payments_org_created 
ON payments ("organizationId", "createdAt" DESC);

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES (for testing after migration)
-- Run these manually to verify views work:
--
-- SELECT * FROM v_jobs_list LIMIT 5;
-- SELECT * FROM v_jobs_counts;
-- SELECT * FROM v_global_search WHERE organization_id = 'YOUR_ORG_ID' LIMIT 10;
-- SELECT normalize_search_text('María González');  -- Should return: maria gonzalez
-- ═══════════════════════════════════════════════════════════════════════════════
