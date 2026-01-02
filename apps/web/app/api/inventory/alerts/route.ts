import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { InventoryService } from '@/src/services/inventory.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get products with stock alerts from InventoryService
    const result = await InventoryService.listProducts(
      session.organizationId,
      { lowStock: true },
      { limit: 200 } // Reasonable limit for alerts
    );
    const products = result.items;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const alerts = products.map((product: any) => {
      const totalStock = product.stock.onHand;
      const isOutOfStock = totalStock === 0;

      const severity = isOutOfStock
        ? 'critical'
        : (product.minStockLevel && totalStock <= product.minStockLevel / 2 ? 'critical' : 'warning');

      return {
        type: isOutOfStock ? 'OUT_OF_STOCK' : 'LOW_STOCK',
        severity,
        item: {
          id: product.id,
          name: product.name,
          sku: product.sku,
        },
        message: isOutOfStock
          ? `${product.name} está agotado`
          : `${product.name} tiene stock bajo (${totalStock} ${product.unitOfMeasure || 'unidades'})`,
        details: {
          currentStock: totalStock,
          minStockLevel: product.minStockLevel,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          locationBreakdown: product.inventoryLevels.map((lvl: any) => ({
            locationId: lvl.warehouseId,
            locationName: lvl.warehouse.name,
            quantity: lvl.quantityOnHand,
          })),
        },
      };
    });

    // Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    alerts.sort((a: any, b: any) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate summary
    const summary = {
      total: alerts.length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      critical: alerts.filter((a: any) => a.severity === 'critical').length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      warning: alerts.filter((a: any) => a.severity === 'warning').length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      info: alerts.filter((a: any) => a.severity === 'info').length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      outOfStock: alerts.filter((a: any) => a.type === 'OUT_OF_STOCK').length,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lowStock: alerts.filter((a: any) => a.type === 'LOW_STOCK').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Inventory alerts error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo alertas de inventario' },
      { status: 500 }
    );
  }
}
