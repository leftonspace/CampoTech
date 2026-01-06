/**
 * Organization API Route
 * GET /api/organization - Get current organization details
 * PUT /api/organization - Update organization details
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

export async function GET() {
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

    // Normalize user role to uppercase for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Build organization data object
    const orgData = {
      id: organization.id,
      name: organization.name,
      cuit: settings.cuit || '',
      razonSocial: settings.razonSocial || '',
      tipoSociedad: settings.tipoSociedad || '',
      ivaCondition: settings.ivaCondition || 'RESPONSABLE_INSCRIPTO',
      puntoVentaAfip: settings.puntoVentaAfip || '',
      fechaInscripcionAfip: settings.fechaInscripcionAfip || '',
      ingresosBrutos: settings.ingresosBrutos || '',
      domicilioFiscal: settings.domicilioFiscal || settings.address || {},
      direccionComercial: settings.direccionComercial || settings.address || {},
      nombreComercial: settings.nombreComercial || organization.name,
      phone: organization.phone || '',
      email: organization.email || '',
      logo: organization.logo || '',
      horariosAtencion: settings.horariosAtencion || '',
      activityStartDate: settings.activityStartDate || '',
      // Restricted fields (only visible to OWNER)
      cbu: settings.cbu || '',
      cbuAlias: settings.cbuAlias || '',
      mpAccessToken: settings.mpAccessToken || '',
      // AFIP credentials are now stored encrypted - use /api/settings/afip instead
      hasAfipConfigured: !!organization.afipCertificateEncrypted,
    };

    // Filter data based on user role
    const filteredData = filterEntityByRole(orgData, 'organization', userRole);
    const fieldMeta = getEntityFieldMetadata('organization', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
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

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Only admins and owners can update organization
    if (!['OWNER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar la organizacion' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(body, 'organization', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

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
