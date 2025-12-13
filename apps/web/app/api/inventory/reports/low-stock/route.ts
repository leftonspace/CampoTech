/**
 * Low Stock Report API Route
 * GET low stock / reorder alerts report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inventory/reports/low-stock
 * Get low stock and reorder point alerts
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
    const severity = searchParams.get('severity'); // critical, warning, all
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // Get products with their inventory levels
    const products = await prisma.product.findMany({
      where: {
        organizationId: session.organizationId,
        trackInventory: true,
        isActive: includeInactive ? undefined : true,
        categoryId: categoryId || undefined,
      },
      include: {
        category: { select: { id: true, code: true, name: true } },
        inventoryLevels: {
          where: warehouseId ? { warehouseId } : undefined,
          include: {
            warehouse: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    const alerts: Array<{
      productId: string;
      sku: string;
      name: string;
      categoryName: string;
      warehouseId: string;
      warehouseName: string;
      quantityOnHand: number;
      quantityAvailable: number;
      reorderPoint: number;  // Uses minStockLevel as reorder point
      minStockLevel: number;
      reorderQty: number;
      severity: 'critical' | 'warning';
      deficit: number;
      estimatedCost: number;
    }> = [];

    for (const product of products) {
      // Calculate total stock across all warehouses
      const totalOnHand = product.inventoryLevels.reduce((sum: number, l: typeof product.inventoryLevels[number]) => sum + l.quantityOnHand, 0);
      const totalAvailable = product.inventoryLevels.reduce((sum: number, l: typeof product.inventoryLevels[number]) => sum + l.quantityAvailable, 0);

      // Check for low stock at product level (minStockLevel serves as reorder point)
      const isAtOrBelowReorder = totalAvailable <= product.minStockLevel;
      const isBelowMin = totalAvailable < product.minStockLevel;
      const isCritical = isBelowMin || totalAvailable === 0;

      if (isAtOrBelowReorder || isBelowMin) {
        // Get warehouse-level details
        if (product.inventoryLevels.length === 0) {
          // No inventory at all - critical
          alerts.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            categoryName: product.category?.name || 'Sin categoría',
            warehouseId: '',
            warehouseName: 'Sin stock',
            quantityOnHand: 0,
            quantityAvailable: 0,
            reorderPoint: product.minStockLevel,
            minStockLevel: product.minStockLevel,
            reorderQty: product.reorderQty || 0,
            severity: 'critical',
            deficit: product.minStockLevel,
            estimatedCost: (product.reorderQty || 0) * Number(product.costPrice),
          });
        } else {
          for (const level of product.inventoryLevels) {
            const warehouseSeverity = level.quantityAvailable < product.minStockLevel ? 'critical' : 'warning';

            if (severity === 'critical' && warehouseSeverity !== 'critical') continue;
            if (severity === 'warning' && warehouseSeverity !== 'warning') continue;

            const deficit = Math.max(0, product.minStockLevel - level.quantityAvailable);

            alerts.push({
              productId: product.id,
              sku: product.sku,
              name: product.name,
              categoryName: product.category?.name || 'Sin categoría',
              warehouseId: level.warehouseId,
              warehouseName: level.warehouse?.name || 'Sin almacén',
              quantityOnHand: level.quantityOnHand,
              quantityAvailable: level.quantityAvailable,
              reorderPoint: product.minStockLevel,
              minStockLevel: product.minStockLevel,
              reorderQty: product.reorderQty || 0,
              severity: warehouseSeverity,
              deficit,
              estimatedCost: (product.reorderQty || 0) * Number(product.costPrice),
            });
          }
        }
      }
    }

    // Sort by severity (critical first) then by deficit
    alerts.sort((a: typeof alerts[number], b: typeof alerts[number]) => {
      if (a.severity !== b.severity) {
        return a.severity === 'critical' ? -1 : 1;
      }
      return b.deficit - a.deficit;
    });

    // Calculate summary
    const criticalCount = alerts.filter((a: typeof alerts[number]) => a.severity === 'critical').length;
    const warningCount = alerts.filter((a: typeof alerts[number]) => a.severity === 'warning').length;
    const totalEstimatedCost = alerts.reduce((sum: number, a: typeof alerts[number]) => sum + a.estimatedCost, 0);
    const uniqueProducts = new Set(alerts.map((a: typeof alerts[number]) => a.productId)).size;

    // Group by category
    const byCategory: Record<string, { name: string; critical: number; warning: number }> = {};
    for (const alert of alerts) {
      const key = alert.categoryName;
      if (!byCategory[key]) {
        byCategory[key] = { name: key, critical: 0, warning: 0 };
      }
      if (alert.severity === 'critical') {
        byCategory[key].critical++;
      } else {
        byCategory[key].warning++;
      }
    }

    // Group by warehouse
    const byWarehouse: Record<string, { name: string; critical: number; warning: number }> = {};
    for (const alert of alerts) {
      const key = alert.warehouseName;
      if (!byWarehouse[key]) {
        byWarehouse[key] = { name: key, critical: 0, warning: 0 };
      }
      if (alert.severity === 'critical') {
        byWarehouse[key].critical++;
      } else {
        byWarehouse[key].warning++;
      }
    }

    // Generate suggested purchase order
    const suggestedPO = alerts
      .filter((a: typeof alerts[number]) => a.deficit > 0)
      .reduce((acc: Array<{ productId: string; sku: string; name: string; quantity: number; unitCost: number; totalCost: number }>, alert: typeof alerts[number]) => {
        const existing = acc.find((item: typeof acc[number]) => item.productId === alert.productId);
        if (existing) {
          existing.quantity = Math.max(existing.quantity, alert.reorderQty || alert.deficit);
        } else {
          const qty = alert.reorderQty || alert.deficit;
          acc.push({
            productId: alert.productId,
            sku: alert.sku,
            name: alert.name,
            quantity: qty,
            unitCost: qty > 0 ? alert.estimatedCost / qty : 0,
            totalCost: alert.estimatedCost,
          });
        }
        return acc;
      }, [] as Array<{ productId: string; sku: string; name: string; quantity: number; unitCost: number; totalCost: number }>);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalAlerts: alerts.length,
          criticalCount,
          warningCount,
          uniqueProducts,
          totalEstimatedCost,
        },
        alerts: severity ? alerts.filter((a: typeof alerts[number]) => a.severity === severity) : alerts,
        byCategory: Object.values(byCategory).sort((a: { name: string; critical: number; warning: number }, b: { name: string; critical: number; warning: number }) => (b.critical + b.warning) - (a.critical + a.warning)),
        byWarehouse: Object.values(byWarehouse).sort((a: { name: string; critical: number; warning: number }, b: { name: string; critical: number; warning: number }) => (b.critical + b.warning) - (a.critical + a.warning)),
        suggestedPurchaseOrder: {
          items: suggestedPO,
          totalItems: suggestedPO.length,
          totalCost: suggestedPO.reduce((sum: number, item: typeof suggestedPO[number]) => sum + item.totalCost, 0),
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Low stock report error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating low stock report' },
      { status: 500 }
    );
  }
}
