/**
 * Admin Subscriptions API
 * =======================
 *
 * GET /api/admin/subscriptions - List all subscriptions with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SubscriptionListItem, SubscriptionFilters, RevenueMetrics } from '@/types';
import { Prisma } from '@prisma/client';

// Tier pricing map (USD)
const TIER_PRICING: Record<string, { monthly: number; yearly: number }> = {
  FREE: { monthly: 0, yearly: 0 },
  INICIAL: { monthly: 25, yearly: 250 },
  PROFESIONAL: { monthly: 55, yearly: 550 },
  EMPRESA: { monthly: 120, yearly: 1200 },
};

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters: SubscriptionFilters = {
      status: (searchParams.get('status') as SubscriptionFilters['status']) || 'all',
      tier: (searchParams.get('tier') as SubscriptionFilters['tier']) || 'all',
      search: searchParams.get('search') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    // Include metrics in response if requested
    const includeMetrics = searchParams.get('includeMetrics') === 'true';

    // Build where clause
    const where: Prisma.OrganizationSubscriptionWhereInput = {};

    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    }

    if (filters.tier && filters.tier !== 'all') {
      where.tier = filters.tier;
    }

    if (filters.dateFrom) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        gte: new Date(filters.dateFrom),
      };
    }

    if (filters.dateTo) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        lte: new Date(filters.dateTo),
      };
    }

    if (filters.search) {
      where.organization = {
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { cuit: { contains: filters.search, mode: 'insensitive' } },
          { owner: { email: { contains: filters.search, mode: 'insensitive' } } },
          { owner: { name: { contains: filters.search, mode: 'insensitive' } } },
        ],
      };
    }

    // Get total count
    const total = await prisma.organizationSubscription.count({ where });

    // Get subscriptions with pagination
    const subscriptions = await prisma.organizationSubscription.findMany({
      where,
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
      },
      orderBy: { createdAt: 'desc' },
      skip: ((filters.page || 1) - 1) * (filters.limit || 20),
      take: filters.limit || 20,
    });

    // Transform to list items
    const items: SubscriptionListItem[] = subscriptions.map((sub) => ({
      id: sub.id,
      organizationId: sub.organizationId,
      organizationName: sub.organization.name,
      ownerName: sub.organization.owner?.name || 'Sin dueño',
      ownerEmail: sub.organization.owner?.email || '',
      cuit: sub.organization.cuit,
      tier: sub.tier as SubscriptionListItem['tier'],
      status: sub.status as SubscriptionListItem['status'],
      billingCycle: sub.billingCycle as SubscriptionListItem['billingCycle'],
      priceUsd: sub.priceUsd ? Number(sub.priceUsd) : null,
      trialEndsAt: sub.trialEndsAt?.toISOString() || null,
      currentPeriodEnd: sub.currentPeriodEnd?.toISOString() || null,
      createdAt: sub.createdAt.toISOString(),
      userCount: sub.organization._count.users,
      jobCount: sub.organization._count.jobs,
    }));

    // Calculate metrics if requested
    let metrics: RevenueMetrics | undefined;
    if (includeMetrics) {
      metrics = await calculateMetrics();
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: Math.ceil(total / (filters.limit || 20)),
        metrics,
      },
    });
  } catch (error) {
    console.error('Admin subscriptions error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching subscriptions' },
      { status: 500 }
    );
  }
}

async function calculateMetrics(): Promise<RevenueMetrics> {
  // Get all active subscriptions for MRR calculation
  const activeSubscriptions = await prisma.organizationSubscription.findMany({
    where: {
      status: { in: ['active', 'trialing'] },
    },
    select: {
      tier: true,
      billingCycle: true,
      priceUsd: true,
    },
  });

  // Calculate MRR
  let mrr = 0;
  const tierCounts: Record<string, { count: number; revenue: number }> = {
    EMPRESA: { count: 0, revenue: 0 },
    PROFESIONAL: { count: 0, revenue: 0 },
    INICIAL: { count: 0, revenue: 0 },
    FREE: { count: 0, revenue: 0 },
  };

  for (const sub of activeSubscriptions) {
    const pricing = TIER_PRICING[sub.tier] || { monthly: 0, yearly: 0 };
    const monthlyPrice =
      sub.billingCycle === 'YEARLY'
        ? pricing.yearly / 12
        : pricing.monthly;

    mrr += monthlyPrice;
    tierCounts[sub.tier].count += 1;
    tierCounts[sub.tier].revenue += monthlyPrice;
  }

  // Get payments for this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const monthlyPayments = await prisma.subscriptionPayment.aggregate({
    where: {
      status: 'completed',
      processedAt: { gte: startOfMonth },
    },
    _sum: { amount: true },
  });

  // Calculate conversion rate (trials that became active in last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const trialsStarted = await prisma.subscriptionEvent.count({
    where: {
      eventType: 'trial_started',
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  const trialsConverted = await prisma.subscriptionEvent.count({
    where: {
      eventType: 'activated',
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  const trialToPayConversion = trialsStarted > 0
    ? (trialsConverted / trialsStarted) * 100
    : 0;

  // Calculate churn rate
  const cancelledThisMonth = await prisma.organizationSubscription.count({
    where: {
      status: 'cancelled',
      cancelledAt: { gte: startOfMonth },
    },
  });

  const activeAtStartOfMonth = await prisma.organizationSubscription.count({
    where: {
      status: { in: ['active', 'trialing'] },
      createdAt: { lt: startOfMonth },
    },
  });

  const churnRate = activeAtStartOfMonth > 0
    ? (cancelledThisMonth / activeAtStartOfMonth) * 100
    : 0;

  // Get revenue by month (last 12 months)
  const revenueByMonth: { month: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const monthRevenue = await prisma.subscriptionPayment.aggregate({
      where: {
        status: 'completed',
        processedAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: { amount: true },
    });

    revenueByMonth.push({
      month: monthStart.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      revenue: Number(monthRevenue._sum.amount || 0),
    });
  }

  // Calculate tier percentages
  const totalRevenue = Object.values(tierCounts).reduce((sum, t) => sum + t.revenue, 0);
  const revenueByTier = Object.entries(tierCounts).map(([tier, data]) => ({
    tier: tier === 'EMPRESA' ? 'Empresa' :
          tier === 'PROFESIONAL' ? 'Profesional' :
          tier === 'INICIAL' ? 'Inicial' : 'Free',
    revenue: data.revenue,
    count: data.count,
    percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  }));

  return {
    mrr: Math.round(mrr * 100) / 100,
    arr: Math.round(mrr * 12 * 100) / 100,
    revenueThisMonth: Number(monthlyPayments._sum.amount || 0),
    trialToPayConversion: Math.round(trialToPayConversion * 10) / 10,
    churnRate: Math.round(churnRate * 10) / 10,
    revenueByMonth,
    revenueByTier,
  };
}
