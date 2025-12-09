import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        id: params.id,
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
        createdAt: true,
        updatedAt: true,
        assignedJobs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            jobNumber: true,
            description: true,
            status: true,
            scheduledDate: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // First verify user belongs to this organization
    const existing = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Only OWNER and ADMIN can update other users
    const isEditingSelf = session.userId === params.id;
    if (!isEditingSelf && !['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Prevent changing OWNER role
    if (existing.role === 'OWNER' && body.role && body.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot change OWNER role' },
        { status: 400 }
      );
    }

    // Prevent assigning OWNER role to non-owners
    if (body.role === 'OWNER' && existing.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot assign OWNER role' },
        { status: 400 }
      );
    }

    // Check if email already exists in organization (if changed)
    if (body.email && body.email !== existing.email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: body.email,
          organizationId: session.organizationId,
          NOT: { id: params.id },
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already in use in this organization' },
          { status: 400 }
        );
      }
    }

    // Build update data - only include fields that were sent
    const updateData: any = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.specialty !== undefined) updateData.specialty = body.specialty || null;
    if (body.skillLevel !== undefined) updateData.skillLevel = body.skillLevel || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
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
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating user' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can delete users
    if (!['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // First verify user belongs to this organization
    const existing = await prisma.user.findFirst({
      where: {
        id: params.id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting OWNER
    if (existing.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete organization owner' },
        { status: 400 }
      );
    }

    // Prevent deleting yourself
    if (session.userId === params.id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // Check if user has assigned jobs
    const assignedJobs = await prisma.job.count({
      where: {
        technicianId: params.id,
        status: { in: ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
    });

    if (assignedJobs > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete user with ${assignedJobs} active job(s). Please reassign or complete them first.`
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting user' },
      { status: 500 }
    );
  }
}
