-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGRAM SEARCH INDEXES
-- Enables fast LIKE '%query%' searches using pg_trgm GIN indexes
--
-- Problem: Standard B-tree indexes cannot accelerate leading-wildcard LIKE.
-- The v_global_search view uses `normalized_text LIKE '%query%'` which
-- forces sequential scans on each UNION ALL source table.
--
-- Solution: pg_trgm extension + GIN indexes on the normalized search text
-- of each source table. PostgreSQL will automatically use these indexes
-- for trigram-based similarity matching in LIKE queries.
--
-- Impact: Searches scale from O(n) to O(log n) per table.
-- At 10K+ rows per entity (historical data imports), this prevents
-- query times from degrading past the 500ms target.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable pg_trgm extension (idempotent — available on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── JOBS ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_jobs_search_trgm
ON jobs USING gin (
    normalize_search_text(
        COALESCE("jobNumber", '') || ' ' ||
        COALESCE(description, '') || ' ' ||
        COALESCE(service_type_code, '')
    ) gin_trgm_ops
);

-- ─── CUSTOMERS ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_search_trgm
ON customers USING gin (
    normalize_search_text(
        name || ' ' ||
        COALESCE(phone, '') || ' ' ||
        COALESCE(email, '')
    ) gin_trgm_ops
);

-- ─── USERS (Team) ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_search_trgm
ON users USING gin (
    normalize_search_text(
        name || ' ' ||
        COALESCE(email, '') || ' ' ||
        COALESCE(phone, '')
    ) gin_trgm_ops
);

-- ─── VEHICLES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vehicles_search_trgm
ON vehicles USING gin (
    normalize_search_text(
        "plateNumber" || ' ' ||
        make || ' ' ||
        model || ' ' ||
        COALESCE(color, '')
    ) gin_trgm_ops
);

-- ─── INVENTORY ITEMS ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_inventory_search_trgm
ON inventory_items USING gin (
    normalize_search_text(
        name || ' ' ||
        sku || ' ' ||
        COALESCE(description, '')
    ) gin_trgm_ops
) WHERE "isActive" = true;

-- ─── INVOICES ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_invoices_search_trgm
ON invoices USING gin (
    normalize_search_text(
        COALESCE("invoiceNumber", '')
    ) gin_trgm_ops
);

-- ─── PAYMENTS ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_payments_search_trgm
ON payments USING gin (
    normalize_search_text(
        COALESCE(reference, '')
    ) gin_trgm_ops
);
