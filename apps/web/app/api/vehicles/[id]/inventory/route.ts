/**
 * Vehicle Inventory API Route
 * GET /api/vehicles/[id]/inventory - List vehicle inventory
 * POST /api/vehicles/[id]/inventory - Add/adjust item in vehicle inventory
 * DELETE /api/vehicles/[id]/inventory - Remove item from vehicle inventory
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vehicles/[id]/inventory
 * Get vehicle inventory items with low stock alerts
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        plateNumber: true,
        make: true,
        model: true,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    // Get or identify inventory location for this vehicle
    let location = await prisma.inventoryLocation.findFirst({
      where: {
        vehicleId,
        organizationId: session.organizationId,
      },
    });

    // If no location exists, return empty inventory
    if (!location) {
      return NextResponse.json({
        success: true,
        data: {
          vehicle,
          location: null,
          items: [],
          summary: {
            totalItems: 0,
            totalValue: 0,
            lowStockItems: 0,
            outOfStockItems: 0,
          },
          alerts: [],
        },
      });
    }

    // Get inventory stocks for this location
    const stocks = await prisma.inventoryStock.findMany({
      where: { locationId: location.id },
      include: {
        item: {
          select: {
            id: true,
            sku: true,
            name: true,
            description: true,
            category: true,
            unit: true,
            minStockLevel: true,
            costPrice: true,
            salePrice: true,
            imageUrl: true,
          },
        },
      },
      orderBy: { item: { name: 'asc' } },
    });

    // Calculate summary and alerts
    let totalValue = 0;
    let lowStockItems = 0;
    let outOfStockItems = 0;
    const alerts: Array<{
      itemId: string;
      itemName: string;
      quantity: number;
      minLevel: number;
      status: 'LOW' | 'OUT';
    }> = [];

    const items = stocks.map((stock: typeof stocks[number]) => {
      const item = stock.item;
      const value = stock.quantity * Number(item.costPrice);
      totalValue += value;

      let stockStatus: 'OK' | 'LOW' | 'OUT' = 'OK';
      if (stock.quantity <= 0) {
        stockStatus = 'OUT';
        outOfStockItems++;
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          quantity: stock.quantity,
          minLevel: item.minStockLevel,
          status: 'OUT',
        });
      } else if (stock.quantity <= item.minStockLevel) {
        stockStatus = 'LOW';
        lowStockItems++;
        alerts.push({
          itemId: item.id,
          itemName: item.name,
          quantity: stock.quantity,
          minLevel: item.minStockLevel,
          status: 'LOW',
        });
      }

      return {
        id: stock.id,
        item: {
          id: item.id,
          sku: item.sku,
          name: item.name,
          description: item.description,
          category: item.category,
          unit: item.unit,
          minStockLevel: item.minStockLevel,
          costPrice: Number(item.costPrice),
          salePrice: Number(item.salePrice),
          imageUrl: item.imageUrl,
        },
        quantity: stock.quantity,
        value,
        status: stockStatus,
        lastCountedAt: stock.lastCountedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        vehicle,
        location: {
          id: location.id,
          name: location.name,
          isActive: location.isActive,
        },
        items,
        summary: {
          totalItems: items.length,
          totalValue,
          lowStockItems,
          outOfStockItems,
        },
        alerts: alerts.sort((a, b) => a.quantity - b.quantity),
      },
    });
  } catch (error) {
    console.error('Vehicle inventory list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando inventario del vehículo' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vehicles/[id]/inventory
 * Add or adjust inventory item in vehicle
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only owners and dispatchers can manage vehicle inventory
    if (!['OWNER', 'DISPATCHER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { action, itemId, quantity, notes } = body;

    // Get or create inventory location for this vehicle
    let location = await prisma.inventoryLocation.findFirst({
      where: {
        vehicleId,
        organizationId: session.organizationId,
      },
    });

    if (!location) {
      // Create inventory location for this vehicle
      location = await prisma.inventoryLocation.create({
        data: {
          organizationId: session.organizationId,
          name: `${vehicle.make} ${vehicle.model} - ${vehicle.plateNumber}`,
          locationType: 'VEHICLE',
          vehicleId,
          isActive: true,
        },
      });
    }

    // Validate item exists
    const item = await prisma.inventoryItem.findFirst({
      where: {
        id: itemId,
        organizationId: session.organizationId,
        isActive: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Artículo no encontrado' },
        { status: 404 }
      );
    }

    // Get existing stock entry
    const existingStock = await prisma.inventoryStock.findFirst({
      where: {
        locationId: location.id,
        itemId,
      },
    });

    let newQuantity: number;
    let stock;

    switch (action) {
      case 'set':
        // Set absolute quantity
        newQuantity = Math.max(0, quantity || 0);
        break;
      case 'add':
        // Add to existing quantity
        newQuantity = (existingStock?.quantity || 0) + (quantity || 0);
        break;
      case 'remove':
        // Remove from existing quantity
        newQuantity = Math.max(0, (existingStock?.quantity || 0) - (quantity || 0));
        break;
      default:
        // Default to set behavior
        newQuantity = Math.max(0, quantity || 0);
    }

    if (existingStock) {
      if (newQuantity <= 0) {
        // Remove stock entry if quantity is 0
        await prisma.inventoryStock.delete({
          where: { id: existingStock.id },
        });
        stock = null;
      } else {
        stock = await prisma.inventoryStock.update({
          where: { id: existingStock.id },
          data: {
            quantity: newQuantity,
            lastCountedAt: new Date(),
          },
          include: {
            item: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
                minStockLevel: true,
              },
            },
          },
        });
      }
    } else if (newQuantity > 0) {
      stock = await prisma.inventoryStock.create({
        data: {
          locationId: location.id,
          itemId,
          quantity: newQuantity,
          lastCountedAt: new Date(),
        },
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit: true,
              minStockLevel: true,
            },
          },
        },
      });
    }

    // Create transaction record
    if (quantity !== 0) {
      await prisma.inventoryTransaction.create({
        data: {
          organizationId: session.organizationId,
          itemId,
          toLocationId: action === 'remove' ? null : location.id,
          fromLocationId: action === 'remove' ? location.id : null,
          quantity: Math.abs(quantity || 0),
          transactionType: 'ADJUSTMENT',
          performedById: session.userId,
          notes: notes || `Ajuste de inventario en vehículo ${vehicle.plateNumber}`,
        },
      });
    }

    // Check for low stock alert
    let alert = null;
    if (stock && stock.quantity <= stock.item.minStockLevel) {
      alert = {
        type: stock.quantity <= 0 ? 'OUT' : 'LOW',
        message: stock.quantity <= 0
          ? `${stock.item.name} está agotado en el vehículo`
          : `${stock.item.name} tiene stock bajo (${stock.quantity} ${stock.item.unit})`,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        stock,
        alert,
      },
      message: stock
        ? `Inventario actualizado: ${stock.item.name} = ${stock.quantity} ${stock.item.unit}`
        : 'Artículo removido del inventario del vehículo',
    });
  } catch (error) {
    console.error('Vehicle inventory update error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando inventario del vehículo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vehicles/[id]/inventory
 * Remove item from vehicle inventory
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id: vehicleId } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only owners can remove items
    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const stockId = searchParams.get('stockId');

    if (!stockId) {
      return NextResponse.json(
        { success: false, error: 'ID de stock es requerido' },
        { status: 400 }
      );
    }

    // Verify vehicle belongs to organization
    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        organizationId: session.organizationId,
      },
    });

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    // Get stock entry with location verification
    const stock = await prisma.inventoryStock.findFirst({
      where: {
        id: stockId,
        location: {
          vehicleId,
          organizationId: session.organizationId,
        },
      },
      include: {
        item: {
          select: { name: true },
        },
      },
    });

    if (!stock) {
      return NextResponse.json(
        { success: false, error: 'Registro de stock no encontrado' },
        { status: 404 }
      );
    }

    // Delete the stock entry
    await prisma.inventoryStock.delete({
      where: { id: stockId },
    });

    return NextResponse.json({
      success: true,
      message: `${stock.item.name} removido del inventario del vehículo`,
    });
  } catch (error) {
    console.error('Vehicle inventory deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando artículo del inventario' },
      { status: 500 }
    );
  }
}
