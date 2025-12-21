/**
 * Available WhatsApp Numbers API
 * ===============================
 *
 * GET /api/whatsapp/provision/available - List available numbers for provisioning
 *
 * Query Parameters:
 * - country: ISO country code (e.g., 'AR' for Argentina)
 * - areaCode: Optional area code filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';

// Tiers that support BSP provisioning
const PROVISIONING_TIERS = ['PROFESIONAL', 'EMPRESARIAL', 'ENTERPRISE'];

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const country = searchParams.get('country') || 'AR'; // Default to Argentina
    const areaCode = searchParams.get('areaCode') || undefined;

    // Get provider
    const apiKey = process.env.DIALOG360_PARTNER_API_KEY;
    const partnerId = process.env.DIALOG360_PARTNER_ID;

    if (!apiKey || !partnerId) {
      return NextResponse.json(
        { error: 'Servicio de aprovisionamiento no configurado' },
        { status: 503 }
      );
    }

    const provider = new Dialog360Provider({
      apiKey,
      partnerId,
      webhookSecret: process.env.DIALOG360_WEBHOOK_SECRET,
    });

    // Fetch available numbers
    const numbers = await provider.getAvailableNumbers(country, areaCode);

    return NextResponse.json({
      numbers,
      country,
      areaCode,
      count: numbers.length,
    });

  } catch (error) {
    console.error('[Available Numbers API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
