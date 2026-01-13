/**
 * Employee Schedule API Route
 * GET /api/employees/schedule - Fetch schedule for a user
 * PUT /api/employees/schedule - Update schedule for a day
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
    const { userId, dayOfWeek, startTime, endTime, isAvailable } = body;

    const targetUserId = userId || session.userId;

    // Validate inputs
    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json(
        { success: false, error: 'Día de la semana inválido' },
        { status: 400 }
      );
    }

    if (!startTime || !endTime) {
      return NextResponse.json(
        { success: false, error: 'Horarios requeridos' },
        { status: 400 }
      );
    }

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
    const { userId, scheduleType, advanceNoticeHours } = body;

    const targetUserId = userId || session.userId;

    // Check permissions
    const roleUpper = session.role?.toUpperCase();
    if (targetUserId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para modificar este horario' },
        { status: 403 }
      );
    }

    // Validate schedule type
    const validTypes = ['base', 'rotating', 'ondemand', 'custom'];
    if (scheduleType && !validTypes.includes(scheduleType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de horario inválido' },
        { status: 400 }
      );
    }

    // Update user's schedule settings
    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(scheduleType && { scheduleType }),
        ...(advanceNoticeHours !== undefined && { advanceNoticeHours: Math.max(0, parseInt(advanceNoticeHours) || 0) }),
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
