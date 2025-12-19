# CampoTech Database Partition Strategy

## Phase 5A.1 - Table Partitioning for Scale

**Version:** 1.0
**Target Scale:** 100,000 businesses / 500,000 users / 1M+ consumers
**Expected Data Volume:** 50-100 million rows within first year at scale

---

## Overview

PostgreSQL table partitioning splits large tables into smaller, more manageable pieces while maintaining a unified table interface. This dramatically improves query performance by enabling **partition pruning** - queries only scan relevant partitions instead of the entire table.

### Benefits

1. **Query Performance**: Queries with date filters only scan relevant partitions
2. **Maintenance**: VACUUM and index operations run on smaller tables
3. **Data Management**: Easy archival by detaching old partitions
4. **Parallel Operations**: PostgreSQL can parallelize queries across partitions

---

## Tables Requiring Partitioning

| Table | Current Est. Rows/Month | Partition Interval | Retention | Priority |
|-------|------------------------|-------------------|-----------|----------|
| `technician_location_history` | 50M+ (GPS every 30s) | Daily | 90 days | CRITICAL |
| `wa_messages` | 5M+ | Weekly | 1 year | HIGH |
| `jobs` | 500K+ | Monthly | 2 years | HIGH |
| `audit_logs` | 2M+ | Monthly | 3 years | MEDIUM |
| `notification_logs` | 3M+ | Weekly | 6 months | MEDIUM |

---

## Partition Strategies

### 1. Jobs Table - Monthly Partitions

**Rationale**: Jobs have a natural monthly lifecycle. Most queries filter by `scheduledDate` or `createdAt`.

```sql
-- Partition key: created_at
-- Partitions: 24 months ahead
-- Naming: jobs_y{YYYY}m{MM}

Example partitions:
- jobs_y2025m01 (2025-01-01 to 2025-02-01)
- jobs_y2025m02 (2025-02-01 to 2025-03-01)
- ...
```

**Indexes per partition**:
- `(organization_id, status)`
- `(organization_id, scheduled_date)`
- `(technician_id, status)`

### 2. WaMessage Table - Weekly Partitions

**Rationale**: WhatsApp messages have very high volume. Weekly partitions balance size and management overhead.

```sql
-- Partition key: created_at
-- Partitions: 52 weeks ahead
-- Naming: wa_msgs_{YYYY}w{WW}

Example partitions:
- wa_msgs_2025w01 (2025-01-01 to 2025-01-08)
- wa_msgs_2025w02 (2025-01-08 to 2025-01-15)
- ...
```

**Indexes per partition**:
- `(organization_id, created_at)`
- `(conversation_id, created_at)`

### 3. Technician Location History - Daily Partitions

**Rationale**: GPS pings every 30 seconds per active technician = highest volume table. Daily partitions essential for performance.

```sql
-- Partition key: recorded_at
-- Partitions: 90 days ahead
-- Naming: tech_loc_{YYYYMMDD}

Example partitions:
- tech_loc_20250101 (2025-01-01 to 2025-01-02)
- tech_loc_20250102 (2025-01-02 to 2025-01-03)
- ...
```

**Indexes per partition**:
- `(user_id, recorded_at)`
- `(job_id)`
- `(session_id)`

### 4. Audit Logs - Monthly Partitions

**Rationale**: Compliance requirement (3 years). Monthly partitions balance size and legal requirements.

```sql
-- Partition key: created_at
-- Partitions: 36 months ahead
-- Naming: audit_logs_y{YYYY}m{MM}
```

**Indexes per partition**:
- `(organization_id, created_at)`
- `(entity_type, entity_id)`

### 5. Notification Logs - Weekly Partitions

**Rationale**: High volume but short retention (6 months). Weekly for easy cleanup.

```sql
-- Partition key: created_at
-- Partitions: 26 weeks ahead
-- Naming: notif_logs_{YYYY}w{WW}
```

**Indexes per partition**:
- `(organization_id, created_at)`
- `(user_id, created_at)`

---

## Implementation Strategy

### Migration Approach

We use a **shadow table migration** strategy:

1. Create new partitioned table with `_partitioned` suffix
2. Create all future partitions
3. Create indexes on each partition
4. Migrate existing data in batches
5. Swap tables during maintenance window
6. Keep old table for rollback (1 week)
7. Drop old table after verification

### Partition Management

Automated cron job runs weekly:
- Creates partitions 3 months ahead for monthly tables
- Creates partitions 12 weeks ahead for weekly tables
- Creates partitions 90 days ahead for daily tables
- Alerts if partitions are missing for upcoming period

### Rollback Plan

If issues arise:
```sql
-- Swap back to original table
ALTER TABLE jobs RENAME TO jobs_partitioned_failed;
ALTER TABLE jobs_old RENAME TO jobs;
```

---

## Query Optimization

### Partition Pruning

For partition pruning to work, queries must include the partition key in WHERE clause:

```sql
-- GOOD: Partition pruning works
SELECT * FROM jobs
WHERE created_at >= '2025-06-01'
  AND organization_id = 'xxx';
-- Result: Scans only jobs_y2025m06

-- BAD: Scans all partitions
SELECT * FROM jobs
WHERE organization_id = 'xxx';
-- Result: Scans all 24 partitions
```

### Verify Partition Pruning

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM jobs
WHERE created_at >= '2025-06-01' AND created_at < '2025-07-01';

-- Look for: "Partitions removed: X"
-- Or: "Subplans Removed" in output
```

---

## Maintenance Procedures

### Adding New Partitions

```sql
-- Example: Add partition for January 2027
CREATE TABLE jobs_y2027m01 PARTITION OF jobs
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

-- Add indexes
CREATE INDEX idx_jobs_y2027m01_org_status
    ON jobs_y2027m01(organization_id, status);
```

### Archiving Old Partitions

```sql
-- 1. Detach partition (table still accessible)
ALTER TABLE jobs DETACH PARTITION jobs_y2023m01;

-- 2. Export to storage
COPY jobs_y2023m01 TO '/tmp/jobs_2023_01.csv' CSV HEADER;

-- 3. After verification, drop partition
DROP TABLE jobs_y2023m01;
```

### Checking Partition Health

```sql
-- List all partitions for a table
SELECT
    inhrelid::regclass AS partition_name,
    pg_size_pretty(pg_relation_size(inhrelid)) AS size
FROM pg_inherits
WHERE inhparent = 'jobs'::regclass
ORDER BY inhrelid::regclass::text;
```

---

## File Reference

| File | Purpose |
|------|---------|
| `prisma/migrations/YYYYMMDD_partition_jobs/migration.sql` | Jobs table partitioning |
| `prisma/migrations/YYYYMMDD_partition_wa_messages/migration.sql` | WaMessage partitioning |
| `prisma/migrations/YYYYMMDD_partition_tech_locations/migration.sql` | Location history partitioning |
| `lib/jobs/partition-manager.ts` | Automatic partition creation |
| `app/api/cron/manage-partitions/route.ts` | Cron endpoint |

---

## Monitoring

### Key Metrics

1. **Partition count per table** - Alert if approaching PostgreSQL limits
2. **Partition sizes** - Monitor for uneven distribution
3. **Query plans** - Verify partition pruning is working
4. **Missing partitions** - Alert before gaps cause failures

### Alerting Thresholds

- Partition missing for next 7 days: WARNING
- Partition missing for next 3 days: CRITICAL
- Partition size > 10GB: WARNING (consider splitting)

---

*Document Version: 1.0*
*Phase: 5A.1*
*Last Updated: 2025-12-19*
