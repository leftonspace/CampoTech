/**
 * Employee Availability API Route
 * GET /api/employees/availability - Check which employees are available at a given date/time
 *
 * Query params:
 * - date: YYYY-MM-DD (required)
 * - time: HH:MM (optional, defaults to current time)
 * - includeLocation: boolean (optional, include current GPS location)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface AvailableEmployee {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  specialty: string | null;
  skillLevel: string | null;
  isAvailable: boolean;
  scheduleInfo: {
    startTime: string;
    endTime: string;
    isException: boolean;
    exceptionReason?: string;
  } | null;
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  } | null;
  currentJobCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only owners and dispatchers can check availability
    const roleUpper = session.role?.toUpperCase();
    if (roleUpper !== 'OWNER' && roleUpper !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver disponibilidad' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const timeStr = searchParams.get('time');
    const includeLocation = searchParams.get('includeLocation') === 'true';

    if (!dateStr) {
      return NextResponse.json(
        { success: false, error: 'Fecha requerida (formato: YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    // Parse date
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) {
      return NextResponse.json(
        { success: false, error: 'Fecha inválida' },
        { status: 400 }
      );
    }

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = targetDate.getDay();

    // Parse time (default to current time if not provided)
    const now = new Date();
    const targetTime = timeStr || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Helper to compare times in HH:MM format
    const timeToMinutes = (time: string): number => {
      const [hours, minutes] = time.split(':').map(Number);
      return hours * 60 + minutes;
    };

    const targetMinutes = timeToMinutes(targetTime);

    // Get all active technicians and dispatchers in the organization
    const employees = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        isActive: true,
        role: { in: ['TECHNICIAN', 'DISPATCHER'] },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        avatar: true,
        specialty: true,
        skillLevel: true,
      },
    });

    // Get schedules for this day of week
    const schedules = await prisma.employeeSchedule.findMany({
      where: {
        organizationId: session.organizationId,
        dayOfWeek,
        isAvailable: true,
      },
    });

    // Get exceptions for this date
    const exceptions = await prisma.scheduleException.findMany({
      where: {
        organizationId: session.organizationId,
        date: targetDate,
      },
    });

    // Get jobs assigned for this date to check conflicts
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const assignedJobs = await prisma.jobAssignment.findMany({
      where: {
        job: {
          organizationId: session.organizationId,
          scheduledDate: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            notIn: ['COMPLETED', 'CANCELLED'],
          },
        },
      },
      include: {
        job: {
          select: {
            id: true,
            scheduledTimeStart: true,
            scheduledTimeEnd: true,
            estimatedDuration: true,
          },
        },
      },
    });

    // Get current locations if requested
    let locations: Map<string, { lat: number; lng: number; updatedAt: Date }> = new Map();
    if (includeLocation) {
      const techLocations = await prisma.technicianLocation.findMany({
        where: {
          organizationId: session.organizationId,
        },
        select: {
          technicianId: true,
          latitude: true,
          longitude: true,
          updatedAt: true,
        },
      });
      techLocations.forEach((loc: { technicianId: string; latitude: any; longitude: any; updatedAt: any }) => {
        locations.set(loc.technicianId, {
          lat: loc.latitude,
          lng: loc.longitude,
          updatedAt: loc.updatedAt,
        });
      });
    }

    // Build availability result
    const scheduleMap = new Map(schedules.map((s: { userId: string; startTime: string; endTime: string }) => [s.userId, s]));
    const exceptionMap = new Map(exceptions.map((e: { userId: string; isAvailable: boolean; startTime: string | null; endTime: string | null; reason: string | null }) => [e.userId, e]));

    // Count jobs per employee
    const jobCountMap = new Map<string, number>();
    assignedJobs.forEach((assignment: { jobId: string; technicianId: string; job: { scheduledDate: Date | null; scheduledTimeStart: string | null; scheduledTimeEnd: string | null; estimatedDuration: number | null } }) => {
      const count = jobCountMap.get(assignment.technicianId) || 0;
      jobCountMap.set(assignment.technicianId, count + 1);
    });

    const availableEmployees: AvailableEmployee[] = employees.map((employee: { id: string; name: string; specialty: string | null; phone: string | null; avatar: string | null; skillLevel: string | null }) => {
      const schedule = scheduleMap.get(employee.id) as { userId: string; startTime: string; endTime: string } | undefined;
      const exception = exceptionMap.get(employee.id) as { userId: string; isAvailable: boolean; startTime: string | null; endTime: string | null; reason: string | null } | undefined;
      const location = locations.get(employee.id);
      const jobCount = jobCountMap.get(employee.id) || 0;

      // Determine availability
      let isAvailable = false;
      let scheduleInfo: AvailableEmployee['scheduleInfo'] = null;

      // Check exception first (overrides regular schedule)
      if (exception) {
        if (exception.isAvailable && exception.startTime && exception.endTime) {
          // Available with special hours
          const exceptionStart = timeToMinutes(exception.startTime);
          const exceptionEnd = timeToMinutes(exception.endTime);
          isAvailable = targetMinutes >= exceptionStart && targetMinutes <= exceptionEnd;
          scheduleInfo = {
            startTime: exception.startTime,
            endTime: exception.endTime,
            isException: true,
            exceptionReason: exception.reason || undefined,
          };
        } else {
          // Not available (day off)
          isAvailable = false;
          scheduleInfo = null;
        }
      } else if (schedule) {
        // Check regular schedule
        const scheduleStart = timeToMinutes(schedule.startTime);
        const scheduleEnd = timeToMinutes(schedule.endTime);
        isAvailable = targetMinutes >= scheduleStart && targetMinutes <= scheduleEnd;
        scheduleInfo = {
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          isException: false,
        };
      }

      // Check for job conflicts at the requested time
      if (isAvailable) {
        const conflictingJobs = assignedJobs.filter((a: { jobId: string; technicianId: string; job: { scheduledDate: Date | null; scheduledTimeStart: string | null; scheduledTimeEnd: string | null; estimatedDuration: number | null } }) => {
          if (a.technicianId !== employee.id) return false;

          // Use separate time fields from Prisma schema
          if (!a.job.scheduledTimeStart) return false;

          const jobStart = timeToMinutes(a.job.scheduledTimeStart);
          const jobEnd = a.job.scheduledTimeEnd
            ? timeToMinutes(a.job.scheduledTimeEnd)
            : jobStart + (a.job.estimatedDuration || 60);

          // Check if target time overlaps with job
          return targetMinutes >= jobStart && targetMinutes < jobEnd;
        });

        if (conflictingJobs.length > 0) {
          isAvailable = false;
        }
      }

      return {
        id: employee.id,
        name: employee.name,
        phone: employee.phone,
        avatar: employee.avatar,
        specialty: employee.specialty,
        skillLevel: employee.skillLevel,
        isAvailable,
        scheduleInfo,
        currentLocation: location
          ? {
              lat: location.lat,
              lng: location.lng,
              updatedAt: location.updatedAt.toISOString(),
            }
          : null,
        currentJobCount: jobCount,
      };
    });

    // Sort: available first, then by job count (less busy first)
    availableEmployees.sort((a, b) => {
      if (a.isAvailable !== b.isAvailable) {
        return a.isAvailable ? -1 : 1;
      }
      return a.currentJobCount - b.currentJobCount;
    });

    return NextResponse.json({
      success: true,
      data: {
        date: dateStr,
        time: targetTime,
        dayOfWeek,
        employees: availableEmployees,
        availableCount: availableEmployees.filter((e) => e.isAvailable).length,
        totalCount: availableEmployees.length,
      },
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { success: false, error: 'Error al verificar disponibilidad' },
      { status: 500 }
    );
  }
}


