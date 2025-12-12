/**
 * Single Vehicle API Route
 * GET /api/vehicles/[id] - Get vehicle details
 * PUT /api/vehicles/[id] - Update vehicle
 * DELETE /api/vehicles/[id] - Delete vehicle
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Check if error is related to missing table
function isTableNotFoundError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2021'
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Try full query with related tables, fall back to basic query if tables don't exist
    let vehicle: any = null;
    try {
      vehicle = await prisma.vehicle.findFirst({
        where: {
          id,
          organizationId: session.organizationId,
        },
        include: {
          assignments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatar: true,
                  phone: true,
                  specialty: true,
                },
              },
            },
            orderBy: { assignedFrom: 'desc' },
          },
          documents: {
            include: {
              uploadedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { uploadedAt: 'desc' },
          },
          maintenanceLogs: {
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });
    } catch (queryError) {
      // If related tables don't exist, query without them
      if (isTableNotFoundError(queryError)) {
        vehicle = await prisma.vehicle.findFirst({
          where: {
            id,
            organizationId: session.organizationId,
          },
        });
        // Add empty arrays for missing relations
        if (vehicle) {
          vehicle.assignments = [];
          vehicle.documents = [];
          vehicle.maintenanceLogs = [];
        }
      } else {
        throw queryError;
      }
    }

    if (!vehicle) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    // Calculate compliance alerts
    const now = new Date();
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const complianceAlerts: string[] = [];

    if (vehicle.insuranceExpiry) {
      if (vehicle.insuranceExpiry < now) {
        complianceAlerts.push('Seguro vencido');
      } else if (vehicle.insuranceExpiry < thirtyDaysFromNow) {
        complianceAlerts.push('Seguro por vencer');
      }
    }

    if (vehicle.vtvExpiry) {
      if (vehicle.vtvExpiry < now) {
        complianceAlerts.push('VTV vencida');
      } else if (vehicle.vtvExpiry < thirtyDaysFromNow) {
        complianceAlerts.push('VTV por vencer');
      }
    }

    if (vehicle.registrationExpiry) {
      if (vehicle.registrationExpiry < now) {
        complianceAlerts.push('Registro vencido');
      } else if (vehicle.registrationExpiry < thirtyDaysFromNow) {
        complianceAlerts.push('Registro por vencer');
      }
    }

    // Add expiry status to documents
    const documentsWithStatus = vehicle.documents.map((doc: { expiryDate?: Date | null; [key: string]: unknown }) => {
      let expiryStatus: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry' = 'no_expiry';

      if (doc.expiryDate) {
        if (doc.expiryDate < now) {
          expiryStatus = 'expired';
        } else if (doc.expiryDate < thirtyDaysFromNow) {
          expiryStatus = 'expiring_soon';
        } else {
          expiryStatus = 'valid';
        }
      }

      return {
        ...doc,
        expiryStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...vehicle,
        documents: documentsWithStatus,
        complianceAlerts,
        isCompliant: complianceAlerts.length === 0,
      },
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo vehículo' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: 'No tienes permiso para editar vehículos' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verify vehicle exists and belongs to organization
    const existing = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    const {
      plateNumber,
      make,
      model,
      year,
      vin,
      color,
      status,
      fuelType,
      currentMileage,
      insuranceCompany,
      insurancePolicyNumber,
      insuranceExpiry,
      vtvExpiry,
      registrationExpiry,
      lastServiceDate,
      nextServiceDate,
      nextServiceMileage,
      notes,
    } = body;

    const vehicle = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(plateNumber && { plateNumber: plateNumber.toUpperCase() }),
        ...(make && { make }),
        ...(model && { model }),
        ...(year && { year: parseInt(year) }),
        ...(vin !== undefined && { vin }),
        ...(color !== undefined && { color }),
        ...(status && { status }),
        ...(fuelType && { fuelType }),
        ...(currentMileage !== undefined && {
          currentMileage: currentMileage ? parseInt(currentMileage) : null,
        }),
        ...(insuranceCompany !== undefined && { insuranceCompany }),
        ...(insurancePolicyNumber !== undefined && { insurancePolicyNumber }),
        ...(insuranceExpiry !== undefined && {
          insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : null,
        }),
        ...(vtvExpiry !== undefined && {
          vtvExpiry: vtvExpiry ? new Date(vtvExpiry) : null,
        }),
        ...(registrationExpiry !== undefined && {
          registrationExpiry: registrationExpiry ? new Date(registrationExpiry) : null,
        }),
        ...(lastServiceDate !== undefined && {
          lastServiceDate: lastServiceDate ? new Date(lastServiceDate) : null,
        }),
        ...(nextServiceDate !== undefined && {
          nextServiceDate: nextServiceDate ? new Date(nextServiceDate) : null,
        }),
        ...(nextServiceMileage !== undefined && {
          nextServiceMileage: nextServiceMileage ? parseInt(nextServiceMileage) : null,
        }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({
      success: true,
      data: vehicle,
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando vehículo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
        { success: false, error: 'No tienes permiso para eliminar vehículos' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verify vehicle exists and belongs to organization
    const existing = await prisma.vehicle.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Vehículo no encontrado' },
        { status: 404 }
      );
    }

    await prisma.vehicle.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Vehículo eliminado correctamente',
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando vehículo' },
      { status: 500 }
    );
  }
}
