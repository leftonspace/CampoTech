/**
 * AI Co-Pilot Availability Check API
 * ===================================
 *
 * Checks technician availability for scheduling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('date');
    const durationHours = parseInt(searchParams.get('duration_hours') || '2', 10);

    const date = dateStr ? new Date(dateStr) : new Date();
    date.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get technicians
    const technicians = await prisma.user.findMany({
      where: {
        organizationId: session.organizationId,
        role: 'TECHNICIAN',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    });

    // Get jobs for each technician on the specified date
    const slots: Array<{
      technicianId: string;
      technicianName: string;
      slots: Array<{
        start: string;
        end: string;
        available: boolean;
        jobId?: string;
        jobTitle?: string;
      }>;
    }> = [];

    for (const tech of technicians) {
      const jobs = await prisma.job.findMany({
        where: {
          assignedToId: tech.id,
          scheduledDate: {
            gte: date,
            lte: endOfDay,
          },
        },
        select: {
          id: true,
          title: true,
          scheduledDate: true,
          estimatedDuration: true,
        },
        orderBy: { scheduledDate: 'asc' },
      });

      // Create time slots (9:00 AM to 6:00 PM in 2-hour blocks)
      const timeSlots = [];
      const workStart = 9;
      const workEnd = 18;

      for (let hour = workStart; hour < workEnd; hour += 2) {
        const slotStart = new Date(date);
        slotStart.setHours(hour, 0, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(hour + 2, 0, 0, 0);

        // Check if slot overlaps with any job
        const overlappingJob = jobs.find((job: { id: string; title: string; scheduledDate: Date | null; estimatedDuration: number | null }) => {
          if (!job.scheduledDate) return false;
          const jobStart = new Date(job.scheduledDate);
          const jobEnd = new Date(job.scheduledDate);
          jobEnd.setHours(jobEnd.getHours() + (job.estimatedDuration || 2));

          return jobStart < slotEnd && jobEnd > slotStart;
        });

        timeSlots.push({
          start: `${hour.toString().padStart(2, '0')}:00`,
          end: `${(hour + 2).toString().padStart(2, '0')}:00`,
          available: !overlappingJob,
          jobId: overlappingJob?.id,
          jobTitle: overlappingJob?.title,
        });
      }

      slots.push({
        technicianId: tech.id,
        technicianName: tech.name,
        slots: timeSlots,
      });
    }

    // Find best recommendation
    const availableSlots = slots
      .flatMap((tech) =>
        tech.slots
          .filter((s) => s.available)
          .map((s) => ({
            technicianId: tech.technicianId,
            technicianName: tech.technicianName,
            ...s,
          }))
      );

    const recommendation = availableSlots.length > 0 ? availableSlots[0] : null;

    return NextResponse.json({
      success: true,
      date: date.toISOString().split('T')[0],
      slots,
      recommendation: recommendation
        ? {
            technician: recommendation.technicianName,
            time: `${recommendation.start} - ${recommendation.end}`,
            message: `${recommendation.technicianName} está disponible de ${recommendation.start} a ${recommendation.end}`,
          }
        : null,
    });
  } catch (error) {
    console.error('Availability check error:', error);
    return NextResponse.json(
      { success: false, error: 'Error checking availability' },
      { status: 500 }
    );
  }
}
