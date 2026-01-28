/**
 * Price Item Relations API
 * ========================
 * GET /api/pricebook/[id]/related - Get related items for a price item
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getSession();
        if (!session?.organizationId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '5', 10);

        // Verify the price item exists and belongs to this organization
        const priceItem = await prisma.priceItem.findFirst({
            where: {
                id,
                organizationId: session.organizationId,
            },
        });

        if (!priceItem) {
            return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
        }

        // Fetch related items (bidirectional)
        const relations = await prisma.priceItemRelation.findMany({
            where: {
                OR: [
                    { sourceItemId: id },
                    { relatedItemId: id },
                ],
            },
            include: {
                sourceItem: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        unit: true,
                        type: true,
                        isActive: true,
                    },
                },
                relatedItem: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        unit: true,
                        type: true,
                        isActive: true,
                    },
                },
            },
            orderBy: { weight: 'desc' },
            take: limit,
        });

        // Define item shape for type safety
        type RelatedItemData = {
            id: string;
            name: string;
            description: string | null;
            price: unknown;
            unit: string | null;
            type: string;
            isActive: boolean;
        };

        interface RelationWithItems {
            sourceItemId: string;
            relatedItemId: string;
            sourceItem: RelatedItemData;
            relatedItem: RelatedItemData;
        }

        // Get the "other" item in each relation (the one that's not the source item)
        const relatedItems = (relations as RelationWithItems[])
            .map((rel: RelationWithItems) => {
                const isSource = rel.sourceItemId === id;
                return isSource ? rel.relatedItem : rel.sourceItem;
            })
            .filter((item: RelatedItemData) => item.isActive); // Only show active items

        return NextResponse.json({
            success: true,
            data: relatedItems,
        });
    } catch (error) {
        console.error('Get related items error:', error);
        return NextResponse.json(
            { success: false, error: 'Error fetching related items' },
            { status: 500 }
        );
    }
}
