/**
 * Price Item Relations Management API
 * ====================================
 * POST /api/pricebook/relations - Create a relation between items
 * DELETE /api/pricebook/relations - Remove a relation
 * GET /api/pricebook/relations - List all relations for the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const priceItemId = searchParams.get('priceItemId');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);

        const where = {
            sourceItem: { organizationId: session.organizationId },
            ...(priceItemId && {
                OR: [{ sourceItemId: priceItemId }, { relatedItemId: priceItemId }],
            }),
        };

        const [relations, total] = await Promise.all([
            prisma.priceItemRelation.findMany({
                where,
                include: {
                    sourceItem: {
                        select: { id: true, name: true, type: true },
                    },
                    relatedItem: {
                        select: { id: true, name: true, type: true },
                    },
                    createdBy: {
                        select: { id: true, firstName: true, lastName: true },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.priceItemRelation.count({ where }),
        ]);

        return NextResponse.json({
            success: true,
            data: relations,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get relations error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching relations' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Only OWNER/ADMIN can create relations
        const role = session.role?.toUpperCase();
        if (!['OWNER', 'ADMIN'].includes(role || '')) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para crear relaciones' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { sourceItemId, relatedItemId, weight = 1 } = body;

        if (!sourceItemId || !relatedItemId) {
            return NextResponse.json(
                { success: false, error: 'sourceItemId and relatedItemId are required' },
                { status: 400 }
            );
        }

        if (sourceItemId === relatedItemId) {
            return NextResponse.json(
                { success: false, error: 'Cannot relate an item to itself' },
                { status: 400 }
            );
        }

        // Verify both items exist and belong to the organization
        const items = await prisma.priceItem.findMany({
            where: {
                id: { in: [sourceItemId, relatedItemId] },
                organizationId: session.organizationId,
            },
        });

        if (items.length !== 2) {
            return NextResponse.json(
                { success: false, error: 'One or both items not found' },
                { status: 404 }
            );
        }

        // Create the relation (upsert to handle duplicates)
        const relation = await prisma.priceItemRelation.upsert({
            where: {
                sourceItemId_relatedItemId: { sourceItemId, relatedItemId },
            },
            create: {
                sourceItemId,
                relatedItemId,
                weight,
                createdById: session.userId,
            },
            update: {
                weight,
            },
            include: {
                sourceItem: { select: { id: true, name: true } },
                relatedItem: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({
            success: true,
            data: relation,
        });
    } catch (error) {
        console.error('Create relation error:', error);
        return NextResponse.json(
            { success: false, error: 'Error creating relation' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Only OWNER/ADMIN can delete relations
        const role = session.role?.toUpperCase();
        if (!['OWNER', 'ADMIN'].includes(role || '')) {
            return NextResponse.json(
                { success: false, error: 'No tienes permiso para eliminar relaciones' },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const relationId = searchParams.get('id');
        const sourceItemId = searchParams.get('sourceItemId');
        const relatedItemId = searchParams.get('relatedItemId');

        let deleteWhere;

        if (relationId) {
            deleteWhere = { id: relationId };
        } else if (sourceItemId && relatedItemId) {
            deleteWhere = {
                sourceItemId_relatedItemId: { sourceItemId, relatedItemId },
            };
        } else {
            return NextResponse.json(
                { success: false, error: 'Either id or both sourceItemId and relatedItemId required' },
                { status: 400 }
            );
        }

        // Verify the relation belongs to this organization's items
        const relation = relationId
            ? await prisma.priceItemRelation.findUnique({
                where: { id: relationId },
                include: { sourceItem: { select: { organizationId: true } } },
            })
            : await prisma.priceItemRelation.findUnique({
                where: { sourceItemId_relatedItemId: { sourceItemId: sourceItemId!, relatedItemId: relatedItemId! } },
                include: { sourceItem: { select: { organizationId: true } } },
            });

        if (!relation || relation.sourceItem.organizationId !== session.organizationId) {
            return NextResponse.json(
                { success: false, error: 'Relation not found' },
                { status: 404 }
            );
        }

        await prisma.priceItemRelation.delete({ where: deleteWhere });

        return NextResponse.json({
            success: true,
            message: 'Relation deleted',
        });
    } catch (error) {
        console.error('Delete relation error:', error);
        return NextResponse.json(
            { success: false, error: 'Error deleting relation' },
            { status: 500 }
        );
    }
}
