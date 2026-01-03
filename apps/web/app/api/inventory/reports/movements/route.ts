/**
 * Stock Movements Report API Route
 * GET stock movements report
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/inventory/reports/movements
 * Get stock movements report
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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const warehouseId = searchParams.get('warehouseId');
    const productId = searchParams.get('productId');
    const movementType = searchParams.get('movementType');
    const _groupBy = searchParams.get('groupBy') || 'type'; // type, product, warehouse, day

    // Default to last 30 days
    const dateFrom = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = endDate ? new Date(endDate) : new Date();

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      organizationId: session.organizationId,
      performedAt: {
        gte: dateFrom,
        lte: dateTo,
      },
    };

    if (warehouseId) {
      where.OR = [
        { fromWarehouseId: warehouseId },
        { toWarehouseId: warehouseId },
      ];
    }

    if (productId) {
      where.productId = productId;
    }

    if (movementType) {
      where.movementType = movementType;
    }

    // Get movements
    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, sku: true, name: true } },
        fromWarehouse: { select: { id: true, name: true, code: true } },
        toWarehouse: { select: { id: true, name: true, code: true } },
        job: { select: { id: true, jobNumber: true } },
      },
      orderBy: { performedAt: 'desc' },
    });

    // Calculate totals
    let totalIn = 0;
    let totalOut = 0;
    let totalValueIn = 0;
    let totalValueOut = 0;

    const byType: Record<string, { count: number; quantity: number; value: number }> = {};
    const byProduct: Record<string, { name: string; in: number; out: number; valueIn: number; valueOut: number }> = {};
    const byWarehouse: Record<string, { name: string; in: number; out: number; valueIn: number; valueOut: number }> = {};
    const byDay: Record<string, { in: number; out: number; valueIn: number; valueOut: number }> = {};

    for (const mov of movements) {
      const qty = mov.quantity;
      const value = Number(mov.totalCost);
      const direction = mov.direction;

      if (direction === 'IN') {
        totalIn += qty;
        totalValueIn += value;
      } else {
        totalOut += qty;
        totalValueOut += value;
      }

      // By type
      if (!byType[mov.movementType]) {
        byType[mov.movementType] = { count: 0, quantity: 0, value: 0 };
      }
      byType[mov.movementType].count++;
      byType[mov.movementType].quantity += qty;
      byType[mov.movementType].value += value;

      // By product
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const product = mov.product as any;
      if (!byProduct[mov.productId]) {
        byProduct[mov.productId] = {
          name: product?.name || 'Unknown',
          in: 0,
          out: 0,
          valueIn: 0,
          valueOut: 0,
        };
      }
      if (direction === 'IN') {
        byProduct[mov.productId].in += qty;
        byProduct[mov.productId].valueIn += value;
      } else {
        byProduct[mov.productId].out += qty;
        byProduct[mov.productId].valueOut += value;
      }

      // By warehouse
      const warehouseKey = mov.toWarehouseId || mov.fromWarehouseId || 'no-warehouse';
      const warehouseName = mov.toWarehouse?.name || mov.fromWarehouse?.name || 'Sin almacén';
      if (!byWarehouse[warehouseKey]) {
        byWarehouse[warehouseKey] = {
          name: warehouseName,
          in: 0,
          out: 0,
          valueIn: 0,
          valueOut: 0,
        };
      }
      if (direction === 'IN' && mov.toWarehouseId) {
        byWarehouse[mov.toWarehouseId].in += qty;
        byWarehouse[mov.toWarehouseId].valueIn += value;
      }
      if (direction === 'OUT' && mov.fromWarehouseId) {
        byWarehouse[mov.fromWarehouseId].out += qty;
        byWarehouse[mov.fromWarehouseId].valueOut += value;
      }

      // By day
      const dayKey = mov.performedAt.toISOString().slice(0, 10);
      if (!byDay[dayKey]) {
        byDay[dayKey] = { in: 0, out: 0, valueIn: 0, valueOut: 0 };
      }
      if (direction === 'IN') {
        byDay[dayKey].in += qty;
        byDay[dayKey].valueIn += value;
      } else {
        byDay[dayKey].out += qty;
        byDay[dayKey].valueOut += value;
      }
    }

    // Format grouped data
    type TypeDataEntry = { type: string; quantity: number; value: number };
    const typeData = (Object.entries(byType) as [string, { quantity: number; value: number }][])
      .map(([type, data]): TypeDataEntry => ({ type, ...data }))
      .sort((a: TypeDataEntry, b: TypeDataEntry) => b.quantity - a.quantity);

    type ProductDataEntry = { productId: string; productName: string; totalIn: number; totalOut: number; netChange: number; valueIn: number; valueOut: number };
    const productData = (Object.entries(byProduct) as [string, { name: string; in: number; out: number; valueIn: number; valueOut: number }][])
      .map(([productId, data]): ProductDataEntry => ({
        productId,
        productName: data.name,
        totalIn: data.in,
        totalOut: data.out,
        netChange: data.in - data.out,
        valueIn: data.valueIn,
        valueOut: data.valueOut,
      }))
      .sort((a: ProductDataEntry, b: ProductDataEntry) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut));

    type WarehouseDataEntry = { warehouseId: string; warehouseName: string; totalIn: number; totalOut: number; netChange: number; valueIn: number; valueOut: number };
    const warehouseData = (Object.entries(byWarehouse) as [string, { name: string; in: number; out: number; valueIn: number; valueOut: number }][])
      .map(([warehouseId, data]): WarehouseDataEntry => ({
        warehouseId,
        warehouseName: data.name,
        totalIn: data.in,
        totalOut: data.out,
        netChange: data.in - data.out,
        valueIn: data.valueIn,
        valueOut: data.valueOut,
      }))
      .sort((a: WarehouseDataEntry, b: WarehouseDataEntry) => (b.totalIn + b.totalOut) - (a.totalIn + a.totalOut));

    type DailyDataEntry = { date: string; in: number; out: number; valueIn: number; valueOut: number; netChange: number };
    const dailyData = (Object.entries(byDay) as [string, { in: number; out: number; valueIn: number; valueOut: number }][])
      .map(([date, data]): DailyDataEntry => ({
        date,
        ...data,
        netChange: data.in - data.out,
      }))
      .sort((a: DailyDataEntry, b: DailyDataEntry) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      data: {
        period: { from: dateFrom, to: dateTo },
        summary: {
          totalMovements: movements.length,
          totalIn,
          totalOut,
          netChange: totalIn - totalOut,
          totalValueIn,
          totalValueOut,
          netValueChange: totalValueIn - totalValueOut,
        },
        byType: typeData,
        byProduct: productData.slice(0, 20), // Top 20
        byWarehouse: warehouseData,
        daily: dailyData,
        recentMovements: movements.slice(0, 50).map((m: typeof movements[number]) => ({
          id: m.id,
          movementNumber: m.movementNumber,
          movementType: m.movementType,
          direction: m.direction,
          quantity: m.quantity,
          value: Number(m.totalCost),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          productSku: (m.product as any)?.sku,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          productName: (m.product as any)?.name,
          fromWarehouse: m.fromWarehouse?.name,
          toWarehouse: m.toWarehouse?.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          jobNumber: (m.job as any)?.jobNumber,
          performedAt: m.performedAt,
        })),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Movements report error:', error);
    return NextResponse.json(
      { success: false, error: 'Error generating movements report' },
      { status: 500 }
    );
  }
}
