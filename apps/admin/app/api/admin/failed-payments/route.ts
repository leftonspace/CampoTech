/**
 * Admin Failed Payments API
 * ==========================
 *
 * GET /api/admin/failed-payments - List recent failed payments
 * POST /api/admin/failed-payments/:id/retry - Retry a failed payment
 * POST /api/admin/failed-payments/:id/resolve - Mark as resolved
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const includeResolved = searchParams.get('includeResolved') === 'true';

    // Get failed payments
    const failedPayments = await prisma.subscriptionPayment.findMany({
      where: {
        status: includeResolved ? { in: ['failed', 'pending'] } : 'failed',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                email: true,
                phone: true,
              },
            },
          },
        },
        subscription: {
          select: {
            tier: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const items = failedPayments.map((p) => ({
      id: p.id,
      organizationId: p.organizationId,
      organizationName: p.organization.name,
      ownerEmail: p.organization.owner?.email || '',
      ownerPhone: p.organization.owner?.phone || '',
      subscriptionId: p.subscriptionId,
      tier: p.subscription?.tier || 'FREE',
      amount: Number(p.amount),
      currency: p.currency,
      failureReason: p.failureReason,
      failureCode: p.failureCode,
      retryCount: p.retryCount,
      nextRetryAt: p.nextRetryAt?.toISOString() || null,
      mpPaymentId: p.mpPaymentId,
      createdAt: p.createdAt.toISOString(),
    }));

    // Get summary stats
    const stats = await prisma.subscriptionPayment.aggregate({
      where: { status: 'failed' },
      _count: true,
      _sum: { amount: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        stats: {
          totalFailed: stats._count,
          totalAmount: Number(stats._sum.amount || 0),
        },
      },
    });
  } catch (error) {
    console.error('Admin failed payments error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching failed payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { paymentId, action } = body;

    if (!paymentId) {
      return NextResponse.json(
        { success: false, error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    const payment = await prisma.subscriptionPayment.findUnique({
      where: { id: paymentId },
      include: {
        subscription: true,
      },
    });

    if (!payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'retry':
        // Update payment for retry
        await prisma.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'pending',
            retryCount: payment.retryCount + 1,
            nextRetryAt: null,
          },
        });

        // Log event
        if (payment.subscription) {
          await prisma.subscriptionEvent.create({
            data: {
              subscriptionId: payment.subscriptionId,
              organizationId: payment.organizationId,
              eventType: 'payment_retry_initiated',
              eventData: {
                paymentId: payment.id,
                retryCount: payment.retryCount + 1,
                initiatedBy: 'admin',
              },
              actorType: 'admin',
              actorId: session.id,
            },
          });
        }

        return NextResponse.json({
          success: true,
          message: 'Payment retry initiated',
        });

      case 'resolve':
        // Mark payment as resolved (manually handled)
        await prisma.subscriptionPayment.update({
          where: { id: paymentId },
          data: {
            status: 'completed',
            processedAt: new Date(),
            failureReason: null,
            failureCode: null,
          },
        });

        // Update subscription status if past_due
        if (payment.subscription?.status === 'past_due') {
          await prisma.organizationSubscription.update({
            where: { id: payment.subscriptionId },
            data: {
              status: 'active',
              gracePeriodEndsAt: null,
            },
          });
        }

        // Log event
        await prisma.subscriptionEvent.create({
          data: {
            subscriptionId: payment.subscriptionId,
            organizationId: payment.organizationId,
            eventType: 'payment_manually_resolved',
            eventData: {
              paymentId: payment.id,
              resolvedBy: 'admin',
            },
            actorType: 'admin',
            actorId: session.id,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Payment marked as resolved',
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin failed payment action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}
