/**
 * Phase 6.1: WhatsApp Number Inventory Admin API
 * 
 * GET - Get inventory statistics and list numbers
 * POST - Provision new number(s)
 */

import { NextRequest, NextResponse } from 'next/server';
import { numberInventoryService, ProvisionNumberParams } from '@/lib/services/number-inventory.service';
import { getSession, type TokenPayload } from '@/lib/auth';

// Local type matching Prisma schema enum (until prisma generate is run)
type NumberInventoryStatus = 'available' | 'reserved' | 'assigned' | 'suspended' | 'released';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function requireAdmin(): Promise<{ user: TokenPayload } | NextResponse> {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const roleUpper = session.role?.toUpperCase();
        if (roleUpper !== 'OWNER') {
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        return { user: session };
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Get inventory stats and/or list numbers
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'list';

        if (action === 'stats') {
            // Get inventory statistics
            const stats = await numberInventoryService.getStats();
            return NextResponse.json({ success: true, stats });
        }

        if (action === 'list') {
            // List numbers with filters
            const page = parseInt(searchParams.get('page') || '1', 10);
            const limit = parseInt(searchParams.get('limit') || '50', 10);

            const filters = {
                status: searchParams.get('status') as NumberInventoryStatus | undefined,
                bspProvider: searchParams.get('bspProvider') as 'twilio' | 'dialog360' | 'meta_direct' | undefined,
                countryCode: searchParams.get('countryCode') || undefined,
                assignedToOrgId: searchParams.get('orgId') || undefined,
                inactiveForDays: searchParams.get('inactiveDays')
                    ? parseInt(searchParams.get('inactiveDays')!, 10)
                    : undefined,
            };

            const result = await numberInventoryService.getNumbers(filters, page, limit);
            return NextResponse.json({ success: true, ...result });
        }

        if (action === 'inactive') {
            // Get list of inactive numbers (candidates for auto-release)
            const days = parseInt(searchParams.get('days') || '30', 10);
            const inactiveIds = await numberInventoryService.findInactiveNumbers(days);
            return NextResponse.json({
                success: true,
                inactiveCount: inactiveIds.length,
                numberIds: inactiveIds,
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('[NumberInventory API] GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Provision new number(s)
// ═══════════════════════════════════════════════════════════════════════════════

interface ProvisionRequest {
    action: 'provision' | 'bulk_provision' | 'assign' | 'reserve' | 'release' | 'auto_release' | 'recycle';
    number?: ProvisionNumberParams;
    numbers?: ProvisionNumberParams[];
    orgId?: string;
    countryCode?: string;
    numberId?: string;
    releaseReason?: 'inactivity' | 'cancellation' | 'suspension' | 'manual';
}

export async function POST(request: NextRequest) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const body: ProvisionRequest = await request.json();

        switch (body.action) {
            case 'provision': {
                // Provision a single number
                if (!body.number) {
                    return NextResponse.json({ error: 'Number data required' }, { status: 400 });
                }
                const numberId = await numberInventoryService.provisionNumber(body.number);
                return NextResponse.json({
                    success: true,
                    numberId,
                    message: `Number ${body.number.phoneNumber} provisioned successfully`,
                });
            }

            case 'bulk_provision': {
                // Bulk provision multiple numbers
                if (!body.numbers || !Array.isArray(body.numbers)) {
                    return NextResponse.json({ error: 'Numbers array required' }, { status: 400 });
                }
                const result = await numberInventoryService.bulkProvisionNumbers(body.numbers);
                return NextResponse.json({
                    success: true,
                    ...result,
                    message: `Provisioned ${result.successful}/${result.total} numbers`,
                });
            }

            case 'assign': {
                // Instant assign a number to an org
                if (!body.orgId) {
                    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
                }
                const result = await numberInventoryService.instantAssign(
                    body.orgId,
                    body.countryCode || 'AR'
                );
                if (!result.success) {
                    return NextResponse.json({ error: result.error }, { status: 400 });
                }
                return NextResponse.json({
                    success: true,
                    number: result.number,
                    message: `Number ${result.number?.phoneNumber} assigned to organization`,
                });
            }

            case 'reserve': {
                // Reserve a number for an org
                if (!body.orgId) {
                    return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
                }
                const result = await numberInventoryService.reserveNumberForOrg(
                    body.orgId,
                    body.countryCode || 'AR'
                );
                if (!result.success) {
                    return NextResponse.json({ error: result.error }, { status: 400 });
                }
                return NextResponse.json({
                    success: true,
                    number: result.number,
                    message: `Number ${result.number?.phoneNumber} reserved for organization`,
                });
            }

            case 'release': {
                // Release a specific number
                if (!body.numberId && !body.orgId) {
                    return NextResponse.json({ error: 'Number ID or Organization ID required' }, { status: 400 });
                }

                const reason = body.releaseReason || 'manual';

                if (body.numberId) {
                    await numberInventoryService.releaseNumber(body.numberId, reason);
                } else if (body.orgId) {
                    const released = await numberInventoryService.releaseByOrgId(body.orgId, reason);
                    if (!released) {
                        return NextResponse.json({ error: 'No assigned number found for organization' }, { status: 404 });
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: 'Number released successfully',
                });
            }

            case 'auto_release': {
                // Auto-release all inactive numbers
                const released = await numberInventoryService.autoReleaseInactiveNumbers();
                // Also release expired reservations
                const expiredReservations = await numberInventoryService.releaseExpiredReservations();

                return NextResponse.json({
                    success: true,
                    releasedInactive: released,
                    releasedExpiredReservations: expiredReservations,
                    message: `Released ${released} inactive numbers and ${expiredReservations} expired reservations`,
                });
            }

            case 'recycle': {
                // Recycle released numbers back to available pool
                const recycled = await numberInventoryService.recycleReleasedNumbers();
                return NextResponse.json({
                    success: true,
                    recycled,
                    message: `Recycled ${recycled} numbers back to available pool`,
                });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('[NumberInventory API] POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
