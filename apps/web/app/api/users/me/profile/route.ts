/**
 * User Profile API Route
 * GET /api/users/me/profile - Get current user's profile with field metadata
 * PUT /api/users/me/profile - Update current user's profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
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
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role (isSelf = true since viewing own profile)
    const filteredData = filterEntityByRole(user, 'user', userRole, true);
    const fieldMeta = getEntityFieldMetadata('user', userRole, true);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo perfil' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Validate that user can edit the fields they're trying to update (isSelf = true)
    const validation = validateEntityUpdate(body, 'user', userRole, true);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    // Build update data - only include allowed self-editable fields
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;

    // Check if email already exists in organization (if changed)
    if (body.email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: body.email,
          organizationId: session.organizationId,
          NOT: { id: session.userId },
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Este email ya esta en uso' },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: session.userId },
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
      },
    });

    // Filter response based on permissions
    const filteredData = filterEntityByRole(user, 'user', userRole, true);
    const fieldMeta = getEntityFieldMetadata('user', userRole, true);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
      message: 'Perfil actualizado correctamente',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando perfil' },
      { status: 500 }
    );
  }
}
