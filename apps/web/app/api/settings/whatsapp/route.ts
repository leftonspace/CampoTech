/**
 * WhatsApp Settings API Route
 *
 * Handles WhatsApp integration settings for organizations:
 * - Personal number for wa.me links (INICIAL tier)
 * - Meta Business API credentials (future BSP integration)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { isValidWhatsAppNumber, formatPhoneForDisplay } from '@/lib/whatsapp-links';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        whatsappPersonalNumber: true,
        whatsappIntegrationType: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessAccountId: true,
        whatsappAccessToken: true,
        whatsappWebhookVerifyToken: true,
        whatsappAppSecret: true,
        subscriptionTier: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Determine what's configured
    const hasPersonalNumber = !!organization.whatsappPersonalNumber;
    const hasBspCredentials = !!(
      organization.whatsappPhoneNumberId &&
      organization.whatsappBusinessAccountId &&
      organization.whatsappAccessToken
    );

    // Format the personal number for display
    const displayPersonalNumber = organization.whatsappPersonalNumber
      ? formatPhoneForDisplay(organization.whatsappPersonalNumber)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        // Integration type and status
        integrationType: organization.whatsappIntegrationType,
        isConfigured: hasPersonalNumber || hasBspCredentials,

        // Personal number (wa.me links)
        personalNumber: organization.whatsappPersonalNumber,
        displayPersonalNumber,
        hasPersonalNumber,

        // BSP credentials status (don't expose actual tokens)
        hasBspCredentials,
        hasPhoneNumberId: !!organization.whatsappPhoneNumberId,
        hasBusinessAccountId: !!organization.whatsappBusinessAccountId,
        hasAccessToken: !!organization.whatsappAccessToken,
        hasAppSecret: !!organization.whatsappAppSecret,
        hasWebhookVerifyToken: !!organization.whatsappWebhookVerifyToken,

        // Subscription info for feature gating
        subscriptionTier: organization.subscriptionTier,
        canUseBsp: ['PROFESIONAL', 'EMPRESA'].includes(organization.subscriptionTier),
      },
    });
  } catch (error) {
    console.error('WhatsApp settings get error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only owners can modify WhatsApp settings
    if (!['OWNER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede modificar la configuración de WhatsApp' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      personalNumber,
      integrationType,
      // BSP credentials (for future use)
      phoneNumberId,
      businessAccountId,
      accessToken,
      appSecret,
      webhookVerifyToken,
    } = body;

    // Get current organization
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        subscriptionTier: true,
        whatsappIntegrationType: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Build update data
    const updateData: Record<string, any> = {};

    // Handle personal number update
    if (personalNumber !== undefined) {
      if (personalNumber === '' || personalNumber === null) {
        // Clear personal number
        updateData.whatsappPersonalNumber = null;
        if (integrationType === undefined) {
          updateData.whatsappIntegrationType = 'NONE';
        }
      } else {
        // Validate phone number
        if (!isValidWhatsAppNumber(personalNumber)) {
          return NextResponse.json(
            { success: false, error: 'Número de teléfono inválido. Ingresá un número válido con código de país.' },
            { status: 400 }
          );
        }

        // Normalize and save
        const normalizedNumber = personalNumber.replace(/\D/g, '');
        updateData.whatsappPersonalNumber = normalizedNumber;

        // Auto-set integration type to WAME_LINK if not BSP
        if (!['BSP_API'].includes(integrationType || organization.whatsappIntegrationType)) {
          updateData.whatsappIntegrationType = 'WAME_LINK';
        }
      }
    }

    // Handle integration type update
    if (integrationType !== undefined) {
      // Validate BSP_API requires PROFESIONAL or higher
      if (integrationType === 'BSP_API' && !['PROFESIONAL', 'EMPRESA'].includes(organization.subscriptionTier)) {
        return NextResponse.json(
          { success: false, error: 'La integración BSP requiere un plan Profesional o superior' },
          { status: 403 }
        );
      }
      updateData.whatsappIntegrationType = integrationType;
    }

    // Handle BSP credentials (for PROFESIONAL+ tiers)
    if (phoneNumberId !== undefined || businessAccountId !== undefined || accessToken !== undefined) {
      // Check subscription tier
      if (!['PROFESIONAL', 'EMPRESA'].includes(organization.subscriptionTier)) {
        return NextResponse.json(
          { success: false, error: 'La configuración de WhatsApp Business API requiere un plan Profesional o superior' },
          { status: 403 }
        );
      }

      if (phoneNumberId !== undefined) updateData.whatsappPhoneNumberId = phoneNumberId || null;
      if (businessAccountId !== undefined) updateData.whatsappBusinessAccountId = businessAccountId || null;
      if (accessToken !== undefined) updateData.whatsappAccessToken = accessToken || null;
      if (appSecret !== undefined) updateData.whatsappAppSecret = appSecret || null;
      if (webhookVerifyToken !== undefined) updateData.whatsappWebhookVerifyToken = webhookVerifyToken || null;

      // Auto-set integration type to BSP_API if credentials are being set
      if (phoneNumberId && businessAccountId && accessToken) {
        updateData.whatsappIntegrationType = 'BSP_API';
      }
    }

    // Update organization
    const updated = await prisma.organization.update({
      where: { id: session.organizationId },
      data: updateData,
      select: {
        whatsappPersonalNumber: true,
        whatsappIntegrationType: true,
        whatsappPhoneNumberId: true,
        whatsappBusinessAccountId: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        personalNumber: updated.whatsappPersonalNumber,
        integrationType: updated.whatsappIntegrationType,
        isConfigured: !!(updated.whatsappPersonalNumber || updated.whatsappPhoneNumberId),
      },
      message: 'Configuración de WhatsApp actualizada correctamente',
    });
  } catch (error) {
    console.error('WhatsApp settings save error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al guardar la configuración' },
      { status: 500 }
    );
  }
}
