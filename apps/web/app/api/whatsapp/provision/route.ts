/**
 * WhatsApp Number Provisioning API
 * =================================
 *
 * Endpoints for provisioning and managing WhatsApp numbers via 360dialog.
 *
 * POST /api/whatsapp/provision - Start provisioning a number
 * DELETE /api/whatsapp/provision - Release a provisioned number
 * GET /api/whatsapp/provision - Get provisioning status
 *
 * Requirements:
 * - User must be authenticated
 * - Organization must be on PROFESIONAL tier or above
 * - 360dialog partner credentials must be configured
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function getDialog360Provider(): Dialog360Provider | null {
  const apiKey = process.env.DIALOG360_PARTNER_API_KEY;
  const partnerId = process.env.DIALOG360_PARTNER_ID;

  if (!apiKey || !partnerId) {
    return null;
  }

  return new Dialog360Provider({
    apiKey,
    partnerId,
    webhookSecret: process.env.DIALOG360_WEBHOOK_SECRET,
  });
}

// Tiers that support BSP provisioning
const PROVISIONING_TIERS = ['PROFESIONAL', 'EMPRESARIAL', 'ENTERPRISE'];

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Start Provisioning
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get organization subscription
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        id: true,
        subscription: {
          select: { tier: true },
        },
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organización no encontrada' },
        { status: 404 }
      );
    }

    // Check subscription tier
    const tier = org.subscription?.tier || 'FREE';
    if (!PROVISIONING_TIERS.includes(tier)) {
      return NextResponse.json(
        {
          error: 'Tu plan actual no incluye aprovisionamiento de números WhatsApp',
          requiredTier: 'PROFESIONAL',
          currentTier: tier,
        },
        { status: 403 }
      );
    }

    // Get provider
    const provider = getDialog360Provider();
    if (!provider) {
      return NextResponse.json(
        { error: 'Servicio de aprovisionamiento no configurado' },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Número de teléfono requerido' },
        { status: 400 }
      );
    }

    // Check if organization already has a provisioned number
    const existingAccount = await prisma.whatsAppBusinessAccount.findUnique({
      where: { organizationId: session.organizationId },
      select: { provisioningStatus: true, displayPhoneNumber: true },
    });

    if (existingAccount && ['ACTIVE', 'VERIFIED', 'VERIFICATION_PENDING'].includes(existingAccount.provisioningStatus)) {
      return NextResponse.json(
        {
          error: 'Ya tienes un número de WhatsApp aprovisionado',
          currentNumber: existingAccount.displayPhoneNumber,
          status: existingAccount.provisioningStatus,
        },
        { status: 409 }
      );
    }

    // Provision the number
    const result = await provider.provisionNumber(session.organizationId, phoneNumber);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Error al aprovisionar el número' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      phoneNumber: result.phoneNumber,
      displayNumber: result.displayNumber,
      status: result.status,
      nextStep: result.nextStep,
    });

  } catch (error) {
    console.error('[Provision API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE - Release Number
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if organization has a provisioned number
    const account = await prisma.whatsAppBusinessAccount.findUnique({
      where: { organizationId: session.organizationId },
      select: { bspProvider: true, provisioningStatus: true },
    });

    if (!account || account.bspProvider !== 'DIALOG_360') {
      return NextResponse.json(
        { error: 'No tienes un número aprovisionado por 360dialog' },
        { status: 404 }
      );
    }

    if (account.provisioningStatus === 'RELEASED') {
      return NextResponse.json(
        { error: 'El número ya fue liberado' },
        { status: 400 }
      );
    }

    // Get provider
    const provider = getDialog360Provider();
    if (!provider) {
      return NextResponse.json(
        { error: 'Servicio de aprovisionamiento no configurado' },
        { status: 503 }
      );
    }

    // Release the number
    await provider.releaseNumber(session.organizationId);

    return NextResponse.json({
      success: true,
      message: 'Número liberado correctamente',
    });

  } catch (error) {
    console.error('[Provision API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Provisioning Status
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get provisioning status
    const account = await prisma.whatsAppBusinessAccount.findUnique({
      where: { organizationId: session.organizationId },
      select: {
        displayPhoneNumber: true,
        bspProvider: true,
        provisioningStatus: true,
        provisionedAt: true,
        monthlyMessageCount: true,
      },
    });

    if (!account) {
      return NextResponse.json({
        provisioned: false,
        status: 'NOT_STARTED',
      });
    }

    return NextResponse.json({
      provisioned: ['ACTIVE', 'VERIFIED'].includes(account.provisioningStatus),
      phoneNumber: account.displayPhoneNumber,
      provider: account.bspProvider,
      status: account.provisioningStatus,
      provisionedAt: account.provisionedAt,
      monthlyMessageCount: account.monthlyMessageCount,
    });

  } catch (error) {
    console.error('[Provision API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
