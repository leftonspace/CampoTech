/**
 * Quick test: Verify the spatial query works with simulation data.
 * Tests the exact SQL query used by the optimized marketplace API.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
    // Consumer location: Microcentro, Buenos Aires
    const lat = -34.6055;
    const lng = -58.3775;
    const PREFILTER_RADIUS_METERS = 100_000; // 100km
    const ONLINE_THRESHOLD_MINUTES = 480; // 8h for testing with seeded data

    // Current BA time
    const now = new Date();
    const buenosAiresOffset = -3;
    const buenosAiresHour = (now.getUTCHours() + buenosAiresOffset + 24) % 24;
    const buenosAiresMinutes = now.getUTCMinutes();
    const currentTimeStr = `${String(buenosAiresHour).padStart(2, '0')}:${String(buenosAiresMinutes).padStart(2, '0')}`;
    const buenosAiresDay = new Date(now.getTime() + buenosAiresOffset * 3600000).getDay();
    const todayDateStr = new Date(now.getTime() + buenosAiresOffset * 3600000)
        .toISOString()
        .split('T')[0];

    console.log(`🕐 BA Time: ${currentTimeStr} | Day: ${buenosAiresDay} | Date: ${todayDateStr}`);
    console.log(`📍 Search from: Microcentro (${lat}, ${lng})`);
    console.log(`📏 Radius: ${PREFILTER_RADIUS_METERS / 1000} km\n`);

    const startTime = performance.now();

    const results = await prisma.$queryRaw<Array<{
        org_id: string;
        tech_user_id: string;
        tech_lat: number;
        tech_lng: number;
        tech_specialty: string | null;
        tech_specialties: string[];
        tech_is_online: boolean;
        distance_km: number;
    }>>`
        WITH available_techs AS (
            SELECT
                u.id AS tech_user_id,
                u."organizationId" AS org_id,
                u.specialty AS tech_specialty,
                u.specialties AS tech_specialties,
                tl.latitude::float8 AS tech_lat,
                tl.longitude::float8 AS tech_lng,
                tl."isOnline" AS tech_is_online,
                (earth_distance(
                    ll_to_earth(${lat}::float8, ${lng}::float8),
                    ll_to_earth(tl.latitude::float8, tl.longitude::float8)
                ) / 1000.0) AS distance_km
            FROM users u
            INNER JOIN technician_locations tl 
                ON tl."userId" = u.id
            INNER JOIN organizations o 
                ON o.id = u."organizationId"
            INNER JOIN business_public_profiles bpp 
                ON bpp."organizationId" = o.id
            WHERE
                o.marketplace_visible = true
                AND o.can_receive_jobs = true
                AND bpp."isActive" = true
                AND u."isActive" = true
                AND u."can_be_assigned_jobs" = true
                AND u.role::text IN ('OWNER', 'ADMIN', 'TECHNICIAN')
                AND tl."lastSeen" >= NOW() - INTERVAL '${Prisma.raw(String(ONLINE_THRESHOLD_MINUTES))} minutes'
                AND earth_distance(
                    ll_to_earth(${lat}::float8, ${lng}::float8),
                    ll_to_earth(tl.latitude::float8, tl.longitude::float8)
                ) < ${PREFILTER_RADIUS_METERS}::float8
                -- Schedule check: NOT on vacation today
                AND NOT EXISTS (
                    SELECT 1 FROM schedule_exceptions se
                    WHERE se."userId" = u.id
                    AND se.date = ${todayDateStr}::date
                    AND se."isAvailable" = false
                    AND (
                        se."startTime" IS NULL
                        OR (
                            se."startTime" <= ${currentTimeStr}
                            AND se."endTime" >= ${currentTimeStr}
                        )
                    )
                )
                -- Schedule check: is this tech scheduled to work right now?
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM employee_schedules es2
                        WHERE es2."userId" = u.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM employee_schedules es
                        WHERE es."userId" = u.id
                        AND es."dayOfWeek" = ${buenosAiresDay}
                        AND es."isAvailable" = true
                        AND es."startTime" <= ${currentTimeStr}
                        AND es."endTime" >= ${currentTimeStr}
                    )
                )
        )
        SELECT DISTINCT ON (org_id)
            org_id,
            tech_user_id,
            tech_lat,
            tech_lng,
            tech_specialty,
            tech_specialties,
            tech_is_online,
            distance_km
        FROM available_techs
        ORDER BY org_id, distance_km ASC
    `;

    const queryTime = Math.round(performance.now() - startTime);

    // Sort by distance
    results.sort((a, b) => a.distance_km - b.distance_km);

    console.log(`⚡ Query took: ${queryTime}ms`);
    console.log(`📊 Found: ${results.length} organizations with available techs\n`);

    console.log('┌─────┬──────────────────────────────────────────┬──────────────┬──────────┐');
    console.log('│  #  │ Org ID                                   │ Distance     │ Specialty│');
    console.log('├─────┼──────────────────────────────────────────┼──────────────┼──────────┤');

    results.forEach((r, i) => {
        const orgShort = r.org_id.replace('sim-maps-org-', '').substring(0, 35).padEnd(35);
        const dist = `${r.distance_km.toFixed(1)} km`.padEnd(12);
        const spec = (r.tech_specialty || 'N/A').padEnd(8);
        console.log(`│ ${String(i + 1).padStart(2)}  │ ${orgShort}    │ ${dist} │ ${spec} │`);
    });

    console.log('└─────┴──────────────────────────────────────────┴──────────────┴──────────┘');

    await prisma.$disconnect();
}

test().catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
});
