/**
 * Inventory Alerts API Route
 * GET /api/inventory/alerts - Get stock alerts (low stock, reorder needed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

// Helper to check if error is "table doesn't exist"
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

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
    let items: any[] = [];
    try {
      items = await prisma.inventoryItem.findMany({
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
    } catch (queryError) {
      // Handle missing table gracefully - return empty data
      if (isTableNotFoundError(queryError)) {
        console.warn('Inventory tables not found - returning empty data. Run database migrations to create tables.');
        return NextResponse.json({
          success: true,
          data: {
            alerts: [],
            summary: {
              total: 0,
              critical: 0,
              warning: 0,
              info: 0,
              outOfStock: 0,
              lowStock: 0,
            },
          },
          _notice: 'Inventory management tables not yet created. Run database migrations.',
        });
      }
      throw queryError;
    }

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
      const totalStock = item.stocks.reduce((sum: number, s: { quantity: number }) => sum + s.quantity, 0);

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
            locationBreakdown: item.stocks.map((s: { locationId: string; location?: { name: string }; quantity: number }) => ({
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
            locationBreakdown: item.stocks.map((s: { locationId: string; location?: { name: string }; quantity: number }) => ({
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
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Inventory alerts error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo alertas de inventario' },
      { status: 500 }
    );
  }
}
