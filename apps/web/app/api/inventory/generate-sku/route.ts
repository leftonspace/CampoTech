/**
 * SKU Generator API Route
 * Generates unique SKU codes for products
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inventory/generate-sku
 * Generate a unique SKU
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix')?.toUpperCase() || 'PRD';
    const categoryCode = searchParams.get('categoryCode')?.toUpperCase();

    // Build SKU prefix
    let skuPrefix = prefix;
    if (categoryCode) {
      skuPrefix = categoryCode;
    }

    // Get count of products with this prefix
    const count = await prisma.product.count({
      where: {
        organizationId: session.organizationId,
        sku: { startsWith: skuPrefix },
      },
    });

    // Generate next number with padding
    const nextNumber = (count + 1).toString().padStart(5, '0');
    const sku = `${skuPrefix}-${nextNumber}`;

    // Verify it doesn't exist (in case of race condition or deleted products)
    const existing = await prisma.product.findFirst({
      where: {
        organizationId: session.organizationId,
        sku,
      },
    });

    if (existing) {
      // Add random suffix if collision
      const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
      return NextResponse.json({
        success: true,
        data: { sku: `${skuPrefix}-${nextNumber}-${randomSuffix}` },
      });
    }

    return NextResponse.json({
      success: true,
      data: { sku },
    });
  } catch (error) {
    console.error('SKU generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating SKU' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inventory/generate-sku
 * Generate SKU based on product details
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, categoryId, brand, productType } = body;

    // Build SKU from product attributes
    let skuParts: string[] = [];

    // Add category code if provided
    if (categoryId) {
      const category = await prisma.productCategory.findFirst({
        where: {
          id: categoryId,
          organizationId: session.organizationId,
        },
      });

      if (category) {
        skuParts.push(category.code.substring(0, 4).toUpperCase());
      }
    }

    // Add product type prefix if no category
    if (skuParts.length === 0 && productType) {
      const typeMap: Record<string, string> = {
        PART: 'REP',
        CONSUMABLE: 'CON',
        EQUIPMENT: 'EQP',
        SERVICE: 'SVC',
      };
      skuParts.push(typeMap[productType] || 'PRD');
    }

    // Add brand abbreviation
    if (brand) {
      skuParts.push(brand.substring(0, 3).toUpperCase());
    }

    // Add name abbreviation
    if (name) {
      const nameWords = name.split(' ').filter((w: string) => w.length > 2);
      if (nameWords.length > 0) {
        const nameAbbrev = nameWords
          .slice(0, 2)
          .map((w: string) => w.substring(0, 3).toUpperCase())
          .join('');
        skuParts.push(nameAbbrev);
      }
    }

    // Fallback prefix
    if (skuParts.length === 0) {
      skuParts.push('PRD');
    }

    const prefix = skuParts.join('-');

    // Get count of products with this prefix
    const count = await prisma.product.count({
      where: {
        organizationId: session.organizationId,
        sku: { startsWith: prefix },
      },
    });

    // Generate next number with padding
    const nextNumber = (count + 1).toString().padStart(4, '0');
    const sku = `${prefix}-${nextNumber}`;

    // Verify it doesn't exist
    const existing = await prisma.product.findFirst({
      where: {
        organizationId: session.organizationId,
        sku,
      },
    });

    if (existing) {
      // Add random suffix if collision
      const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase();
      return NextResponse.json({
        success: true,
        data: { sku: `${prefix}-${nextNumber}-${randomSuffix}` },
      });
    }

    return NextResponse.json({
      success: true,
      data: { sku },
    });
  } catch (error) {
    console.error('SKU generation error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating SKU' },
      { status: 500 }
    );
  }
}
