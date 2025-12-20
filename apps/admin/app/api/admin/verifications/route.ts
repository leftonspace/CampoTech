/**
 * Admin Verifications API
 * ========================
 *
 * GET /api/admin/verifications - List verification queue with filters and stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  VerificationQueueItem,
  VerificationDashboardStats,
  VerificationFilters,
} from '@/types';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const filters: VerificationFilters = {
      status: (searchParams.get('status') as VerificationFilters['status']) || 'all',
      category: (searchParams.get('category') as VerificationFilters['category']) || 'all',
      priority: (searchParams.get('priority') as VerificationFilters['priority']) || 'all',
      appliesTo: (searchParams.get('appliesTo') as VerificationFilters['appliesTo']) || 'all',
      search: searchParams.get('search') || undefined,
      organizationId: searchParams.get('organizationId') || undefined,
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '20'),
    };

    const includeStats = searchParams.get('includeStats') === 'true';

    // Build where clause
    const where: Prisma.VerificationSubmissionWhereInput = {};

    // Filter by status
    if (filters.status && filters.status !== 'all') {
      where.status = filters.status;
    } else {
      // By default, show pending and in_review items
      where.status = { in: ['pending', 'in_review'] };
    }

    // Filter by category
    if (filters.category && filters.category !== 'all') {
      where.requirement = {
        category: filters.category,
      };
    }

    // Filter by appliesTo
    if (filters.appliesTo && filters.appliesTo !== 'all') {
      where.requirement = {
        ...(where.requirement as Prisma.VerificationRequirementWhereInput),
        appliesTo: filters.appliesTo,
      };
    }

    // Filter by organization
    if (filters.organizationId) {
      where.organizationId = filters.organizationId;
    }

    // Search by CUIT, org name, or person name
    if (filters.search) {
      where.OR = [
        { organization: { name: { contains: filters.search, mode: 'insensitive' } } },
        { organization: { cuit: { contains: filters.search, mode: 'insensitive' } } },
        { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      ];
    }

    // Get total count
    const total = await prisma.verificationSubmission.count({ where });

    // Get submissions
    const submissions = await prisma.verificationSubmission.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            cuit: true,
            createdAt: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        requirement: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            appliesTo: true,
            tier: true,
          },
        },
      },
      orderBy: [
        { status: 'asc' }, // pending first
        { submittedAt: 'asc' }, // oldest first
      ],
      skip: ((filters.page || 1) - 1) * (filters.limit || 20),
      take: filters.limit || 20,
    });

    // Check for first submissions to determine priority
    const orgCreationDates = new Map<string, Date>();
    for (const sub of submissions) {
      orgCreationDates.set(sub.organizationId, sub.organization.createdAt);
    }

    // Transform to queue items
    const items: VerificationQueueItem[] = submissions.map((sub) => {
      const orgCreatedAt = orgCreationDates.get(sub.organizationId);
      const isNewBusiness = orgCreatedAt &&
        (new Date().getTime() - orgCreatedAt.getTime()) < 7 * 24 * 60 * 60 * 1000; // 7 days

      let priority: VerificationQueueItem['priority'] = 'normal';
      if (isNewBusiness) {
        priority = 'new_business';
      } else if (sub.requirement.tier === 4) {
        priority = 'badge_request';
      }

      return {
        id: sub.id,
        organizationId: sub.organizationId,
        organizationName: sub.organization.name,
        userId: sub.userId,
        userName: sub.user?.name || null,
        requirementId: sub.requirementId,
        requirementCode: sub.requirement.code,
        requirementName: sub.requirement.name,
        category: sub.requirement.category as VerificationQueueItem['category'],
        appliesTo: sub.requirement.appliesTo as VerificationQueueItem['appliesTo'],
        tier: sub.requirement.tier,
        status: sub.status as VerificationQueueItem['status'],
        submittedValue: sub.submittedValue,
        documentUrl: sub.documentUrl,
        documentType: sub.documentType,
        documentFilename: sub.documentFilename,
        submittedAt: sub.submittedAt.toISOString(),
        priority,
        isFirstSubmission: isNewBusiness || false,
      };
    });

    // Calculate stats if requested
    let stats: VerificationDashboardStats | undefined;
    if (includeStats) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const sevenDaysFromNow = new Date();
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

      const [
        pendingCount,
        inReviewCount,
        approvedTodayCount,
        rejectedTodayCount,
        expiringCount,
      ] = await Promise.all([
        prisma.verificationSubmission.count({ where: { status: 'pending' } }),
        prisma.verificationSubmission.count({ where: { status: 'in_review' } }),
        prisma.verificationSubmission.count({
          where: {
            status: 'approved',
            verifiedAt: { gte: today },
          },
        }),
        prisma.verificationSubmission.count({
          where: {
            status: 'rejected',
            updatedAt: { gte: today },
          },
        }),
        prisma.verificationSubmission.count({
          where: {
            status: 'approved',
            expiresAt: {
              gte: today,
              lte: sevenDaysFromNow,
            },
          },
        }),
      ]);

      stats = {
        pendingReview: pendingCount,
        inReview: inReviewCount,
        approvedToday: approvedTodayCount,
        rejectedToday: rejectedTodayCount,
        expiringIn7Days: expiringCount,
        totalPending: pendingCount + inReviewCount,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page: filters.page || 1,
        limit: filters.limit || 20,
        totalPages: Math.ceil(total / (filters.limit || 20)),
        stats,
      },
    });
  } catch (error) {
    console.error('Admin verifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching verifications' },
      { status: 500 }
    );
  }
}
