/**
 * Inventory Valuation Report API Route
 * GET inventory valuation report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inventory/reports/valuation
 * Get inventory valuation report
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
    const warehouseId = searchParams.get('warehouseId');
    const categoryId = searchParams.get('categoryId');
    const groupBy = searchParams.get('groupBy') || 'product'; // product, category, warehouse

    // Build where clause for inventory levels
    const where: any = {
      product: {
        organizationId: session.organizationId,
      },
    };

    if (warehouseId) {
      where.warehouseId = warehouseId;
    }

    if (categoryId) {
      where.product.categoryId = categoryId;
    }

    // Get inventory levels with product and warehouse info
    const inventoryLevels = await prisma.inventoryLevel.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            costPrice: true,
            salePrice: true,
            categoryId: true,
            category: {
              select: { id: true, code: true, name: true },
            },
          },
        },
        warehouse: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    // Calculate totals
    let totalCostValue = 0;
    let totalRetailValue = 0;
    let totalUnits = 0;
    let totalSKUs = new Set<string>();

    const items = inventoryLevels.map((level: typeof inventoryLevels[number]) => {
      const costValue = level.quantityOnHand * Number(level.product.costPrice);
      const retailValue = level.quantityOnHand * Number(level.product.salePrice);
      const potentialProfit = retailValue - costValue;

      totalCostValue += costValue;
      totalRetailValue += retailValue;
      totalUnits += level.quantityOnHand;
      totalSKUs.add(level.product.sku);

      return {
        productId: level.product.id,
        sku: level.product.sku,
        name: level.product.name,
        categoryId: level.product.categoryId,
        categoryName: level.product.category?.name || 'Sin categoría',
        warehouseId: level.warehouseId,
        warehouseName: level.warehouse?.name || 'Sin almacén',
        quantityOnHand: level.quantityOnHand,
        quantityReserved: level.quantityReserved,
        quantityAvailable: level.quantityAvailable,
        unitCost: Number(level.product.costPrice),
        unitRetail: Number(level.product.salePrice),
        costValue,
        retailValue,
        potentialProfit,
        profitMargin: retailValue > 0 ? (potentialProfit / retailValue) * 100 : 0,
      };
    });

    // Group results if requested
    let grouped: any = null;

    if (groupBy === 'category') {
      const byCategory: Record<string, {
        categoryId: string;
        categoryName: string;
        totalUnits: number;
        costValue: number;
        retailValue: number;
        itemCount: number;
      }> = {};

      for (const item of items) {
        const key = item.categoryId || 'no-category';
        if (!byCategory[key]) {
          byCategory[key] = {
            categoryId: item.categoryId || '',
            categoryName: item.categoryName,
            totalUnits: 0,
            costValue: 0,
            retailValue: 0,
            itemCount: 0,
          };
        }
        byCategory[key].totalUnits += item.quantityOnHand;
        byCategory[key].costValue += item.costValue;
        byCategory[key].retailValue += item.retailValue;
        byCategory[key].itemCount++;
      }

      type CategoryGroupItem = typeof byCategory[string];
      grouped = Object.values(byCategory).sort((a: CategoryGroupItem, b: CategoryGroupItem) => b.costValue - a.costValue);
    } else if (groupBy === 'warehouse') {
      const byWarehouse: Record<string, {
        warehouseId: string;
        warehouseName: string;
        totalUnits: number;
        costValue: number;
        retailValue: number;
        itemCount: number;
      }> = {};

      for (const item of items) {
        const key = item.warehouseId || 'no-warehouse';
        if (!byWarehouse[key]) {
          byWarehouse[key] = {
            warehouseId: item.warehouseId || '',
            warehouseName: item.warehouseName,
            totalUnits: 0,
            costValue: 0,
            retailValue: 0,
            itemCount: 0,
          };
        }
        byWarehouse[key].totalUnits += item.quantityOnHand;
        byWarehouse[key].costValue += item.costValue;
        byWarehouse[key].retailValue += item.retailValue;
        byWarehouse[key].itemCount++;
      }

      type WarehouseGroupItem = typeof byWarehouse[string];
      grouped = Object.values(byWarehouse).sort((a: WarehouseGroupItem, b: WarehouseGroupItem) => b.costValue - a.costValue);
    }

    // Get ABC analysis (top 20% by value = A, next 30% = B, rest = C)
    const sortedByValue = [...items].sort((a: typeof items[number], b: typeof items[number]) => b.costValue - a.costValue);
    const cumulativeValue = sortedByValue.reduce((acc: number[], item: typeof sortedByValue[number], index: number) => {
      const cumValue = (acc[index - 1] || 0) + item.costValue;
      acc.push(cumValue);
      return acc;
    }, [] as number[]);

    const abcAnalysis = sortedByValue.map((item: typeof sortedByValue[number], index: number) => {
      const cumPercent = totalCostValue > 0 ? (cumulativeValue[index] / totalCostValue) * 100 : 0;
      let classification: 'A' | 'B' | 'C';
      if (cumPercent <= 80) {
        classification = 'A';
      } else if (cumPercent <= 95) {
        classification = 'B';
      } else {
        classification = 'C';
      }
      return { ...item, classification };
    });

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalSKUs: totalSKUs.size,
          totalUnits,
          totalCostValue,
          totalRetailValue,
          potentialProfit: totalRetailValue - totalCostValue,
          averageMargin: totalRetailValue > 0
            ? ((totalRetailValue - totalCostValue) / totalRetailValue) * 100
            : 0,
        },
        items: groupBy === 'product' ? items.sort((a, b) => b.costValue - a.costValue) : undefined,
        grouped,
        abcAnalysis: {
          A: abcAnalysis.filter((i) => i.classification === 'A').length,
          B: abcAnalysis.filter((i) => i.classification === 'B').length,
          C: abcAnalysis.filter((i) => i.classification === 'C').length,
          items: abcAnalysis.slice(0, 20), // Top 20 items
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Valuation report error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating valuation report' },
      { status: 500 }
    );
  }
}
