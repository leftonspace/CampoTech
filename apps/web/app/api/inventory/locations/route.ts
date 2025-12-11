/**
 * Inventory Locations API Route
 * GET /api/inventory/locations - List locations (warehouses, vehicles)
 * POST /api/inventory/locations - Create new location
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { InventoryLocationType } from '@prisma/client';

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
    const locationType = searchParams.get('type') as InventoryLocationType | null;
    const includeVehicles = searchParams.get('includeVehicles') !== 'false';
    const includeStock = searchParams.get('includeStock') === 'true';

    // Get inventory locations
    const locations = await prisma.inventoryLocation.findMany({
      where: {
        organizationId: session.organizationId,
        ...(locationType ? { locationType } : {}),
      },
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
        ...(includeStock
          ? {
              stocks: {
                include: {
                  item: {
                    select: {
                      id: true,
                      name: true,
                      sku: true,
                      unit: true,
                    },
                  },
                },
              },
            }
          : {}),
        _count: {
          select: {
            stocks: true,
          },
        },
      },
      orderBy: [{ locationType: 'asc' }, { name: 'asc' }],
    });

    // Calculate stats
    const stats = {
      total: locations.length,
      warehouses: locations.filter((l) => l.locationType === 'WAREHOUSE').length,
      vehicles: locations.filter((l) => l.locationType === 'VEHICLE').length,
      hubs: locations.filter((l) => l.locationType === 'HUB').length,
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

    // Only admins and owners can create locations
    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta operación' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, locationType, address, vehicleId, isActive = true } = body;

    // Validate required fields
    if (!name || !locationType) {
      return NextResponse.json(
        { success: false, error: 'Nombre y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['HUB', 'VEHICLE', 'WAREHOUSE'];
    if (!validTypes.includes(locationType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de ubicación inválido' },
        { status: 400 }
      );
    }

    // If vehicle type, verify vehicle exists and belongs to org
    if (locationType === 'VEHICLE' && vehicleId) {
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

      // Check if vehicle already has a location
      const existingLocation = await prisma.inventoryLocation.findFirst({
        where: { vehicleId },
      });

      if (existingLocation) {
        return NextResponse.json(
          { success: false, error: 'Este vehículo ya tiene una ubicación de inventario asignada' },
          { status: 400 }
        );
      }
    }

    const location = await prisma.inventoryLocation.create({
      data: {
        organizationId: session.organizationId,
        name,
        locationType: locationType as InventoryLocationType,
        address: address || null,
        vehicleId: locationType === 'VEHICLE' ? vehicleId : null,
        isActive,
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
      data: location,
    });
  } catch (error) {
    console.error('Create inventory location error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando ubicación' },
      { status: 500 }
    );
  }
}
