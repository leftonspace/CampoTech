/**
 * Fix Customer Coordinates
 * =========================
 * 
 * Migrates customer addresses from the old format:
 *   { latitude: number, longitude: number }
 * 
 * To the new format expected by the map API:
 *   { coordinates: { lat: number, lng: number } }
 * 
 * Run with: npx tsx scripts/fix-customer-coordinates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface OldAddressFormat {
    street?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    neighborhood?: string;
    postalCode?: string;
    latitude?: number;
    longitude?: number;
    propertyType?: string;
    businessType?: string;
    [key: string]: unknown;
}

interface NewAddressFormat {
    street?: string;
    floor?: string;
    apartment?: string;
    city?: string;
    neighborhood?: string;
    postalCode?: string;
    coordinates?: { lat: number; lng: number };
    propertyType?: string;
    businessType?: string;
    [key: string]: unknown;
}

async function main() {
    console.log('🔧 Fixing Customer Coordinates...\n');

    // Get all customers
    const customers = await prisma.customer.findMany({
        select: {
            id: true,
            name: true,
            address: true,
        },
    });

    console.log(`📊 Found ${customers.length} customers to check\n`);

    let fixedFormatCount = 0;
    let fixedOceanCount = 0;
    let alreadyCorrectCount = 0;
    let noCoordinatesCount = 0;

    // Buenos Aires boundaries (approximate land area)
    const BA_OCEAN_BOUNDARY_LNG = -58.33; // East of this is ocean (Río de la Plata)
    const BA_WEST_OFFSET = 0.15; // How much to shift ocean coordinates westward

    for (const customer of customers) {
        const address = customer.address as OldAddressFormat | null;

        if (!address) {
            noCoordinatesCount++;
            continue;
        }

        let needsUpdate = false;
        let newAddress: NewAddressFormat = { ...address };

        // Check if already in new format with coordinates object
        if (address.coordinates && typeof address.coordinates === 'object') {
            const coords = address.coordinates as { lat?: number; lng?: number };

            // Check if coordinates are in the ocean
            if (typeof coords.lng === 'number' && coords.lng > BA_OCEAN_BOUNDARY_LNG) {
                // Shift westward into land
                newAddress.coordinates = {
                    lat: coords.lat ?? -34.6,
                    lng: coords.lng - BA_WEST_OFFSET,
                };
                needsUpdate = true;
                console.log(`   🌊→🏙️ Fixed ocean coords: ${customer.name} (lng: ${coords.lng.toFixed(4)} → ${(coords.lng - BA_WEST_OFFSET).toFixed(4)})`);
                fixedOceanCount++;
            } else {
                alreadyCorrectCount++;
            }
        }
        // Check if has old format latitude/longitude
        else if (typeof address.latitude === 'number' && typeof address.longitude === 'number') {
            let lat = address.latitude;
            let lng = address.longitude;

            // Check if in ocean
            if (lng > BA_OCEAN_BOUNDARY_LNG) {
                lng = lng - BA_WEST_OFFSET;
                console.log(`   🌊→🏙️ Fixed ocean + format: ${customer.name}`);
                fixedOceanCount++;
            } else {
                console.log(`   ✅ Fixed format: ${customer.name}`);
            }

            newAddress = {
                ...address,
                coordinates: { lat, lng },
            };

            // Remove old fields
            delete (newAddress as Record<string, unknown>).latitude;
            delete (newAddress as Record<string, unknown>).longitude;

            needsUpdate = true;
            fixedFormatCount++;
        } else {
            noCoordinatesCount++;
        }

        if (needsUpdate) {
            await prisma.customer.update({
                where: { id: customer.id },
                data: { address: newAddress },
            });
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 COORDINATE FIX COMPLETED!');
    console.log('═'.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   ├─ Fixed Format: ${fixedFormatCount}`);
    console.log(`   ├─ Fixed Ocean Coords: ${fixedOceanCount}`);
    console.log(`   ├─ Already Correct: ${alreadyCorrectCount}`);
    console.log(`   └─ No Coordinates: ${noCoordinatesCount}`);
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
