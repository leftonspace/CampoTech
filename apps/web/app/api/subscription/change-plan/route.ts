/**
 * Subscription Plan Change API
 * ============================
 *
 * POST /api/subscription/change-plan
 *
 * Allows organization owners to request a plan change (upgrade/downgrade).
 * Returns a checkout URL for paid plans or immediately applies FREE tier.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { subscriptionManager } from '@/lib/services/subscription-manager';
import { SubscriptionTier, getTierOrder } from '@/lib/config/tier-limits';
import { logAuditEntry } from '@/lib/audit/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChangePlanRequest {
  newTier: SubscriptionTier;
  immediate?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST - Request Plan Change
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER can change subscription
    if (session.role?.toUpperCase() !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Solo el propietario puede cambiar el plan' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json() as ChangePlanRequest;
    const { newTier, immediate } = body;

    // Validate tier
    const validTiers: SubscriptionTier[] = ['FREE', 'BASICO', 'PROFESIONAL', 'EMPRESARIAL'];
    if (!validTiers.includes(newTier)) {
      return NextResponse.json(
        { success: false, error: 'Plan no valido' },
        { status: 400 }
      );
    }

    // Get current tier
    const currentTier = await subscriptionManager.getCurrentTier(session.organizationId);

    // Check if it's an upgrade or downgrade
    const isUpgrade = getTierOrder(newTier) > getTierOrder(currentTier);
    const isDowngrade = getTierOrder(newTier) < getTierOrder(currentTier);

    // Request the plan change
    const result = await subscriptionManager.requestPlanChange({
      orgId: session.organizationId,
      currentTier,
      newTier,
      immediate: immediate ?? isUpgrade, // Upgrades are usually immediate
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Log the action
    await logAuditEntry({
      organizationId: session.organizationId,
      userId: session.userId,
      userRole: session.role || 'OWNER',
      action: 'UPDATE',
      entityType: 'subscription',
      entityId: session.organizationId,
      oldValue: currentTier,
      newValue: newTier,
      fieldChanged: 'tier',
      metadata: {
        isUpgrade,
        isDowngrade,
        immediate,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        currentTier,
        newTier,
        isUpgrade,
        isDowngrade,
        checkoutUrl: result.checkoutUrl,
        effectiveDate: result.effectiveDate,
        subscription: result.subscription,
      },
    });
  } catch (error) {
    console.error('Change plan error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cambiar el plan' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Current Subscription
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Get current subscription details
    const subscription = await subscriptionManager.getSubscription(session.organizationId);
    const currentTier = await subscriptionManager.getCurrentTier(session.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        currentTier,
        subscription: subscription ? {
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          cancelledAt: subscription.cancelledAt,
          trialEndsAt: subscription.trialEndsAt,
        } : null,
      },
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener suscripcion' },
      { status: 500 }
    );
  }
}
