/**
 * Admin Organization Detail & Actions API
 * =========================================
 *
 * GET /api/admin/organizations/:id - Get organization compliance detail
 * POST /api/admin/organizations/:id - Perform actions (block, unblock)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  OrganizationComplianceDetail,
  OrganizationRequirementStatus,
  EmployeeVerificationStatus,
} from '@/types';

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

    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        users: {
          where: {
            role: { in: ['ADMIN', 'TECHNICIAN'] },
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        verificationSubmissions: {
          include: {
            requirement: true,
          },
          orderBy: { submittedAt: 'desc' },
        },
      },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get all requirements
    const allRequirements = await prisma.verificationRequirement.findMany({
      where: { isActive: true },
      orderBy: [{ tier: 'asc' }, { displayOrder: 'asc' }],
    });

    // Get employee-specific requirements
    const employeeRequirements = allRequirements.filter(
      (r) => r.appliesTo === 'employee'
    );

    // Map requirements to their status
    const requirements: OrganizationRequirementStatus[] = allRequirements
      .filter((r) => r.appliesTo !== 'employee')
      .map((req) => {
        const submission = organization.verificationSubmissions.find(
          (s) => s.requirementId === req.id && !s.userId // Organization-level submission
        );

        return {
          requirementId: req.id,
          code: req.code,
          name: req.name,
          category: req.category as OrganizationRequirementStatus['category'],
          tier: req.tier,
          isRequired: req.isRequired,
          status: submission
            ? (submission.status as OrganizationRequirementStatus['status'])
            : 'not_submitted',
          submittedAt: submission?.submittedAt.toISOString() || null,
          verifiedAt: submission?.verifiedAt?.toISOString() || null,
          expiresAt: submission?.expiresAt?.toISOString() || null,
          documentUrl: submission?.documentUrl || null,
        };
      });

    // Get employee verification statuses
    const employees: EmployeeVerificationStatus[] = await Promise.all(
      organization.users.map(async (user) => {
        const userSubmissions = organization.verificationSubmissions.filter(
          (s) => s.userId === user.id
        );

        const completedRequirements = userSubmissions.filter(
          (s) => s.status === 'approved'
        ).length;

        const pendingSubmissions = userSubmissions.filter(
          (s) => s.status === 'pending' || s.status === 'in_review'
        ).length;

        let verificationStatus: EmployeeVerificationStatus['verificationStatus'] = 'not_started';
        if (completedRequirements === employeeRequirements.length) {
          verificationStatus = 'verified';
        } else if (pendingSubmissions > 0 || completedRequirements > 0) {
          verificationStatus = 'pending';
        }

        return {
          userId: user.id,
          name: user.name || 'Sin nombre',
          email: user.email,
          role: user.role,
          verificationStatus,
          completedRequirements,
          totalRequirements: employeeRequirements.length,
          canBeAssignedJobs: verificationStatus === 'verified',
        };
      })
    );

    // Calculate tier progress
    const tier2Requirements = requirements.filter((r) => r.tier === 2);
    const tier2Completed = tier2Requirements.filter((r) => r.status === 'approved').length;

    const tier3Requirements = requirements.filter((r) => r.tier === 3);
    const tier3Completed = tier3Requirements.filter((r) => r.status === 'approved').length;

    const badgesEarned = requirements.filter(
      (r) => r.tier === 4 && r.status === 'approved'
    ).length;

    const detail: OrganizationComplianceDetail = {
      organizationId: organization.id,
      organizationName: organization.name,
      cuit: organization.cuit,
      ownerName: organization.owner?.name || 'Sin dueño',
      ownerEmail: organization.owner?.email || '',
      verificationStatus: (organization.verificationStatus as OrganizationComplianceDetail['verificationStatus']) || 'not_started',
      tier2Progress: {
        completed: tier2Completed,
        total: tier2Requirements.length,
      },
      tier3Progress: {
        completed: tier3Completed,
        total: tier3Requirements.length,
      },
      badgesEarned,
      isBlocked: organization.verificationStatus === 'suspended',
      blockReason: null,
      createdAt: organization.createdAt.toISOString(),
      requirements,
      employees,
    };

    return NextResponse.json({
      success: true,
      data: detail,
    });
  } catch (error) {
    console.error('Admin organization detail error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching organization' },
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

    if (session.role === 'viewer') {
      return NextResponse.json(
        { success: false, error: 'Permission denied' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { action, ...data } = body;

    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'block':
        return handleBlock(id, data, session);

      case 'unblock':
        return handleUnblock(id, session);

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Admin organization action error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing action' },
      { status: 500 }
    );
  }
}

async function handleBlock(
  organizationId: string,
  data: { reason?: string },
  session: { id: string; name: string }
) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      verificationStatus: 'suspended',
    },
  });

  // TODO: Log this action to an audit table
  // TODO: Send notification to organization owner

  return NextResponse.json({
    success: true,
    message: 'Organización bloqueada',
  });
}

async function handleUnblock(
  organizationId: string,
  session: { id: string; name: string }
) {
  // Determine the appropriate status based on verification progress
  const approvedSubmissions = await prisma.verificationSubmission.count({
    where: {
      organizationId,
      status: 'approved',
      requirement: {
        tier: 2,
        isRequired: true,
      },
    },
  });

  const requiredCount = await prisma.verificationRequirement.count({
    where: {
      tier: 2,
      isRequired: true,
      isActive: true,
      appliesTo: { not: 'employee' },
    },
  });

  const newStatus = approvedSubmissions >= requiredCount ? 'verified' : 'pending';

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      verificationStatus: newStatus,
    },
  });

  // TODO: Log this action to an audit table
  // TODO: Send notification to organization owner

  return NextResponse.json({
    success: true,
    message: `Organización desbloqueada (estado: ${newStatus})`,
  });
}
