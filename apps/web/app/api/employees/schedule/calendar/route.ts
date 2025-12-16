/**
 * Team Calendar API Route
 * GET /api/employees/schedule/calendar - Get aggregated schedule data for all employees
 *
 * Query params:
 * - month: 1-12 (required)
 * - year: YYYY (required)
 * - employeeIds: comma-separated list (optional, defaults to all)
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
    const monthStr = searchParams.get('month');
    const yearStr = searchParams.get('year');
    const employeeIdsParam = searchParams.get('employeeIds');

    if (!monthStr || !yearStr) {
      return NextResponse.json(
        { success: false, error: 'Mes y año son requeridos' },
        { status: 400 }
      );
    }

    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (month < 1 || month > 12 || isNaN(year)) {
      return NextResponse.json(
        { success: false, error: 'Mes o año inválido' },
        { status: 400 }
      );
    }

    // Calculate date range for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Parse employee IDs if provided
    const employeeIds = employeeIdsParam
      ? employeeIdsParam.split(',').filter(Boolean)
      : null;

    // Fetch all active employees in the organization (technicians and dispatchers)
    const employeeWhere: any = {
      organizationId: session.organizationId,
      isActive: true,
      role: { in: ['TECHNICIAN', 'DISPATCHER', 'OWNER'] },
    };

    if (employeeIds && employeeIds.length > 0) {
      employeeWhere.id = { in: employeeIds };
    }

    const employees = await prisma.user.findMany({
      where: employeeWhere,
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    const employeeIdList = employees.map((e: { id: string }) => e.id);

    // Fetch all schedules for these employees
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        organizationId: session.organizationId,
        userId: { in: employeeIdList },
      },
      select: {
        id: true,
        userId: true,
        dayOfWeek: true,
        startTime: true,
        endTime: true,
        isAvailable: true,
      },
    });

    // Fetch all exceptions for the month
    const exceptions = await prisma.scheduleException.findMany({
      where: {
        organizationId: session.organizationId,
        userId: { in: employeeIdList },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        userId: true,
        date: true,
        isAvailable: true,
        reason: true,
        startTime: true,
        endTime: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: {
        employees,
        schedules,
        exceptions: exceptions.map((e: { id: string; userId: string; date: Date; isAvailable: boolean; startTime: string | null; endTime: string | null; reason: string | null }) => ({
          ...e,
          date: e.date.toISOString(),
        })),
        month,
        year,
      },
    });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos del calendario' },
      { status: 500 }
    );
  }
}

