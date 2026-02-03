-- ═══════════════════════════════════════════════════════════════════════════════
-- FIX ACTIVE COUNT DEFINITION
-- "Activos" should exclude both CANCELLED and COMPLETED jobs
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update the v_jobs_counts view to fix active_count definition
CREATE OR REPLACE VIEW v_jobs_counts AS
SELECT 
    "organizationId" AS organization_id,
    COUNT(*) AS total_count,
    COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled_count,
    -- FIXED: active_count now excludes both CANCELLED and COMPLETED
    COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'COMPLETED')) AS active_count,
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

COMMENT ON VIEW v_jobs_counts IS 'Aggregated job counts by organization. active_count excludes CANCELLED and COMPLETED. Phase 1.2 fix';
