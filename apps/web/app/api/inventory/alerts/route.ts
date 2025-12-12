/**
 * Inventory Alerts API Route
 * GET /api/inventory/alerts - Get stock alerts (low stock, reorder needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get all items with stock information
    const items = await prisma.inventoryItem.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
      },
      include: {
        stocks: {
          include: {
            location: {
              select: {
                id: true,
                name: true,
                locationType: true,
              },
            },
          },
        },
      },
    });

    const alerts: Array<{
      type: 'LOW_STOCK' | 'OUT_OF_STOCK';
      severity: 'critical' | 'warning' | 'info';
      item: {
        id: string;
        name: string;
        sku: string | null;
      };
      message: string;
      details: {
        currentStock: number;
        minStockLevel: number | null;
        locationBreakdown?: Array<{
          locationId: string;
          locationName: string;
          quantity: number;
        }>;
      };
    }> = [];

    for (const item of items) {
      const totalStock = item.stocks.reduce((sum, s) => sum + s.quantity, 0);

      // Out of stock alert
      if (totalStock === 0) {
        alerts.push({
          type: 'OUT_OF_STOCK',
          severity: 'critical',
          item: {
            id: item.id,
            name: item.name,
            sku: item.sku,
          },
          message: `${item.name} está agotado`,
          details: {
            currentStock: 0,
            minStockLevel: item.minStockLevel,
            locationBreakdown: item.stocks.map((s) => ({
              locationId: s.locationId,
              locationName: s.location?.name ?? 'Ubicación desconocida',
              quantity: s.quantity,
            })),
          },
        });
        continue;
      }

      // Low stock alert (below minimum level)
      if (item.minStockLevel && totalStock <= item.minStockLevel) {
        alerts.push({
          type: 'LOW_STOCK',
          severity: totalStock <= item.minStockLevel / 2 ? 'critical' : 'warning',
          item: {
            id: item.id,
            name: item.name,
            sku: item.sku,
          },
          message: `${item.name} tiene stock bajo (${totalStock} ${item.unit || 'unidades'})`,
          details: {
            currentStock: totalStock,
            minStockLevel: item.minStockLevel,
            locationBreakdown: item.stocks.map((s) => ({
              locationId: s.locationId,
              locationName: s.location?.name ?? 'Ubicación desconocida',
              quantity: s.quantity,
            })),
          },
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Calculate summary
    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
      outOfStock: alerts.filter((a) => a.type === 'OUT_OF_STOCK').length,
      lowStock: alerts.filter((a) => a.type === 'LOW_STOCK').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        summary,
      },
    });
  } catch (error) {
    console.error('Inventory alerts error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo alertas de inventario' },
      { status: 500 }
    );
  }
}
