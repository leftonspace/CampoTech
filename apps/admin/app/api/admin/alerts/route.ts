/**
 * Admin Alerts API
 * =================
 *
 * GET /api/admin/alerts - Get recent alerts for the admin
 * POST /api/admin/alerts/:id/read - Mark alert as read
 * POST /api/admin/alerts/read-all - Mark all alerts as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminAlert, AdminAlertType } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // For now, generate alerts from recent events since we don't have a dedicated alerts table
    // In production, you would have an AdminAlert table
    const alerts = await generateAlertsFromEvents(limit, unreadOnly);

    // Get unread count
    const unreadCount = alerts.filter((a) => !a.isRead).length;

    return NextResponse.json({
      success: true,
      data: {
        alerts,
        unreadCount,
      },
    });
  } catch (error) {
    console.error('Admin alerts error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching alerts' },
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

    const body = await request.json();
    const { action, alertId } = body;

    switch (action) {
      case 'mark-read':
        // In a real implementation, this would update the alert in the database
        return NextResponse.json({
          success: true,
          message: 'Alert marked as read',
        });

      case 'mark-all-read':
        // In a real implementation, this would update all alerts for this admin
        return NextResponse.json({
          success: true,
          message: 'All alerts marked as read',
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin alert action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}

async function generateAlertsFromEvents(limit: number, unreadOnly: boolean): Promise<AdminAlert[]> {
  const now = new Date();
  const alerts: AdminAlert[] = [];

  // Get failed payments
  const failedPayments = await prisma.subscriptionPayment.findMany({
    where: { status: 'failed' },
    include: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const payment of failedPayments) {
    alerts.push({
      id: `fp-${payment.id}`,
      type: 'failed_payment',
      title: 'Pago fallido',
      message: `Pago de $${payment.amount} USD fallido para ${payment.organization.name}`,
      severity: 'error',
      entityType: 'payment',
      entityId: payment.id,
      organizationId: payment.organizationId,
      organizationName: payment.organization.name,
      isRead: false,
      createdAt: payment.createdAt.toISOString(),
    });
  }

  // Get pending verifications
  const pendingVerifications = await prisma.verificationSubmission.findMany({
    where: { status: 'pending' },
    include: {
      organization: { select: { id: true, name: true } },
      requirement: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  for (const verification of pendingVerifications) {
    alerts.push({
      id: `vs-${verification.id}`,
      type: 'new_verification_submission',
      title: 'Nueva verificación',
      message: `${verification.requirement.name} de ${verification.organization.name} pendiente de revisión`,
      severity: 'info',
      entityType: 'verification',
      entityId: verification.id,
      organizationId: verification.organizationId,
      organizationName: verification.organization.name,
      isRead: false,
      createdAt: verification.createdAt.toISOString(),
    });
  }

  // Get expiring documents (within 7 days)
  const expiringDocuments = await prisma.verificationSubmission.findMany({
    where: {
      status: 'approved',
      expiresAt: {
        gte: now,
        lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
      requirement: { select: { name: true } },
    },
    orderBy: { expiresAt: 'asc' },
    take: 5,
  });

  for (const doc of expiringDocuments) {
    const daysUntilExpiry = Math.ceil(
      (doc.expiresAt!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    alerts.push({
      id: `exp-${doc.id}`,
      type: 'document_expired',
      title: 'Documento por vencer',
      message: `${doc.requirement.name} de ${doc.organization.name} vence en ${daysUntilExpiry} días`,
      severity: 'warning',
      entityType: 'verification',
      entityId: doc.id,
      organizationId: doc.organizationId,
      organizationName: doc.organization.name,
      isRead: false,
      createdAt: doc.updatedAt.toISOString(),
    });
  }

  // Get blocked organizations
  const blockedOrgs = await prisma.organization.findMany({
    where: { isBlocked: true },
    select: {
      id: true,
      name: true,
      blockReason: true,
      blockedAt: true,
    },
    orderBy: { blockedAt: 'desc' },
    take: 3,
  });

  for (const org of blockedOrgs) {
    if (org.blockedAt) {
      alerts.push({
        id: `block-${org.id}`,
        type: 'organization_blocked',
        title: 'Organización bloqueada',
        message: `${org.name} está bloqueada: ${org.blockReason || 'Sin razón especificada'}`,
        severity: 'error',
        entityType: 'organization',
        entityId: org.id,
        organizationId: org.id,
        organizationName: org.name,
        isRead: true, // Older events marked as read
        createdAt: org.blockedAt.toISOString(),
      });
    }
  }

  // Get recent completed payments
  const recentPayments = await prisma.subscriptionPayment.findMany({
    where: {
      status: 'completed',
      processedAt: {
        gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      },
    },
    include: {
      organization: { select: { id: true, name: true } },
    },
    orderBy: { processedAt: 'desc' },
    take: 5,
  });

  for (const payment of recentPayments) {
    alerts.push({
      id: `pay-${payment.id}`,
      type: 'new_subscription_payment',
      title: 'Pago recibido',
      message: `Pago de $${payment.amount} USD de ${payment.organization.name}`,
      severity: 'success',
      entityType: 'payment',
      entityId: payment.id,
      organizationId: payment.organizationId,
      organizationName: payment.organization.name,
      isRead: true,
      createdAt: (payment.processedAt || payment.createdAt).toISOString(),
    });
  }

  // Sort by date and limit
  return alerts
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((a) => !unreadOnly || !a.isRead)
    .slice(0, limit);
}
