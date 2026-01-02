import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// Full Sync "pull" endpoint
// Mobile device sends its lastPulledAt timestamp
// Server returns all changes since that time

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const lastPulledAtRaw = searchParams.get('last_pulled_at');
        const schemaVersion = searchParams.get('schema_version');
        const migration = searchParams.get('migration');

        // Default to epoch if first sync
        const lastPulledAt = lastPulledAtRaw && lastPulledAtRaw !== 'null'
            ? parseInt(lastPulledAtRaw)
            : 0;

        const lastPulledDate = new Date(lastPulledAt);

        // Get current user (Organization/Technician context)
        // const user = await getCurrentUser(req);
        // if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const organizationId = 'demo-org-id'; // MOCK for this snippet

        // Fetch changes from Core Tables
        // In a real WatermelonDB backend, we tracks "deleted" records via a Deleted table

        const [jobs, customers, products] = await Promise.all([
            // 1. Jobs changed/created since last pull
            prisma.job.findMany({
                where: {
                    organizationId,
                    updatedAt: { gt: lastPulledDate }
                }
            }),
            // 2. Customers changed
            prisma.customer.findMany({
                where: {
                    organizationId,
                    updatedAt: { gt: lastPulledDate }
                }
            }),
            // 3. Inventory changed
            prisma.product.findMany({
                where: {
                    organizationId,
                    updatedAt: { gt: lastPulledDate }
                }
            })
        ]);

        // Construct WatermelonDB compatible response
        // { changes: { [table_name]: { created: [], updated: [], deleted: [] } }, timestamp: number }

        // Simplification: WatermelonDB treats 'created' and 'updated' similarly in some modes, 
        // but strict mode requires separating them. Here we just send 'updated' for simplicity 
        // unless we track creation time explicitly vs lastPulledAt.

        const changes = {
            jobs: {
                created: jobs.filter((j: typeof jobs[number]) => j.createdAt > lastPulledDate),
                updated: jobs.filter((j: typeof jobs[number]) => j.createdAt <= lastPulledDate),
                deleted: [] // TODO: Implement Deleted table tracking
            },
            customers: {
                created: customers.filter((c: typeof customers[number]) => c.createdAt > lastPulledDate),
                updated: customers.filter((c: typeof customers[number]) => c.createdAt <= lastPulledDate),
                deleted: []
            },
            products: {
                created: products.filter((p: typeof products[number]) => p.createdAt > lastPulledDate),
                updated: products.filter((p: typeof products[number]) => p.createdAt <= lastPulledDate),
                deleted: []
            }
        };

        return NextResponse.json({
            changes,
            timestamp: Date.now() // New "lastPulledAt" for client
        });

    } catch (error) {
        console.error('Sync Pull Error:', error);
        return NextResponse.json({ error: 'Sync Error' }, { status: 500 });
    }
}

// Full Sync "push" endpoint
// Mobile device sends a batch of changes to apply
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { changes, lastPulledAt } = body;

        // changes object looks like: { jobs: { created: [], updated: [], deleted: [] }, ... }

        await prisma.$transaction(async (tx) => {
            // Processing Jobs
            if (changes.jobs) {
                // Creates
                for (const job of changes.jobs.created) {
                    // Conflict/Idempotency check: does ID exist?
                    const exists = await tx.job.findUnique({ where: { id: job.id } });
                    if (!exists) {
                        await tx.job.create({ data: job });
                    }
                }
                // Updates
                for (const job of changes.jobs.updated) {
                    // Basic "Last Write Wins" or more complex conflict logic
                    // Real implementation verifies server version hasn't changed
                    await tx.job.update({
                        where: { id: job.id },
                        data: job
                    });
                }
                // Deletes
                for (const id of changes.jobs.deleted) {
                    await tx.job.delete({ where: { id } });
                }
            }

            // ... Similar logic for customers, inventory ...
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Sync Push Error:', error);
        // Return 409 Conflict if specific conflict detection fails
        return NextResponse.json({ error: 'Sync Push Failed' }, { status: 500 });
    }
}
