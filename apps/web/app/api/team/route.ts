/**
 * Team API Route
 * List team members for the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/team
 * List all team members in the organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');

    const where: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (role) {
      where.role = role.toUpperCase();
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const members = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        members,
        total: members.length,
      },
    });
  } catch (error) {
    console.error('Team list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching team members' },
      { status: 500 }
    );
  }
}
