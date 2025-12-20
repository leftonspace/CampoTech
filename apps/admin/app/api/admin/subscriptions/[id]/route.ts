/**
 * Admin Subscription Detail API
 * ==============================
 *
 * GET /api/admin/subscriptions/:id - Get subscription detail
 * POST /api/admin/subscriptions/:id - Perform actions (extend-trial, refund, change-tier, cancel, add-note)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubscriptionDetail, SubscriptionPaymentItem, SubscriptionEventItem } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const subscription = await prisma.organizationSubscription.findUnique({
      where: { id },
      include: {
        organization: {
          include: {
            owner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            _count: {
              select: {
                users: true,
                jobs: true,
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Transform to detail format
    const detail: SubscriptionDetail = {
      id: subscription.id,
      organizationId: subscription.organizationId,
      organizationName: subscription.organization.name,
      ownerName: subscription.organization.owner?.name || 'Sin dueño',
      ownerEmail: subscription.organization.owner?.email || '',
      cuit: subscription.organization.cuit,
      tier: subscription.tier as SubscriptionDetail['tier'],
      status: subscription.status as SubscriptionDetail['status'],
      billingCycle: subscription.billingCycle as SubscriptionDetail['billingCycle'],
      priceUsd: subscription.priceUsd ? Number(subscription.priceUsd) : null,
      trialEndsAt: subscription.trialEndsAt?.toISOString() || null,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
      userCount: subscription.organization._count.users,
      jobCount: subscription.organization._count.jobs,
      mpSubscriptionId: subscription.mpSubscriptionId,
      mpPayerId: subscription.mpPayerId,
      cancelledAt: subscription.cancelledAt?.toISOString() || null,
      cancelReason: subscription.cancelReason,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() || null,
    };

    // Transform payments
    const payments: SubscriptionPaymentItem[] = subscription.payments.map((p) => ({
      id: p.id,
      subscriptionId: p.subscriptionId,
      organizationId: p.organizationId,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status as SubscriptionPaymentItem['status'],
      paymentType: p.paymentType as SubscriptionPaymentItem['paymentType'],
      paymentMethod: p.paymentMethod,
      billingCycle: p.billingCycle as SubscriptionPaymentItem['billingCycle'],
      periodStart: p.periodStart.toISOString(),
      periodEnd: p.periodEnd.toISOString(),
      mpPaymentId: p.mpPaymentId,
      failureReason: p.failureReason,
      failureCode: p.failureCode,
      retryCount: p.retryCount,
      nextRetryAt: p.nextRetryAt?.toISOString() || null,
      processedAt: p.processedAt?.toISOString() || null,
      createdAt: p.createdAt.toISOString(),
    }));

    // Transform events
    const events: SubscriptionEventItem[] = subscription.events.map((e) => ({
      id: e.id,
      subscriptionId: e.subscriptionId,
      organizationId: e.organizationId,
      eventType: e.eventType,
      eventData: e.eventData as Record<string, unknown>,
      actorType: e.actorType,
      actorId: e.actorId,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      data: {
        subscription: detail,
        payments,
        events,
      },
    });
  } catch (error) {
    console.error('Admin subscription detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching subscription' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super_admin and admin can perform actions
    if (session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    const subscription = await prisma.organizationSubscription.findUnique({
      where: { id },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'extend-trial':
        return handleExtendTrial(id, subscription.organizationId, data, session);

      case 'change-tier':
        return handleChangeTier(id, subscription.organizationId, data, session);

      case 'cancel':
        return handleCancel(id, subscription.organizationId, data, session);

      case 'reactivate':
        return handleReactivate(id, subscription.organizationId, session);

      case 'add-note':
        return handleAddNote(id, subscription.organizationId, data, session);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin subscription action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}

async function handleExtendTrial(
  subscriptionId: string,
  organizationId: string,
  data: { days: number },
  session: { id: string; name: string }
) {
  const { days } = data;
  if (!days || days < 1 || days > 90) {
    return NextResponse.json(
      { success: false, error: 'Days must be between 1 and 90' },
      { status: 400 }
    );
  }

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { success: false, error: 'Subscription not found' },
      { status: 404 }
    );
  }

  // Calculate new trial end date
  const currentTrialEnd = subscription.trialEndsAt || new Date();
  const newTrialEnd = new Date(currentTrialEnd);
  newTrialEnd.setDate(newTrialEnd.getDate() + days);

  // Update subscription
  await prisma.organizationSubscription.update({
    where: { id: subscriptionId },
    data: {
      trialEndsAt: newTrialEnd,
      status: 'trialing',
    },
  });

  // Log event
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      organizationId,
      eventType: 'trial_extended',
      eventData: {
        days,
        previousTrialEnd: currentTrialEnd.toISOString(),
        newTrialEnd: newTrialEnd.toISOString(),
      },
      actorType: 'admin',
      actorId: session.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Trial extended by ${days} days until ${newTrialEnd.toLocaleDateString('es-AR')}`,
  });
}

async function handleChangeTier(
  subscriptionId: string,
  organizationId: string,
  data: { newTier: string; immediate: boolean },
  session: { id: string; name: string }
) {
  const { newTier, immediate = true } = data;
  const validTiers = ['FREE', 'INICIAL', 'PROFESIONAL', 'EMPRESA'];

  if (!validTiers.includes(newTier)) {
    return NextResponse.json(
      { success: false, error: 'Invalid tier' },
      { status: 400 }
    );
  }

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { success: false, error: 'Subscription not found' },
      { status: 404 }
    );
  }

  const oldTier = subscription.tier;
  const isUpgrade = validTiers.indexOf(newTier) > validTiers.indexOf(oldTier);

  // Update subscription
  await prisma.organizationSubscription.update({
    where: { id: subscriptionId },
    data: {
      tier: newTier as 'FREE' | 'INICIAL' | 'PROFESIONAL' | 'EMPRESA',
      status: newTier === 'FREE' ? 'none' : 'active',
    },
  });

  // Log event
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      organizationId,
      eventType: isUpgrade ? 'upgraded' : 'downgraded',
      eventData: {
        previousTier: oldTier,
        newTier,
        immediate,
      },
      actorType: 'admin',
      actorId: session.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: `Tier changed from ${oldTier} to ${newTier}`,
  });
}

async function handleCancel(
  subscriptionId: string,
  organizationId: string,
  data: { reason: string; immediate: boolean },
  session: { id: string; name: string }
) {
  const { reason, immediate = false } = data;

  const subscription = await prisma.organizationSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { success: false, error: 'Subscription not found' },
      { status: 404 }
    );
  }

  if (immediate) {
    // Cancel immediately
    await prisma.organizationSubscription.update({
      where: { id: subscriptionId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by admin',
        cancelAtPeriodEnd: false,
      },
    });
  } else {
    // Cancel at end of period
    await prisma.organizationSubscription.update({
      where: { id: subscriptionId },
      data: {
        cancelAtPeriodEnd: true,
        cancelReason: reason || 'Cancelled by admin',
      },
    });
  }

  // Log event
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      organizationId,
      eventType: 'cancelled',
      eventData: {
        reason: reason || 'Cancelled by admin',
        immediate,
        cancelledBy: 'admin',
      },
      actorType: 'admin',
      actorId: session.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: immediate
      ? 'Subscription cancelled immediately'
      : 'Subscription will be cancelled at end of period',
  });
}

async function handleReactivate(
  subscriptionId: string,
  organizationId: string,
  session: { id: string; name: string }
) {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { success: false, error: 'Subscription not found' },
      { status: 404 }
    );
  }

  // Reactivate subscription
  await prisma.organizationSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'active',
      cancelledAt: null,
      cancelReason: null,
      cancelAtPeriodEnd: false,
    },
  });

  // Log event
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      organizationId,
      eventType: 'reactivated',
      eventData: {
        reactivatedBy: 'admin',
      },
      actorType: 'admin',
      actorId: session.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Subscription reactivated',
  });
}

async function handleAddNote(
  subscriptionId: string,
  organizationId: string,
  data: { content: string },
  session: { id: string; name: string }
) {
  const { content } = data;
  if (!content || content.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Note content is required' },
      { status: 400 }
    );
  }

  // Log note as event
  await prisma.subscriptionEvent.create({
    data: {
      subscriptionId,
      organizationId,
      eventType: 'admin_note',
      eventData: {
        note: content,
        adminName: session.name,
      },
      actorType: 'admin',
      actorId: session.id,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Note added',
  });
}
