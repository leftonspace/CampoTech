import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface WarehouseWithRelations {
  id: string;
  name: string;
  type: string;
  address: string | null;
  isActive: boolean;
  vehicle?: {
    id: string;
    plateNumber: string;
    make: string;
    model: string;
  } | null;
  _count: {
    inventoryLevels: number;
  };
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const includeVehicles = searchParams.get('includeVehicles') !== 'false';

    // Map InventoryLocation.locationType to WarehouseType where possible
    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
      isActive: true,
    };

    if (type) {
      where.type = type === 'HUB' ? 'SECONDARY' : type;
    }

    const warehouses = await prisma.warehouse.findMany({
      where,
      include: {
        vehicle: includeVehicles
          ? {
            select: {
              id: true,
              plateNumber: true,
              make: true,
              model: true,
            },
          }
          : false,
        _count: {
          select: {
            inventoryLevels: true,
          },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Map Warehouse model to the format expected by the frontend (InventoryLocation mockup)
    const locations = warehouses.map((w: WarehouseWithRelations) => ({
      id: w.id,
      name: w.name,
      locationType: w.type === 'SECONDARY' ? 'HUB' : w.type,
      address: w.address,
      isActive: w.isActive,
      vehicle: w.vehicle,
      stocks: [], // Simplified for now as full stock list is heavy
      _count: {
        stocks: w._count.inventoryLevels,
      }
    }));

    type LocationEntry = (typeof locations)[number];
    const stats = {
      total: locations.length,
      warehouses: locations.filter((l: LocationEntry) => l.locationType === 'MAIN' || l.locationType === 'WAREHOUSE').length,
      vehicles: locations.filter((l: LocationEntry) => l.locationType === 'VEHICLE').length,
      hubs: locations.filter((l: LocationEntry) => l.locationType === 'HUB' || l.locationType === 'SECONDARY').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        locations,
        stats,
      },
    });
  } catch (error) {
    console.error('Inventory locations list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error cargando ubicaciones' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, locationType, address, vehicleId, isActive = true, code } = body;

    if (!name || !locationType) {
      return NextResponse.json(
        { success: false, error: 'Nombre y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Map locationType to WarehouseType
    const mappedType = locationType === 'HUB' ? 'SECONDARY' : locationType as string;

    const warehouse = await prisma.warehouse.create({
      data: {
        organizationId: session.organizationId,
        name,
        type: mappedType,
        address: address || null,
        vehicleId: mappedType === 'VEHICLE' ? vehicleId : null,
        isActive,
        code: code || `W-${Date.now()}`,
      },
      include: {
        vehicle: {
          select: {
            id: true,
            plateNumber: true,
            make: true,
            model: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...warehouse,
        locationType: warehouse.type === 'SECONDARY' ? 'HUB' : warehouse.type,
      },
    });
  } catch (error) {
    console.error('Create warehouse error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando ubicación' },
      { status: 500 }
    );
  }
}
