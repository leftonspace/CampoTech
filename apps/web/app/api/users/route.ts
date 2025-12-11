/**
 * Users API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          specialty: true,
          skillLevel: true,
          avatar: true,
          isActive: true,
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Session missing organizationId' },
        { status: 400 }
      );
    }

    if (!['OWNER', 'ADMIN', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const existingPhone = await prisma.user.findFirst({
      where: { phone: body.phone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number already in use' },
        { status: 400 }
      );
    }

    if (body.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot create users with OWNER role' },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        role: body.role || 'TECHNICIAN',
        specialty: body.specialty || null,
        skillLevel: body.skillLevel || null,
        isActive: body.isActive ?? true,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        specialty: true,
        skillLevel: true,
        avatar: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
      notificationSent: false,
      onboardingInitialized: false,
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating user' },
      { status: 500 }
    );
  }
}
