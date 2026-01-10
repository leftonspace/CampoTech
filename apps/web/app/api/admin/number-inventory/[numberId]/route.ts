/**
 * Phase 6.1: Individual Number Management API
 * 
 * GET - Get number details with activity logs
 * PATCH - Update number metadata, suspend/unsuspend
 * DELETE - Remove number from inventory (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { numberInventoryService } from '@/lib/services/number-inventory.service';
import { prisma } from '@/lib/prisma';
import { getSession, type TokenPayload } from '@/lib/auth';

interface RouteParams {
    params: Promise<{ numberId: string }>;
}

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
// GET: Get number details with activity logs
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const { numberId } = await params;

        const number = await numberInventoryService.getNumberById(numberId);

        if (!number) {
            return NextResponse.json({ error: 'Number not found' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            number,
        });

    } catch (error) {
        console.error('[NumberInventory API] GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH: Update number metadata or change status
// ═══════════════════════════════════════════════════════════════════════════════

interface PatchRequest {
    action?: 'suspend' | 'unsuspend' | 'update';
    notes?: string;
    monthlyRentalCostUsd?: number;
    bspNumberId?: string;
    wabaId?: string;
    reason?: string;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const { numberId } = await params;
        const body: PatchRequest = await request.json();

        // Check number exists
        const existing = await prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Number not found' }, { status: 404 });
        }

        switch (body.action) {
            case 'suspend': {
                await numberInventoryService.suspendNumber(numberId, body.reason);
                return NextResponse.json({
                    success: true,
                    message: 'Number suspended',
                });
            }

            case 'unsuspend': {
                await numberInventoryService.unsuspendNumber(numberId);
                return NextResponse.json({
                    success: true,
                    message: 'Number unsuspended',
                });
            }

            case 'update':
            default: {
                // Update metadata
                const updateData: Record<string, unknown> = {};
                if (body.notes !== undefined) updateData.notes = body.notes;
                if (body.monthlyRentalCostUsd !== undefined) updateData.monthlyRentalCostUsd = body.monthlyRentalCostUsd;
                if (body.bspNumberId !== undefined) updateData.bspNumberId = body.bspNumberId;
                if (body.wabaId !== undefined) updateData.wabaId = body.wabaId;

                if (Object.keys(updateData).length === 0) {
                    return NextResponse.json({ error: 'No update data provided' }, { status: 400 });
                }

                await numberInventoryService.updateNumber(numberId, updateData as {
                    notes?: string;
                    monthlyRentalCostUsd?: number;
                    bspNumberId?: string;
                    wabaId?: string;
                });

                return NextResponse.json({
                    success: true,
                    message: 'Number updated',
                });
            }
        }

    } catch (error) {
        console.error('[NumberInventory API] PATCH error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE: Remove number from inventory (hard delete - use with caution)
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;

    try {
        const { numberId } = await params;

        const number = await prisma.whatsAppNumberInventory.findUnique({
            where: { id: numberId },
        });

        if (!number) {
            return NextResponse.json({ error: 'Number not found' }, { status: 404 });
        }

        // Only allow deletion of available or released numbers
        if (number.status === 'assigned' || number.status === 'reserved') {
            return NextResponse.json(
                { error: 'Cannot delete assigned or reserved numbers. Release first.' },
                { status: 400 }
            );
        }

        // Delete activity logs first (cascade should handle but be explicit)
        await prisma.numberActivityLog.deleteMany({
            where: { numberId },
        });

        // Delete the number
        await prisma.whatsAppNumberInventory.delete({
            where: { id: numberId },
        });

        return NextResponse.json({
            success: true,
            message: `Number ${number.phoneNumber} removed from inventory`,
        });

    } catch (error) {
        console.error('[NumberInventory API] DELETE error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
