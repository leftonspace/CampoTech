/**
 * Admin Organizations Compliance API
 * ====================================
 *
 * GET /api/admin/organizations - List organizations with compliance status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { OrganizationComplianceItem } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || undefined;
    const verificationStatus = searchParams.get('verificationStatus') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { cuit: { contains: search, mode: 'insensitive' } },
        { owner: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (verificationStatus !== 'all') {
      where.verificationStatus = verificationStatus;
    }

    // Get total count
    const total = await prisma.organization.count({ where });

    // Get organizations with compliance data
    const organizations = await prisma.organization.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        verificationSubmissions: {
          where: {
            status: 'approved',
          },
          include: {
            requirement: {
              select: {
                tier: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Get tier requirements counts
    const tier2Requirements = await prisma.verificationRequirement.count({
      where: { tier: 2, isActive: true, isRequired: true },
    });

    const tier3Requirements = await prisma.verificationRequirement.count({
      where: { tier: 3, isActive: true },
    });

    const tier4Requirements = await prisma.verificationRequirement.count({
      where: { tier: 4, isActive: true },
    });

    // Transform to compliance items
    const items: OrganizationComplianceItem[] = organizations.map((org) => {
      const tier2Completed = org.verificationSubmissions.filter(
        (s) => s.requirement.tier === 2
      ).length;

      const tier3Completed = org.verificationSubmissions.filter(
        (s) => s.requirement.tier === 3
      ).length;

      const badgesEarned = org.verificationSubmissions.filter(
        (s) => s.requirement.tier === 4
      ).length;

      return {
        organizationId: org.id,
        organizationName: org.name,
        cuit: org.cuit,
        ownerName: org.owner?.name || 'Sin dueño',
        ownerEmail: org.owner?.email || '',
        verificationStatus: (org.verificationStatus as OrganizationComplianceItem['verificationStatus']) || 'not_started',
        tier2Progress: {
          completed: tier2Completed,
          total: tier2Requirements,
        },
        tier3Progress: {
          completed: tier3Completed,
          total: tier3Requirements,
        },
        badgesEarned,
        isBlocked: org.verificationStatus === 'suspended',
        blockReason: null, // Would need a separate field for this
        createdAt: org.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Admin organizations error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching organizations' },
      { status: 500 }
    );
  }
}
