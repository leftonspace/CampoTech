-- ═══════════════════════════════════════════════════════════════════════════════
-- CampoTech Analytics - Materialized Views
-- Phase 10.1: Analytics Data Infrastructure
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- These views provide pre-aggregated data for common analytics queries.
-- They should be refreshed periodically (e.g., every hour for real-time,
-- daily for historical) based on business requirements.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════════
-- DIMENSION TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Time Dimension (pre-populated with dates)
CREATE TABLE IF NOT EXISTS analytics_dim_time (
    date_key DATE PRIMARY KEY,
    day_of_week INT NOT NULL,           -- 0=Sunday, 6=Saturday
    day_of_month INT NOT NULL,
    day_of_year INT NOT NULL,
    week_of_year INT NOT NULL,
    month INT NOT NULL,
    quarter INT NOT NULL,
    year INT NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(100),
    fiscal_quarter INT NOT NULL,
    fiscal_year INT NOT NULL
);

-- Populate time dimension for 5 years (if empty)
INSERT INTO analytics_dim_time (
    date_key, day_of_week, day_of_month, day_of_year, week_of_year,
    month, quarter, year, is_weekend, fiscal_quarter, fiscal_year
)
SELECT
    d::date,
    EXTRACT(DOW FROM d),
    EXTRACT(DAY FROM d),
    EXTRACT(DOY FROM d),
    EXTRACT(WEEK FROM d),
    EXTRACT(MONTH FROM d),
    EXTRACT(QUARTER FROM d),
    EXTRACT(YEAR FROM d),
    EXTRACT(DOW FROM d) IN (0, 6),
    EXTRACT(QUARTER FROM d),
    EXTRACT(YEAR FROM d)
