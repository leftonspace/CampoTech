-- Seed Inflation Indices for Testing
-- Run with: prisma db execute --file scripts/seed-inflation.sql

-- Insert CAC ICC General indices for last 6 months
INSERT INTO "inflation_indices" ("id", "source", "period", "rate", "published_at", "scraped_at", "created_at")
VALUES 
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2026-01', 5.8, '2026-02-10', NOW(), NOW()),
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2025-12', 6.2, '2026-01-10', NOW(), NOW()),
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2025-11', 5.5, '2025-12-10', NOW(), NOW()),
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2025-10', 4.9, '2025-11-10', NOW(), NOW()),
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2025-09', 5.1, '2025-10-10', NOW(), NOW()),
    (gen_random_uuid(), 'CAC_ICC_GENERAL', '2025-08', 4.7, '2025-09-10', NOW(), NOW())
ON CONFLICT ("source", "period") DO UPDATE SET
    "rate" = EXCLUDED."rate",
    "published_at" = EXCLUDED."published_at",
    "scraped_at" = NOW();

-- Insert INDEC IPC indices for last 6 months
INSERT INTO "inflation_indices" ("id", "source", "period", "rate", "published_at", "scraped_at", "created_at")
VALUES 
    (gen_random_uuid(), 'INDEC_IPC', '2026-01', 4.2, '2026-02-15', NOW(), NOW()),
    (gen_random_uuid(), 'INDEC_IPC', '2025-12', 4.8, '2026-01-15', NOW(), NOW()),
    (gen_random_uuid(), 'INDEC_IPC', '2025-11', 4.0, '2025-12-15', NOW(), NOW()),
    (gen_random_uuid(), 'INDEC_IPC', '2025-10', 3.6, '2025-11-15', NOW(), NOW()),
    (gen_random_uuid(), 'INDEC_IPC', '2025-09', 3.9, '2025-10-15', NOW(), NOW()),
    (gen_random_uuid(), 'INDEC_IPC', '2025-08', 3.5, '2025-09-15', NOW(), NOW())
ON CONFLICT ("source", "period") DO UPDATE SET
    "rate" = EXCLUDED."rate",
    "published_at" = EXCLUDED."published_at",
    "scraped_at" = NOW();
