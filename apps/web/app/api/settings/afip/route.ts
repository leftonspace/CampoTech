/**
 * AFIP Settings API Route
 * GET /api/settings/afip - Get AFIP configuration
 * PUT /api/settings/afip - Update AFIP configuration
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

    // Parse settings JSON
    const settings = typeof organization.settings === 'string'
      ? JSON.parse(organization.settings)
      : organization.settings || {};

    const afipSettings = settings.afip || {};

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: !!afipSettings.cuit && !!afipSettings.certificate,
        cuit: afipSettings.cuit || '',
        puntoVenta: afipSettings.puntoVenta || '',
        environment: afipSettings.environment || 'testing', // 'testing' or 'production'
        hasCertificate: !!afipSettings.certificate,
        hasPrivateKey: !!afipSettings.privateKey,
        certificateExpiry: afipSettings.certificateExpiry || null,
        lastSync: afipSettings.lastSync || null,
      },
    });
  } catch (error) {
    console.error('Get AFIP settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración AFIP' },
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

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar configuración AFIP' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { cuit, puntoVenta, environment, certificate, privateKey } = body;

    // Get current organization settings
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Parse existing settings
    const currentSettings = typeof organization.settings === 'string'
      ? JSON.parse(organization.settings)
      : organization.settings || {};

    // Merge AFIP settings
    const newAfipSettings = {
      ...currentSettings.afip,
      ...(cuit !== undefined && { cuit }),
      ...(puntoVenta !== undefined && { puntoVenta }),
      ...(environment !== undefined && { environment }),
      ...(certificate !== undefined && { certificate }),
      ...(privateKey !== undefined && { privateKey }),
      updatedAt: new Date().toISOString(),
    };

    // Update organization settings
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        settings: {
          ...currentSettings,
          afip: newAfipSettings,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: !!newAfipSettings.cuit && !!newAfipSettings.certificate,
        cuit: newAfipSettings.cuit || '',
        puntoVenta: newAfipSettings.puntoVenta || '',
        environment: newAfipSettings.environment || 'testing',
        hasCertificate: !!newAfipSettings.certificate,
        hasPrivateKey: !!newAfipSettings.privateKey,
      },
      message: 'Configuración AFIP actualizada correctamente',
    });
  } catch (error) {
    console.error('Update AFIP settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración AFIP' },
      { status: 500 }
    );
  }
}
