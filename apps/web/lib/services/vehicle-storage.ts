/**
 * Vehicle Storage Service
 * Manages the automatic creation and synchronization of warehouse storage locations
 * for vehicles in the fleet.
 */

import { prisma, TransactionClient } from '@/lib/prisma';

/**
 * Creates a warehouse storage location for a vehicle when it's added to the fleet.
 * The warehouse will be of type VEHICLE and linked to the vehicle via vehicleId.
 */
export async function createVehicleWarehouse(
  vehicleId: string,
  vehicleName: string,
  plateNumber: string,
  organizationId: string,
  tx?: TransactionClient
): Promise<{ id: string; code: string } | null> {
  const db = tx || prisma;

  // Check if warehouse already exists for this vehicle
  const existing = await db.warehouse.findFirst({
    where: { vehicleId, organizationId },
    select: { id: true, code: true },
  });

  if (existing) {
    return existing;
  }

  // Generate unique code for the vehicle warehouse
  const code = `VEH-${plateNumber.replace(/\s+/g, '').toUpperCase()}`;

  // Create warehouse for the vehicle
  const warehouse = await db.warehouse.create({
    data: {
      organizationId,
      name: vehicleName || `Vehículo ${plateNumber}`,
      code,
      type: 'VEHICLE',
      vehicleId,
      isActive: true,
      isDefault: false,
      allowNegative: false,
    },
    select: { id: true, code: true },
  });

  return warehouse;
}

/**
 * Updates vehicle warehouse name when vehicle is renamed.
 */
export async function updateVehicleWarehouseName(
  vehicleId: string,
  newName: string,
  newPlateNumber?: string
): Promise<void> {
  const updateData: { name: string; code?: string } = { name: newName };

  if (newPlateNumber) {
    updateData.code = `VEH-${newPlateNumber.replace(/\s+/g, '').toUpperCase()}`;
  }

  await prisma.warehouse.updateMany({
    where: { vehicleId },
    data: updateData,
  });
}

/**
 * Deactivates vehicle warehouse when vehicle is removed or retired.
 * Note: We don't delete to preserve inventory history.
 */
export async function deactivateVehicleWarehouse(
  vehicleId: string
): Promise<void> {
  await prisma.warehouse.updateMany({
    where: { vehicleId },
    data: { isActive: false },
  });
}

/**
 * Reactivates vehicle warehouse when vehicle is restored.
 */
export async function reactivateVehicleWarehouse(
  vehicleId: string
): Promise<void> {
  await prisma.warehouse.updateMany({
    where: { vehicleId },
    data: { isActive: true },
  });
}

/**
 * Syncs all existing vehicles to have warehouse storage locations.
 * Run once to backfill existing fleet.
 */
export async function syncAllVehicleWarehouses(
  organizationId: string
): Promise<{ created: number; skipped: number; errors: string[] }> {
  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId, status: { not: 'RETIRED' } },
    select: {
      id: true,
      plateNumber: true,
      make: true,
      model: true,
      warehouse: { select: { id: true } },
    },
  });

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const vehicle of vehicles) {
    // Skip if warehouse already exists
    if (vehicle.warehouse) {
      skipped++;
      continue;
    }

    try {
      const vehicleName = `${vehicle.make} ${vehicle.model} (${vehicle.plateNumber})`;
      await createVehicleWarehouse(
        vehicle.id,
        vehicleName,
        vehicle.plateNumber,
        organizationId
      );
      created++;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Vehicle ${vehicle.plateNumber}: ${message}`);
    }
  }

  return { created, skipped, errors };
}

/**
 * Gets all warehouses grouped by type for UI display.
 */
export async function getWarehousesByType(organizationId: string) {
  const warehouses = await prisma.warehouse.findMany({
    where: { organizationId, isActive: true },
    include: {
      vehicle: {
        select: {
          id: true,
          plateNumber: true,
          make: true,
          model: true,
          status: true,
        },
      },
      _count: {
        select: { inventoryLevels: true },
      },
    },
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  // Separate into office (non-vehicle) and vehicle warehouses
  const officeWarehouses = warehouses.filter((w: typeof warehouses[number]) => w.type !== 'VEHICLE');
  const vehicleWarehouses = warehouses.filter((w: typeof warehouses[number]) => w.type === 'VEHICLE');

  return {
    all: warehouses,
    office: officeWarehouses,
    vehicle: vehicleWarehouses,
    counts: {
      total: warehouses.length,
      office: officeWarehouses.length,
      vehicle: vehicleWarehouses.length,
    },
  };
}
