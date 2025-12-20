/**
 * Combined Organization Detail API
 * =================================
 *
 * GET /api/admin/organizations/:id/combined - Get full organization info with subscription and verification
 * GET /api/admin/organizations/:id/combined/activity - Get combined activity timeline
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { CombinedOrganizationDetail, CombinedActivityItem, OrganizationRequirementStatus } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeActivity = searchParams.get('includeActivity') === 'true';

    // Fetch organization with all related data
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cuil: true,
          },
        },
        subscription: true,
        verificationSubmissions: {
          include: {
            requirement: true,
          },
          orderBy: { createdAt: 'desc' },
        },
        users: {
          where: {
            role: { not: 'owner' },
          },
          select: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            status: true,
            processedAt: true,
          },
        },
        _count: {
          select: {
            jobs: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all verification requirements
    const allRequirements = await prisma.verificationRequirement.findMany({
      where: {
        isActive: true,
        appliesTo: { in: ['organization', 'owner'] },
      },
      orderBy: [{ tier: 'asc' }, { name: 'asc' }],
    });

    // Build requirement status map
    const requirementStatusMap = new Map<string, OrganizationRequirementStatus>();

    for (const req of allRequirements) {
      const submission = organization.verificationSubmissions.find(
        (s) => s.requirementId === req.id
      );

      requirementStatusMap.set(req.id, {
        requirementId: req.id,
        code: req.code,
        name: req.name,
        category: req.category as OrganizationRequirementStatus['category'],
        tier: req.tier,
        isRequired: req.isRequired,
        status: submission?.status || 'not_submitted',
        submittedAt: submission?.createdAt.toISOString() || null,
        verifiedAt: submission?.verifiedAt?.toISOString() || null,
        expiresAt: submission?.expiresAt?.toISOString() || null,
        documentUrl: submission?.documentUrl || null,
      });
    }

    // Calculate tier progress
    const tier2Reqs = allRequirements.filter((r) => r.tier === 2 && r.isRequired);
    const tier3Reqs = allRequirements.filter((r) => r.tier === 3 && r.isRequired);

    const tier2Completed = tier2Reqs.filter((r) => {
      const status = requirementStatusMap.get(r.id)?.status;
      return status === 'approved';
    }).length;

    const tier3Completed = tier3Reqs.filter((r) => {
      const status = requirementStatusMap.get(r.id)?.status;
      return status === 'approved';
    }).length;

    // Count verified employees
    const employeeCount = organization.users.length;
    // In a real implementation, you would check verification status for each employee
    const verifiedEmployeeCount = 0;

    // Calculate payment stats
    const completedPayments = organization.payments.filter((p) => p.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const lastPayment = completedPayments.sort(
      (a, b) =>
        new Date(b.processedAt || 0).getTime() - new Date(a.processedAt || 0).getTime()
    )[0];

    // Build combined detail
    const detail: CombinedOrganizationDetail = {
      id: organization.id,
      name: organization.name,
      cuit: organization.cuit,
      phone: organization.phone,
      address: organization.address,
      owner: {
        id: organization.owner?.id || '',
        name: organization.owner?.name || 'Sin nombre',
        email: organization.owner?.email || '',
        phone: organization.owner?.phone || null,
        cuil: organization.owner?.cuil || null,
      },
      subscription: {
        id: organization.subscription?.id || null,
        tier: organization.subscription?.tier || 'FREE',
        status: organization.subscription?.status || 'none',
        billingCycle: organization.subscription?.billingCycle || null,
        priceUsd: organization.subscription?.priceUsd
          ? Number(organization.subscription.priceUsd)
          : null,
        trialEndsAt: organization.subscription?.trialEndsAt?.toISOString() || null,
        currentPeriodStart: organization.subscription?.currentPeriodStart?.toISOString() || null,
        currentPeriodEnd: organization.subscription?.currentPeriodEnd?.toISOString() || null,
        cancelAtPeriodEnd: organization.subscription?.cancelAtPeriodEnd || false,
        gracePeriodEndsAt: organization.subscription?.gracePeriodEndsAt?.toISOString() || null,
      },
      verification: {
        status: organization.verificationStatus || 'not_started',
        tier2Progress: { completed: tier2Completed, total: tier2Reqs.length },
        tier3Progress: { completed: tier3Completed, total: tier3Reqs.length },
        badgesEarned: 0, // Would need a badges table
        requirements: Array.from(requirementStatusMap.values()),
      },
      block: {
        isBlocked: organization.isBlocked,
        reason: organization.blockReason,
        blockedAt: organization.blockedAt?.toISOString() || null,
        blockedBy: organization.blockedBy,
      },
      stats: {
        employeeCount,
        verifiedEmployeeCount,
        totalPayments: organization.payments.length,
        totalPaid,
        lastPaymentAt: lastPayment?.processedAt?.toISOString() || null,
        jobCount: organization._count.jobs,
      },
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };

    // Get activity if requested
    let activity: CombinedActivityItem[] = [];
    if (includeActivity) {
      activity = await getCombinedActivity(id);
    }

    return NextResponse.json({
      success: true,
      data: {
        organization: detail,
        activity,
      },
    });
  } catch (error) {
    console.error('Combined organization detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching organization details' },
      { status: 500 }
    );
  }
}

async function getCombinedActivity(organizationId: string): Promise<CombinedActivityItem[]> {
  const [subscriptionEvents, verificationSubmissions, payments] = await Promise.all([
    prisma.subscriptionEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.verificationSubmission.findMany({
      where: { organizationId },
      include: {
        requirement: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    prisma.subscriptionPayment.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const activities: CombinedActivityItem[] = [
    ...subscriptionEvents.map((e) => ({
      id: `sub-${e.id}`,
      source: 'subscription' as const,
      type: e.eventType,
      description: getSubscriptionEventDescription(e.eventType, e.eventData as Record<string, unknown>),
      metadata: e.eventData as Record<string, unknown>,
      actorType: (e.actorType || 'system') as 'system' | 'admin' | 'user',
      actorName: e.actorId,
      createdAt: e.createdAt.toISOString(),
    })),
    ...verificationSubmissions.map((v) => ({
      id: `ver-${v.id}`,
      source: 'verification' as const,
      type: `verification_${v.status}`,
      description: `${v.requirement.name}: ${getVerificationStatusLabel(v.status)}`,
      metadata: {
        requirementId: v.requirementId,
        documentUrl: v.documentUrl,
        rejectionReason: v.rejectionReason,
      },
      actorType: (v.verifiedBy === 'admin' ? 'admin' : v.verifiedBy === 'auto' ? 'system' : 'user') as
        | 'system'
        | 'admin'
        | 'user',
      actorName: v.verifiedByUserId,
      createdAt: v.updatedAt.toISOString(),
    })),
    ...payments.map((p) => ({
      id: `pay-${p.id}`,
      source: 'payment' as const,
      type: `payment_${p.status}`,
      description: getPaymentDescription(p),
      metadata: {
        amount: Number(p.amount),
        currency: p.currency,
        mpPaymentId: p.mpPaymentId,
        failureReason: p.failureReason,
      },
      actorType: 'system' as const,
      actorName: null,
      createdAt: p.createdAt.toISOString(),
    })),
  ];

  return activities
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 50);
}

function getSubscriptionEventDescription(
  eventType: string,
  data: Record<string, unknown>
): string {
  const descriptions: Record<string, string> = {
    subscription_created: 'Suscripción creada',
    subscription_activated: 'Suscripción activada',
    subscription_cancelled: 'Suscripción cancelada',
    subscription_paused: 'Suscripción pausada',
    subscription_resumed: 'Suscripción reanudada',
    tier_upgraded: `Plan actualizado a ${data?.newTier || 'nuevo plan'}`,
    tier_downgraded: `Plan bajado a ${data?.newTier || 'nuevo plan'}`,
    trial_started: 'Período de prueba iniciado',
    trial_ended: 'Período de prueba finalizado',
    trial_extended: `Prueba extendida ${data?.days || 0} días`,
  };
  return descriptions[eventType] || eventType;
}

function getVerificationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente de revisión',
    in_review: 'En revisión',
    approved: 'Aprobado',
    rejected: 'Rechazado',
    expired: 'Expirado',
  };
  return labels[status] || status;
}

function getPaymentDescription(payment: {
  amount: number | { toNumber(): number } | null;
  currency: string;
  status: string;
  failureReason: string | null;
}): string {
  const amount =
    typeof payment.amount === 'object' && payment.amount !== null
      ? payment.amount.toNumber()
      : Number(payment.amount || 0);
  const base = `Pago de $${amount} ${payment.currency}`;

  if (payment.status === 'completed') {
    return `${base} - Completado`;
  } else if (payment.status === 'failed') {
    return `${base} - Fallido: ${payment.failureReason || 'Error desconocido'}`;
  } else if (payment.status === 'pending') {
    return `${base} - Pendiente`;
  } else if (payment.status === 'processing') {
    return `${base} - Procesando`;
  } else if (payment.status === 'refunded') {
    return `${base} - Reembolsado`;
  }
  return base;
}
