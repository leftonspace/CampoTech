/**
 * Vehicles API Route
 * GET /api/vehicles - List all vehicles
 * POST /api/vehicles - Create a new vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';
import { createVehicleWarehouse } from '@/lib/services/vehicle-storage';

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { plateNumber: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ];
    }

    let vehicles: any[] = [];
    try {
      vehicles = await prisma.vehicle.findMany({
        where,
        include: {
          assignments: {
            where: {
              OR: [
                { assignedUntil: null },
                { assignedUntil: { gt: new Date() } },
              ],
            },
            include: {
              user: true,
            },
          },
          documents: {
            orderBy: { uploadedAt: 'desc' },
            take: 5,
          },
          _count: {
            select: {
              documents: true,
              maintenanceLogs: true,
            },
          },
        },
        orderBy: { plateNumber: 'asc' },
      });
    } catch (queryError) {
      // Handle missing table gracefully - return empty data
      if (isTableNotFoundError(queryError)) {
        console.warn('Vehicles table not found - returning empty data. Run database migrations to create tables.');
        return NextResponse.json({
          success: true,
          data: {
            vehicles: [],
            stats: {
              total: 0,
              active: 0,
              maintenance: 0,
              inactive: 0,
              withAlerts: 0,
            },
          },
          _notice: 'Fleet management tables not yet created. Run database migrations.',
        });
      }
      throw queryError;
    }

    // Calculate compliance status
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const vehiclesWithCompliance = vehicles.map((vehicle) => {
      const alerts: string[] = [];

      if (vehicle.insuranceExpiry && vehicle.insuranceExpiry < now) {
        alerts.push('insurance_expired');
      } else if (vehicle.insuranceExpiry && vehicle.insuranceExpiry < thirtyDaysFromNow) {
        alerts.push('insurance_expiring');
      }

      if (vehicle.vtvExpiry && vehicle.vtvExpiry < now) {
        alerts.push('vtv_expired');
      } else if (vehicle.vtvExpiry && vehicle.vtvExpiry < thirtyDaysFromNow) {
        alerts.push('vtv_expiring');
      }

      if (vehicle.registrationExpiry && vehicle.registrationExpiry < now) {
        alerts.push('registration_expired');
      } else if (vehicle.registrationExpiry && vehicle.registrationExpiry < thirtyDaysFromNow) {
        alerts.push('registration_expiring');
      }

      // Sanitize user data in assignments
      const sanitizedAssignments = vehicle.assignments.map((assignment: { user?: { id: string; name: string; avatar?: string; phone: string } | null; [key: string]: unknown }) => ({
        ...assignment,
        user: assignment.user ? {
          id: assignment.user.id,
          name: assignment.user.name,
          avatar: assignment.user.avatar,
          phone: assignment.user.phone,
        } : null,
      }));

      return {
        ...vehicle,
        assignments: sanitizedAssignments,
        complianceAlerts: alerts,
        isCompliant: alerts.filter((a) => a.includes('expired')).length === 0,
      };
    });

    // Stats
    const stats = {
      total: vehicles.length,
      active: vehicles.filter((v) => v.status === 'ACTIVE').length,
      maintenance: vehicles.filter((v) => v.status === 'MAINTENANCE').length,
      inactive: vehicles.filter((v) => v.status === 'INACTIVE').length,
      withAlerts: vehiclesWithCompliance.filter((v) => v.complianceAlerts.length > 0).length,
    };

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'VIEWER') as UserRole;

    // Filter data based on user role
    const filteredVehicles = filterEntitiesByRole(vehiclesWithCompliance, 'vehicle', userRole);
    const fieldMeta = getEntityFieldMetadata('vehicle', userRole);

    return NextResponse.json({
      success: true,
      data: {
        vehicles: filteredVehicles,
        stats,
      },
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get vehicles error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo vehículos' },
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

    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para crear vehículos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      plateNumber,
      make,
      model,
      year,
      vin,
      color,
      fuelType,
      currentMileage,
      insuranceCompany,
      insurancePolicyNumber,
      insuranceExpiry,
      vtvExpiry,
      registrationExpiry,
      notes,
    } = body;

    if (!plateNumber || !make || !model || !year) {
      return NextResponse.json(
        { success: false, error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Check if plate number already exists
    const existing = await prisma.vehicle.findFirst({
      where: {
        organizationId: session.organizationId,
        plateNumber: plateNumber.toUpperCase(),
      },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Ya existe un vehículo con esta patente' },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        organizationId: session.organizationId,
        plateNumber: plateNumber.toUpperCase(),
        make,
        model,
        year: parseInt(year),
        vin: vin || null,
        color: color || null,
        fuelType: fuelType || 'GASOLINE',
        currentMileage: currentMileage ? parseInt(currentMileage) : null,
        insuranceCompany: insuranceCompany || null,
        insurancePolicyNumber: insurancePolicyNumber || null,
        insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        vtvExpiry: vtvExpiry ? new Date(vtvExpiry) : null,
        registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
        notes: notes || null,
        status: 'ACTIVE',
      },
    });

    // Auto-create warehouse storage location for this vehicle
    try {
      const vehicleName = `${make} ${model} (${plateNumber.toUpperCase()})`;
      await createVehicleWarehouse(
        vehicle.id,
        vehicleName,
        plateNumber.toUpperCase(),
        session.organizationId
      );
    } catch (warehouseError) {
      // Log but don't fail the vehicle creation
      console.warn('Failed to create warehouse for vehicle:', warehouseError);
    }

    return NextResponse.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    // Handle missing table gracefully
    if (isTableNotFoundError(error)) {
      console.warn('Vehicles table not found - cannot create vehicle. Run database migrations to create tables.');
      return NextResponse.json(
        {
          success: false,
          error: 'La gestión de flota no está disponible todavía. Contacte al administrador.',
          _notice: 'Fleet management tables not yet created. Run database migrations.'
        },
        { status: 503 }
      );
    }
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Create vehicle error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error creando vehículo' },
      { status: 500 }
    );
  }
}
