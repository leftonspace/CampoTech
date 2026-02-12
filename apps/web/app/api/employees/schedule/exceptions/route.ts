/**
 * Schedule Exceptions API Route
 * POST /api/employees/schedule/exceptions - Add exception (day off, vacation, etc.)
 * DELETE /api/employees/schedule/exceptions - Remove exception
 * 
 * Supports multiple exceptions per day with:
 * - Overlap validation (exceptions cannot overlap in time)
 * - Work hours constraint (partial absences must be within work schedule)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Helper to convert time string to minutes for comparison
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Check if two time ranges overlap
function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const e1 = timeToMinutes(end1);
  const s2 = timeToMinutes(start2);
  const e2 = timeToMinutes(end2);

  // Ranges overlap if one starts before the other ends
  // They can touch (one ends when other starts) - that's allowed
  return s1 < e2 && s2 < e1;
}

// Check if a time range is within work hours
function isWithinWorkHours(
  absenceStart: string,
  absenceEnd: string,
  workStart: string,
  workEnd: string
): boolean {
  const as = timeToMinutes(absenceStart);
  const ae = timeToMinutes(absenceEnd);
  const ws = timeToMinutes(workStart);
  const we = timeToMinutes(workEnd);

  // Absence must be fully within work hours
  return as >= ws && ae <= we;
}

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

    // Validate time format if provided
    if (startTime && !/^\d{1,2}:\d{2}$/.test(startTime)) {
      return NextResponse.json(
        { success: false, error: 'Formato de hora de inicio inválido (use HH:MM)' },
        { status: 400 }
      );
    }
    if (endTime && !/^\d{1,2}:\d{2}$/.test(endTime)) {
      return NextResponse.json(
        { success: false, error: 'Formato de hora de fin inválido (use HH:MM)' },
        { status: 400 }
      );
    }

    // For partial absences, both times are required
    if ((startTime && !endTime) || (!startTime && endTime)) {
      return NextResponse.json(
        { success: false, error: 'Se requiere hora de inicio y fin para ausencias parciales' },
        { status: 400 }
      );
    }

    // Validate start time is before end time
    if (startTime && endTime && timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      return NextResponse.json(
        { success: false, error: 'La hora de inicio debe ser anterior a la hora de fin' },
        { status: 400 }
      );
    }

    // Check permissions
    const roleUpper = session.role?.toUpperCase();
    if (targetUserId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'ADMIN') {
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

    // Get the employee's work schedule for this day
    const dayOfWeek = exceptionDate.getDay();
    const workSchedule = await prisma.employeeSchedule.findUnique({
      where: {
        userId_dayOfWeek: {
          userId: targetUserId,
          dayOfWeek,
        },
      },
    });

    // If partial absence, validate it's within work hours
    if (startTime && endTime && workSchedule?.isAvailable && workSchedule.startTime && workSchedule.endTime) {
      if (!isWithinWorkHours(startTime, endTime, workSchedule.startTime, workSchedule.endTime)) {
        return NextResponse.json(
          {
            success: false,
            error: `La ausencia debe estar dentro del horario de trabajo (${workSchedule.startTime} - ${workSchedule.endTime})`
          },
          { status: 400 }
        );
      }
    }

    // Get existing exceptions for this day (excluding work schedule modifications - those are isAvailable=true)
    const existingExceptions = await prisma.scheduleException.findMany({
      where: {
        userId: targetUserId,
        date: exceptionDate,
      },
    });

    // Separate absence exceptions from work schedule modifications
    const absenceExceptions = existingExceptions.filter((e: { isAvailable: boolean }) => !e.isAvailable);

    // Check for full-day exception conflict
    const hasFullDayException = existingExceptions.some((e: { startTime: string | null; endTime: string | null }) => !e.startTime || !e.endTime);

    // If modifying work schedule (isAvailable=true), check that all absence exceptions still fit within new hours
    if (isAvailable && startTime && endTime && absenceExceptions.length > 0) {
      for (const absence of absenceExceptions) {
        if (absence.startTime && absence.endTime) {
          // Check if absence falls within new work hours
          if (!isWithinWorkHours(absence.startTime, absence.endTime, startTime, endTime)) {
            const reasonLabel = absence.reason || 'Excepción';
            return NextResponse.json(
              {
                success: false,
                error: `No se puede modificar el horario: la excepción "${reasonLabel}" (${absence.startTime} - ${absence.endTime}) quedaría fuera del nuevo horario de trabajo (${startTime} - ${endTime}). Elimine o modifique la excepción primero.`
              },
              { status: 400 }
            );
          }
        }
      }
    }

    if (hasFullDayException && (!startTime || !endTime) && !isAvailable) {
      // Trying to add another full-day exception
      return NextResponse.json(
        { success: false, error: 'Ya existe una excepción de día completo para esta fecha' },
        { status: 400 }
      );
    }

    if (hasFullDayException && startTime && endTime && !isAvailable) {
      // Trying to add partial when full-day exists
      return NextResponse.json(
        { success: false, error: 'No se puede agregar una ausencia parcial cuando existe una excepción de día completo' },
        { status: 400 }
      );
    }

    if (!hasFullDayException && (!startTime || !endTime) && absenceExceptions.length > 0 && !isAvailable) {
      // Trying to add full-day when partial exceptions exist
      return NextResponse.json(
        { success: false, error: 'No se puede agregar una excepción de día completo cuando existen ausencias parciales. Elimine las ausencias parciales primero.' },
        { status: 400 }
      );
    }

    // Check for overlapping time ranges (only for absence exceptions, not work schedule modifications)
    if (startTime && endTime && !isAvailable) {
      for (const existing of absenceExceptions) {
        if (existing.startTime && existing.endTime) {
          if (timeRangesOverlap(startTime, endTime, existing.startTime, existing.endTime)) {
            return NextResponse.json(
              {
                success: false,
                error: `El horario se superpone con otra excepción existente (${existing.startTime} - ${existing.endTime}). Las excepciones no pueden superponerse.`
              },
              { status: 400 }
            );
          }
        }
      }
    }

    // Create the exception (no longer using upsert since we allow multiple per day)
    const exception = await prisma.scheduleException.create({
      data: {
        userId: targetUserId,
        organizationId: session.organizationId,
        date: exceptionDate,
        isAvailable: isAvailable ?? false,
        reason: reason || null,
        startTime: startTime || null,
        endTime: endTime || null,
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
    if (exception.userId !== session.userId && roleUpper !== 'OWNER' && roleUpper !== 'ADMIN') {
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
