/**
 * Organization API Route
 * GET /api/organization - Get current organization details
 * PUT /api/organization - Update organization details
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

    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Parse settings JSON if it exists
    const settings = typeof organization.settings === 'string'
      ? JSON.parse(organization.settings)
      : organization.settings || {};

    return NextResponse.json({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        cuit: settings.cuit || '',
        address: {
          street: settings.address?.street || '',
          city: settings.address?.city || '',
          province: settings.address?.province || '',
          postalCode: settings.address?.postalCode || '',
        },
        phone: organization.phone || '',
        email: organization.email || '',
        ivaCondition: settings.ivaCondition || 'RESPONSABLE_INSCRIPTO',
        activityStartDate: settings.activityStartDate || '',
        logoUrl: organization.logo || '',
      },
    });
  } catch (error) {
    console.error('Get organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo organización' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins can update organization
    if (!['ADMIN', 'OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar la organización' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, cuit, address, phone, email, ivaCondition, activityStartDate, logoUrl } = body;

    // Get current organization to merge settings
    const currentOrg = await prisma.organization.findUnique({
      where: { id: session.organizationId },
    });

    if (!currentOrg) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Parse existing settings
    const currentSettings = typeof currentOrg.settings === 'string'
      ? JSON.parse(currentOrg.settings)
      : currentOrg.settings || {};

    // Merge new data into settings
    const newSettings = {
      ...currentSettings,
      cuit: cuit || currentSettings.cuit,
      address: address || currentSettings.address,
      ivaCondition: ivaCondition || currentSettings.ivaCondition,
      activityStartDate: activityStartDate || currentSettings.activityStartDate,
    };

    const organization = await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(logoUrl !== undefined && { logo: logoUrl }),
        settings: newSettings,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: organization.id,
        name: organization.name,
        cuit: newSettings.cuit || '',
        address: newSettings.address || {},
        phone: organization.phone || '',
        email: organization.email || '',
        ivaCondition: newSettings.ivaCondition || 'RESPONSABLE_INSCRIPTO',
        activityStartDate: newSettings.activityStartDate || '',
        logoUrl: organization.logo || '',
      },
      message: 'Organización actualizada correctamente',
    });
  } catch (error) {
    console.error('Update organization error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando organización' },
      { status: 500 }
    );
  }
}
