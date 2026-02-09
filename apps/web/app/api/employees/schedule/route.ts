/**
 * Employee Schedule API Route
 * GET /api/employees/schedule - Fetch schedule for a user
 * PUT /api/employees/schedule - Update schedule for a day
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateBody, employeeScheduleSchema } from '@/lib/validation/api-schemas';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId') || session.userId;

    // Check permissions: users can only view their own schedule unless owner/dispatcher
    const roleUpper = session.role?.toUpperCase();
    if (targetUserId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este horario' },
        { status: 403 }
      );
    }

    // Verify target user belongs to same organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId: session.organizationId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Fetch weekly schedules
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        userId: targetUserId,
        organizationId: session.organizationId,
      },
      orderBy: { dayOfWeek: 'asc' },
    });

    // Fetch exceptions (from today onwards)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exceptions = await prisma.scheduleException.findMany({
      where: {
        userId: targetUserId,
        organizationId: session.organizationId,
        date: { gte: today },
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        userId: targetUserId,
        schedules,
        exceptions,
      },
    });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cargar horario' },
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

    // Validate request body with Zod
    const validation = validateBody(body, employeeScheduleSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { userId, dayOfWeek, startTime, endTime, isAvailable } = validation.data;
    const targetUserId = userId;

    // Check permissions
    const roleUpper = session.role?.toUpperCase();
    if (targetUserId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar este horario' },
        { status: 403 }
      );
    }

    // Verify target user belongs to same organization
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        organizationId: session.organizationId,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Upsert schedule (create or update)
    const schedule = await prisma.employeeSchedule.upsert({
      where: {
        userId_dayOfWeek: {
          userId: targetUserId,
          dayOfWeek,
        },
      },
      update: {
        startTime,
        endTime,
        isAvailable,
        updatedAt: new Date(),
      },
      create: {
        userId: targetUserId,
        organizationId: session.organizationId,
        dayOfWeek,
        startTime,
        endTime,
        isAvailable,
      },
    });

    return NextResponse.json({
      success: true,
      data: schedule,
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar horario' },
      { status: 500 }
    );
  }
}

// PATCH - Update schedule type and advance notice for a user
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Zod validation schema for schedule settings
    const scheduleSettingsSchema = z.object({
      userId: z.string().uuid().optional(),
      scheduleType: z.enum(['base', 'rotating', 'ondemand', 'custom']).optional(),
      advanceNoticeHours: z.number().int().min(0).max(168).optional(),
    });

    const validation = validateBody(body, scheduleSettingsSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { userId, scheduleType, advanceNoticeHours } = validation.data;
    const targetUserId = userId || session.userId;

    // Check permissions
    const roleUpper = session.role?.toUpperCase();
    if (targetUserId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar este horario' },
        { status: 403 }
      );
    }

    // Update user's schedule settings
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(scheduleType && { scheduleType }),
        ...(advanceNoticeHours !== undefined && { advanceNoticeHours: Math.max(0, advanceNoticeHours) }),
      },
      select: {
        id: true,
        scheduleType: true,
        advanceNoticeHours: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedUser,
    });
  } catch (error) {
    console.error('Error updating schedule settings:', error);
    return NextResponse.json(
      { success: false, error: 'Error al actualizar configuración de horario' },
      { status: 500 }
    );
  }
}
