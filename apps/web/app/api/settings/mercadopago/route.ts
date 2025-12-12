/**
 * MercadoPago Settings API Route
 * GET /api/settings/mercadopago - Get MercadoPago configuration
 * PUT /api/settings/mercadopago - Update MercadoPago configuration
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

    const mpSettings = settings.mercadopago || {};

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: !!mpSettings.accessToken,
        hasAccessToken: !!mpSettings.accessToken,
        hasPublicKey: !!mpSettings.publicKey,
        environment: mpSettings.environment || 'sandbox', // 'sandbox' or 'production'
        webhookConfigured: !!mpSettings.webhookUrl,
        // Never return the actual tokens, only boolean flags
      },
    });
  } catch (error) {
    console.error('Get MercadoPago settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración MercadoPago' },
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

    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar configuración MercadoPago' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { accessToken, publicKey, environment } = body;

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

    // Merge MercadoPago settings
    const newMpSettings = {
      ...currentSettings.mercadopago,
      ...(accessToken !== undefined && { accessToken }),
      ...(publicKey !== undefined && { publicKey }),
      ...(environment !== undefined && { environment }),
      updatedAt: new Date().toISOString(),
    };

    // Update organization settings
    await prisma.organization.update({
      where: { id: session.organizationId },
      data: {
        settings: {
          ...currentSettings,
          mercadopago: newMpSettings,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: !!newMpSettings.accessToken,
        hasAccessToken: !!newMpSettings.accessToken,
        hasPublicKey: !!newMpSettings.publicKey,
        environment: newMpSettings.environment || 'sandbox',
      },
      message: 'Configuración MercadoPago actualizada correctamente',
    });
  } catch (error) {
    console.error('Update MercadoPago settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración MercadoPago' },
      { status: 500 }
    );
  }
}
