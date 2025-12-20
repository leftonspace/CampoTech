/**
 * Admin Global Search API
 * =======================
 *
 * GET /api/admin/search?q=term - Search across organizations, users, payments, verifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { AdminSearchResult } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim() || '';
    const filter = searchParams.get('filter'); // 'blocked', 'expired', 'pending', or null for all
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query.length < 2 && !filter) {
      return NextResponse.json({
        success: true,
        data: {
          organizations: [],
          users: [],
          payments: [],
          verifications: [],
        },
      });
    }

    const result: AdminSearchResult = {
      organizations: [],
      users: [],
      payments: [],
      verifications: [],
    };

    // Build organization filters
    const orgWhere: Record<string, unknown> = {};
    if (query) {
      orgWhere.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { cuit: { contains: query, mode: 'insensitive' } },
        { owner: { email: { contains: query, mode: 'insensitive' } } },
        { owner: { name: { contains: query, mode: 'insensitive' } } },
      ];
    }

    // Apply filters
    if (filter === 'blocked') {
      orgWhere.isBlocked = true;
    }

    // Search organizations
    const organizations = await prisma.organization.findMany({
      where: orgWhere,
      select: {
        id: true,
        name: true,
        cuit: true,
        isBlocked: true,
        verificationStatus: true,
        owner: {
          select: {
            name: true,
            email: true,
          },
        },
        subscription: {
          select: {
            tier: true,
            status: true,
          },
        },
      },
      take: limit,
      orderBy: { name: 'asc' },
    });

    result.organizations = organizations.map((org) => ({
      id: org.id,
      name: org.name,
      cuit: org.cuit,
      ownerName: org.owner?.name || 'Sin propietario',
      ownerEmail: org.owner?.email || '',
      subscriptionTier: org.subscription?.tier || 'FREE',
      subscriptionStatus: org.subscription?.status || 'none',
      verificationStatus: org.verificationStatus || 'not_started',
      isBlocked: org.isBlocked,
    }));

    // Search users (only if query provided)
    if (query) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { cuil: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          cuil: true,
          organizations: {
            select: {
              organization: {
                select: {
                  id: true,
                  name: true,
                },
              },
              role: true,
            },
            take: 1,
          },
        },
        take: limit,
      });

      result.users = users.map((user) => {
        const orgMembership = user.organizations[0];
        return {
          id: user.id,
          name: user.name || '',
          email: user.email,
          cuil: user.cuil,
          organizationId: orgMembership?.organization.id || '',
          organizationName: orgMembership?.organization.name || 'Sin organización',
          role: orgMembership?.role || 'Sin rol',
          verificationStatus: 'not_started' as const, // Would need to calculate this
        };
      });
    }

    // Search payments by MP ID
    if (query && /^[0-9]+$/.test(query)) {
      const payments = await prisma.subscriptionPayment.findMany({
        where: {
          OR: [
            { mpPaymentId: { contains: query } },
            { id: query.length === 24 ? query : undefined },
          ],
        },
        select: {
          id: true,
          mpPaymentId: true,
          organizationId: true,
          amount: true,
          currency: true,
          status: true,
          createdAt: true,
          organization: {
            select: { name: true },
          },
        },
        take: limit,
      });

      result.payments = payments.map((p) => ({
        id: p.id,
        mpPaymentId: p.mpPaymentId,
        organizationId: p.organizationId,
        organizationName: p.organization.name,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        createdAt: p.createdAt.toISOString(),
      }));
    }

    // Search verifications
    if (query || filter === 'pending' || filter === 'expired') {
      const verificationWhere: Record<string, unknown> = {};

      if (query) {
        verificationWhere.OR = [
          { organization: { name: { contains: query, mode: 'insensitive' } } },
          { requirement: { name: { contains: query, mode: 'insensitive' } } },
        ];
      }

      if (filter === 'pending') {
        verificationWhere.status = { in: ['pending', 'in_review'] };
      } else if (filter === 'expired') {
        verificationWhere.status = 'expired';
      }

      const verifications = await prisma.verificationSubmission.findMany({
        where: verificationWhere,
        select: {
          id: true,
          organizationId: true,
          status: true,
          createdAt: true,
          organization: {
            select: { name: true },
          },
          requirement: {
            select: { name: true },
          },
        },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });

      result.verifications = verifications.map((v) => ({
        id: v.id,
        organizationId: v.organizationId,
        organizationName: v.organization.name,
        requirementName: v.requirement.name,
        status: v.status,
        submittedAt: v.createdAt.toISOString(),
      }));
    }

    return NextResponse.json({
      success: true,
      data: result,
      query,
      filter,
    });
  } catch (error) {
    console.error('Admin search error:', error);
    return NextResponse.json(
      { success: false, error: 'Error performing search' },
      { status: 500 }
    );
  }
}
