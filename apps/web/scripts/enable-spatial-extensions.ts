/**
 * Enable PostgreSQL spatial extensions for marketplace geo-queries.
 * 
 * Run once: npx -y tsx scripts/enable-spatial-extensions.ts
 * 
 * This enables:
 * - cube: N-dimensional cube data type (required by earthdistance)
 * - earthdistance: Fast great-circle distance calculations using lat/lng
 * 
 * These are built-in Postgres extensions (available on Supabase).
 * No PostGIS needed — earthdistance is lighter and sufficient for our use case.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Enabling spatial extensions...\n');

    // 1. Enable cube (dependency of earthdistance)
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS cube');
    console.log('  ✅ cube extension enabled');

    // 2. Enable earthdistance
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS earthdistance');
    console.log('  ✅ earthdistance extension enabled');

    // 3. Create composite index on technician_locations for spatial queries
    //    This covers (isOnline, lastSeen, latitude, longitude) for our marketplace query
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_technician_locations_spatial
        ON technician_locations ("isOnline", "lastSeen", latitude, longitude)
    `);
    console.log('  ✅ Spatial composite index created on technician_locations');

    // 4. Create index on employee_schedules for availability lookups
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_employee_schedules_availability
        ON employee_schedules ("userId", "dayOfWeek", "isAvailable")
    `);
    console.log('  ✅ Schedule availability index created');

    // 5. Create index on schedule_exceptions for date lookups
    await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_schedule_exceptions_date_avail
        ON schedule_exceptions ("userId", date, "isAvailable")
    `);
    console.log('  ✅ Schedule exception index created');

    // Verify extensions
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname IN ('cube', 'earthdistance') ORDER BY extname
    `;
    console.log('\n📦 Installed extensions:', extensions.map(e => e.extname).join(', '));

    // Test earthdistance function
    const test = await prisma.$queryRaw<Array<{ distance_km: number }>>`
        SELECT (earth_distance(
            ll_to_earth(-34.5795, -58.4195),
            ll_to_earth(-34.6037, -58.3816)
        ) / 1000)::numeric(10,2) AS distance_km
    `;
    console.log(`\n🧪 Test: Palermo → Microcentro = ${test[0].distance_km} km`);

    console.log('\n✅ All spatial extensions ready!');
    await prisma.$disconnect();
}

main().catch(e => {
    console.error('ERROR:', e);
    process.exit(1);
});
