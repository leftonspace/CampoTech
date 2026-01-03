/**
 * All Schedules API Route
 * GET /api/employees/schedule/all - Get all employee schedules for the organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Fetch all schedules for the organization
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        organizationId: session.organizationId,
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

    return NextResponse.json({
      success: true,
      data: {
        schedules,
      },
    });
  } catch (error) {
    console.error('Error fetching all schedules:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener horarios' },
      { status: 500 }
    );
  }
}