FROM generate_series('2020-01-01'::date, '2030-12-31'::date, '1 day'::interval) d
ON CONFLICT (date_key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- FACT TABLES (Analytics-optimized copies)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Jobs Fact Table
CREATE TABLE IF NOT EXISTS analytics_fact_jobs (
    id VARCHAR(50) PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    job_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    technician_id VARCHAR(50),
    service_type VARCHAR(50) NOT NULL,
    location_id VARCHAR(50),

    -- Time dimensions
    created_date DATE NOT NULL,
    scheduled_date DATE,
    started_date DATE,
    completed_date DATE,

    -- Measures
    status VARCHAR(20) NOT NULL,
    duration_minutes INT,
    travel_time_minutes INT,
    estimated_amount DECIMAL(10, 2),
    actual_amount DECIMAL(10, 2),

    -- Flags
    is_first_time_customer BOOLEAN DEFAULT FALSE,
    is_repeat_job BOOLEAN DEFAULT FALSE,
    satisfaction_score DECIMAL(3, 2),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_jobs_org ON analytics_fact_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_fact_jobs_created ON analytics_fact_jobs(created_date);
CREATE INDEX IF NOT EXISTS idx_fact_jobs_status ON analytics_fact_jobs(status);
CREATE INDEX IF NOT EXISTS idx_fact_jobs_tech ON analytics_fact_jobs(technician_id);

-- Invoices Fact Table
CREATE TABLE IF NOT EXISTS analytics_fact_invoices (
    id VARCHAR(50) PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    invoice_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,
    job_id VARCHAR(50),

    -- Type
    invoice_type CHAR(1) NOT NULL,

    -- Time dimensions
    created_date DATE NOT NULL,
    due_date DATE,
    paid_date DATE,

    -- Measures
    subtotal DECIMAL(10, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL,
    days_to_payment INT,
    payment_method VARCHAR(50),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_invoices_org ON analytics_fact_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_fact_invoices_created ON analytics_fact_invoices(created_date);
CREATE INDEX IF NOT EXISTS idx_fact_invoices_status ON analytics_fact_invoices(status);

-- Payments Fact Table
CREATE TABLE IF NOT EXISTS analytics_fact_payments (
    id VARCHAR(50) PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    payment_id VARCHAR(50) NOT NULL,
    invoice_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50) NOT NULL,

    -- Time dimensions
    received_date DATE NOT NULL,

    -- Measures
    amount DECIMAL(10, 2) NOT NULL,
    processing_fee DECIMAL(10, 2) DEFAULT 0,
    net_amount DECIMAL(10, 2) NOT NULL,

    -- Type
    method VARCHAR(50) NOT NULL,

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_payments_org ON analytics_fact_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_fact_payments_received ON analytics_fact_payments(received_date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Daily Aggregations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Daily Revenue Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue AS
SELECT
    organization_id,
    created_date AS date,
    COUNT(*) AS invoice_count,
    SUM(subtotal) AS subtotal,
    SUM(tax_amount) AS tax_amount,
    SUM(total) AS total_revenue,
    AVG(total) AS avg_invoice_value,
    SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) AS collected_revenue,
    COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paid_count,
    COUNT(CASE WHEN status = 'OVERDUE' THEN 1 END) AS overdue_count
FROM analytics_fact_invoices
GROUP BY organization_id, created_date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_revenue ON mv_daily_revenue(organization_id, date);

-- Daily Jobs Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_jobs AS
SELECT
    organization_id,
    created_date AS date,
    COUNT(*) AS total_jobs,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_jobs,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_jobs,
    AVG(duration_minutes) AS avg_duration_minutes,
    SUM(actual_amount) AS total_job_value,
    AVG(actual_amount) AS avg_job_value,
    COUNT(DISTINCT technician_id) AS active_technicians,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM analytics_fact_jobs
GROUP BY organization_id, created_date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_jobs ON mv_daily_jobs(organization_id, date);

-- Daily Payments Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_payments AS
SELECT
    organization_id,
    received_date AS date,
    COUNT(*) AS payment_count,
    SUM(amount) AS total_collected,
    SUM(processing_fee) AS total_fees,
    SUM(net_amount) AS net_collected,
    AVG(amount) AS avg_payment_amount,
    COUNT(DISTINCT method) AS payment_methods_used,
    COUNT(DISTINCT customer_id) AS paying_customers
FROM analytics_fact_payments
GROUP BY organization_id, received_date
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_payments ON mv_daily_payments(organization_id, date);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Weekly Aggregations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Weekly Revenue Trend
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_revenue AS
SELECT
    organization_id,
    DATE_TRUNC('week', created_date)::date AS week_start,
    COUNT(*) AS invoice_count,
    SUM(total) AS total_revenue,
    AVG(total) AS avg_invoice_value,
    SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) AS collected_revenue,
    COUNT(DISTINCT customer_id) AS unique_customers
FROM analytics_fact_invoices
GROUP BY organization_id, DATE_TRUNC('week', created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_revenue ON mv_weekly_revenue(organization_id, week_start);

-- Weekly Jobs Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_weekly_jobs AS
SELECT
    organization_id,
    DATE_TRUNC('week', created_date)::date AS week_start,
    COUNT(*) AS total_jobs,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_jobs,
    ROUND(COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate,
    AVG(duration_minutes) AS avg_duration_minutes,
    COUNT(DISTINCT technician_id) AS active_technicians,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT technician_id), 0), 2) AS jobs_per_technician
FROM analytics_fact_jobs
GROUP BY organization_id, DATE_TRUNC('week', created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_weekly_jobs ON mv_weekly_jobs(organization_id, week_start);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Monthly Aggregations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Monthly Financial Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_financial AS
SELECT
    organization_id,
    DATE_TRUNC('month', created_date)::date AS month_start,
    EXTRACT(YEAR FROM created_date) AS year,
    EXTRACT(MONTH FROM created_date) AS month,

    -- Revenue metrics
    SUM(total) AS total_revenue,
    SUM(CASE WHEN status = 'PAID' THEN total ELSE 0 END) AS collected_revenue,
    SUM(CASE WHEN status IN ('PENDING', 'SENT') THEN total ELSE 0 END) AS pending_revenue,
    SUM(CASE WHEN status = 'OVERDUE' THEN total ELSE 0 END) AS overdue_revenue,

    -- Invoice metrics
    COUNT(*) AS total_invoices,
    COUNT(CASE WHEN status = 'PAID' THEN 1 END) AS paid_invoices,
    AVG(days_to_payment) FILTER (WHERE days_to_payment IS NOT NULL) AS avg_days_to_payment,

    -- Customer metrics
    COUNT(DISTINCT customer_id) AS unique_customers

FROM analytics_fact_invoices
GROUP BY organization_id, DATE_TRUNC('month', created_date), EXTRACT(YEAR FROM created_date), EXTRACT(MONTH FROM created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_financial ON mv_monthly_financial(organization_id, month_start);

-- Monthly Operations Summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_monthly_operations AS
SELECT
    organization_id,
    DATE_TRUNC('month', created_date)::date AS month_start,

    -- Job counts
    COUNT(*) AS total_jobs,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_jobs,
    COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) AS cancelled_jobs,

    -- Rates
    ROUND(COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate,
    ROUND(COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS cancellation_rate,

    -- Efficiency
    AVG(duration_minutes) AS avg_duration_minutes,

    -- Value
    SUM(actual_amount) AS total_job_value,
    AVG(actual_amount) AS avg_job_value,

    -- Resources
    COUNT(DISTINCT technician_id) AS active_technicians,
    COUNT(DISTINCT customer_id) AS served_customers

FROM analytics_fact_jobs
GROUP BY organization_id, DATE_TRUNC('month', created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_monthly_operations ON mv_monthly_operations(organization_id, month_start);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Service Type Analysis
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_service_type_analysis AS
SELECT
    organization_id,
    service_type,
    DATE_TRUNC('month', created_date)::date AS month_start,

    -- Volume
    COUNT(*) AS job_count,

    -- Revenue
    SUM(actual_amount) AS total_revenue,
    AVG(actual_amount) AS avg_revenue,

    -- Duration
    AVG(duration_minutes) AS avg_duration_minutes,

    -- Quality
    ROUND(COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate,
    AVG(satisfaction_score) AS avg_satisfaction

FROM analytics_fact_jobs
GROUP BY organization_id, service_type, DATE_TRUNC('month', created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_service_type ON mv_service_type_analysis(organization_id, service_type, month_start);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Technician Performance
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_technician_performance AS
SELECT
    organization_id,
    technician_id,
    DATE_TRUNC('month', created_date)::date AS month_start,

    -- Volume
    COUNT(*) AS total_jobs,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS completed_jobs,

    -- Efficiency
    ROUND(COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 2) AS completion_rate,
    AVG(duration_minutes) AS avg_duration_minutes,

    -- Revenue
    SUM(actual_amount) AS total_revenue,
    AVG(actual_amount) AS avg_revenue_per_job,

    -- Customer satisfaction
    AVG(satisfaction_score) AS avg_satisfaction,

    -- Working days (approximate)
    COUNT(DISTINCT created_date) AS active_days,
    ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT created_date), 0), 2) AS jobs_per_day

FROM analytics_fact_jobs
WHERE technician_id IS NOT NULL
GROUP BY organization_id, technician_id, DATE_TRUNC('month', created_date)
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_tech_perf ON mv_technician_performance(organization_id, technician_id, month_start);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MATERIALIZED VIEWS - Customer Segments
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_customer_segments AS
SELECT
    organization_id,
    customer_id,

    -- Activity metrics
    COUNT(DISTINCT job_id) AS total_jobs,
    MIN(created_date) AS first_job_date,
    MAX(created_date) AS last_job_date,

    -- Value metrics
    SUM(actual_amount) AS total_revenue,
    AVG(actual_amount) AS avg_job_value,

    -- Recency (days since last job)
    CURRENT_DATE - MAX(created_date) AS days_since_last_job,

    -- Frequency (average days between jobs)
    CASE
        WHEN COUNT(*) > 1 THEN (MAX(created_date) - MIN(created_date))::numeric / (COUNT(*) - 1)
        ELSE NULL
    END AS avg_days_between_jobs,

    -- Segment calculation
    CASE
        WHEN COUNT(*) = 0 THEN 'new'
        WHEN MAX(created_date) < CURRENT_DATE - INTERVAL '90 days' THEN 'churned'
        WHEN MAX(created_date) < CURRENT_DATE - INTERVAL '30 days' THEN 'at_risk'
        WHEN COUNT(*) >= 5 THEN 'loyal'
        ELSE 'active'
    END AS segment

FROM analytics_fact_jobs
GROUP BY organization_id, customer_id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_customer_segments ON mv_customer_segments(organization_id, customer_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AGGREGATED METRICS TABLE (for time-series storage)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_aggregated_metrics (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    period VARCHAR(20) NOT NULL,          -- YYYY-MM-DD, YYYY-Www, YYYY-MM
    granularity VARCHAR(20) NOT NULL,      -- hour, day, week, month
    value DECIMAL(20, 4) NOT NULL,
    count INT DEFAULT 1,
    min_value DECIMAL(20, 4),
    max_value DECIMAL(20, 4),
    avg_value DECIMAL(20, 4),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    UNIQUE(organization_id, metric_name, period, granularity)
);

CREATE INDEX IF NOT EXISTS idx_agg_metrics_org ON analytics_aggregated_metrics(organization_id);
CREATE INDEX IF NOT EXISTS idx_agg_metrics_period ON analytics_aggregated_metrics(period);
CREATE INDEX IF NOT EXISTS idx_agg_metrics_name ON analytics_aggregated_metrics(metric_name);

-- ═══════════════════════════════════════════════════════════════════════════════
-- REFRESH FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to refresh all daily materialized views
CREATE OR REPLACE FUNCTION refresh_daily_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_jobs;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_payments;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all weekly materialized views
CREATE OR REPLACE FUNCTION refresh_weekly_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_revenue;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_weekly_jobs;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all monthly materialized views
CREATE OR REPLACE FUNCTION refresh_monthly_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_financial;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_operations;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_service_type_analysis;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_technician_performance;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_customer_segments;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all views
CREATE OR REPLACE FUNCTION refresh_all_analytics_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_daily_views();
    PERFORM refresh_weekly_views();
    PERFORM refresh_monthly_views();
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA RETENTION POLICY
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to clean up old data based on retention policies
CREATE OR REPLACE FUNCTION cleanup_old_analytics_data()
RETURNS void AS $$
BEGIN
    -- Delete raw facts older than 90 days (keep aggregated data)
    DELETE FROM analytics_fact_jobs WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM analytics_fact_invoices WHERE created_at < NOW() - INTERVAL '90 days';
    DELETE FROM analytics_fact_payments WHERE created_at < NOW() - INTERVAL '90 days';

    -- Delete hourly aggregations older than 1 year
    DELETE FROM analytics_aggregated_metrics
    WHERE granularity = 'hour' AND created_at < NOW() - INTERVAL '1 year';

    -- Keep daily aggregations for 3 years
    DELETE FROM analytics_aggregated_metrics
    WHERE granularity = 'day' AND created_at < NOW() - INTERVAL '3 years';

    -- Keep weekly and monthly aggregations indefinitely (or 5 years)
    DELETE FROM analytics_aggregated_metrics
    WHERE granularity IN ('week', 'month') AND created_at < NOW() - INTERVAL '5 years';
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ANALYTICS EVENTS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    organization_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id VARCHAR(50),
    event_data JSONB,
    user_id VARCHAR(50),
    session_id VARCHAR(100),
    timestamp TIMESTAMP DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org ON analytics_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_ts ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_processed ON analytics_events(processed) WHERE NOT processed;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMENTS
-- ═══════════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE analytics_fact_jobs IS 'Denormalized job facts for analytics queries';
COMMENT ON TABLE analytics_fact_invoices IS 'Denormalized invoice facts for analytics queries';
COMMENT ON TABLE analytics_fact_payments IS 'Denormalized payment facts for analytics queries';
COMMENT ON TABLE analytics_dim_time IS 'Time dimension for date-based analytics';
COMMENT ON TABLE analytics_aggregated_metrics IS 'Pre-aggregated metrics for time-series queries';
COMMENT ON TABLE analytics_events IS 'Raw analytics events for processing';

COMMENT ON MATERIALIZED VIEW mv_daily_revenue IS 'Daily revenue aggregations - refresh hourly';
COMMENT ON MATERIALIZED VIEW mv_daily_jobs IS 'Daily job aggregations - refresh hourly';
COMMENT ON MATERIALIZED VIEW mv_weekly_revenue IS 'Weekly revenue trends - refresh daily';
COMMENT ON MATERIALIZED VIEW mv_monthly_financial IS 'Monthly financial summary - refresh daily';
