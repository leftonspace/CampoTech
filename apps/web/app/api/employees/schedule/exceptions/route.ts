/**
 * Schedule Exceptions API Route
 * POST /api/employees/schedule/exceptions - Add exception (day off, vacation, etc.)
 * DELETE /api/employees/schedule/exceptions - Remove exception
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { userId, date, isAvailable, reason, startTime, endTime } = body;

    const targetUserId = userId || session.userId;

    // Validate inputs
    if (!date) {
      return NextResponse.json(
        { success: false, error: 'Fecha requerida' },
        { status: 400 }
      );
    }

    const exceptionDate = new Date(date);
    if (isNaN(exceptionDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Fecha inválida' },
        { status: 400 }
      );
    }

    // Can't add exception for past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (exceptionDate < today) {
      return NextResponse.json(
        { success: false, error: 'No se puede agregar excepción para fechas pasadas' },
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

    // Upsert exception (create or update)
    const exception = await prisma.scheduleException.upsert({
      where: {
        userId_date: {
          userId: targetUserId,
          date: exceptionDate,
        },
      },
      update: {
        isAvailable: isAvailable ?? false,
        reason: reason || null,
        startTime: isAvailable && startTime ? startTime : null,
        endTime: isAvailable && endTime ? endTime : null,
      },
      create: {
        userId: targetUserId,
        organizationId: session.organizationId,
        date: exceptionDate,
        isAvailable: isAvailable ?? false,
        reason: reason || null,
        startTime: isAvailable && startTime ? startTime : null,
        endTime: isAvailable && endTime ? endTime : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: exception,
    });
  } catch (error) {
    console.error('Error adding exception:', error);
    return NextResponse.json(
      { success: false, error: 'Error al agregar excepción' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const exceptionId = searchParams.get('id');

    if (!exceptionId) {
      return NextResponse.json(
        { success: false, error: 'ID de excepción requerido' },
        { status: 400 }
      );
    }

    // Find exception
    const exception = await prisma.scheduleException.findFirst({
      where: {
        id: exceptionId,
        organizationId: session.organizationId,
      },
    });

    if (!exception) {
      return NextResponse.json(
        { success: false, error: 'Excepción no encontrada' },
        { status: 404 }
      );
    }

    // Check permissions
    const roleUpper = session.role?.toUpperCase();
    if (exception.userId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para eliminar esta excepción' },
        { status: 403 }
      );
    }

    // Delete exception
    await prisma.scheduleException.delete({
      where: { id: exceptionId },
    });

    return NextResponse.json({
      success: true,
      message: 'Excepción eliminada',
    });
  } catch (error) {
    console.error('Error deleting exception:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar excepción' },
      { status: 500 }
    );
  }
}
