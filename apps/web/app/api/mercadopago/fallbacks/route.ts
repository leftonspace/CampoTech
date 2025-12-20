/**
 * MercadoPago Fallbacks API
 * =========================
 *
 * GET /api/mercadopago/fallbacks - Get pending fallback payments
 * POST /api/mercadopago/fallbacks - Resolve a fallback payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getMPClient } from '@/lib/integrations/mercadopago';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId =
      request.nextUrl.searchParams.get('organizationId') || session.organizationId;
    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    const client = getMPClient();
    const fallbacks = await client.getPendingFallbacks(organizationId);

    return NextResponse.json({
      fallbacks: fallbacks.map((f) => ({
        id: f.id,
        invoiceId: f.invoiceId,
        customerId: f.customerId,
        amount: f.amount,
        currency: f.currency,
        reason: f.reason,
        suggestedMethod: f.suggestedMethod,
        status: f.status,
        createdAt: f.createdAt,
      })),
      count: fallbacks.length,
    });
  } catch (error) {
    console.error('[MP Fallbacks API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get fallbacks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fallbackId, resolvedMethod, notes } = body;

    if (!fallbackId || !resolvedMethod) {
      return NextResponse.json(
        { error: 'fallbackId and resolvedMethod required' },
        { status: 400 }
      );
    }

    const client = getMPClient();
    const resolved = await client.resolveFallback(fallbackId, {
      resolvedBy: session.userId || session.email || 'unknown',
      resolvedMethod,
      notes,
    });

    if (!resolved) {
      return NextResponse.json(
        { error: 'Fallback not found or already resolved' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      fallback: {
        id: resolved.id,
        status: resolved.status,
        resolvedAt: resolved.resolvedAt,
        resolvedBy: resolved.resolvedBy,
        resolvedMethod: resolved.resolvedMethod,
      },
    });
  } catch (error) {
    console.error('[MP Fallbacks API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resolve fallback' },
      { status: 500 }
    );
  }
}
