import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';
import { JobService } from '@/src/services/job.service';
import { jobRouteIntegrationService } from '@/lib/services/job-route-integration.service';
import { parseDateTimeAsArgentina } from '@/lib/timezone';

// Transform scheduledTimeSlot JSON to separate start/end fields for frontend compatibility
function transformJobTimeSlot<T extends { scheduledTimeSlot?: unknown }>(job: T): T & { scheduledTimeStart: string | null; scheduledTimeEnd: string | null } {
  if (!job) return job;
  const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
  return {
    ...job,
    scheduledTimeStart: timeSlot?.start || null,
    scheduledTimeEnd: timeSlot?.end || null,
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const job = await JobService.getJobById(session.organizationId, id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // For technicians, only show their own jobs or jobs they are assigned to
    const isAssigned = job.technicianId === session.userId ||
      job.assignments.some((a: { technicianId: string }) => a.technicianId === session.userId);

    if (userRole === 'TECHNICIAN' && !isAssigned) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para ver este trabajo' },
        { status: 403 }
      );
    }

    // Transform scheduledTimeSlot to separate fields for frontend compatibility
    const transformedJob = transformJobTimeSlot(job);

    // Filter data based on user role
    const filteredData = filterEntityByRole(transformedJob, 'job', userRole);
    const fieldMeta = getEntityFieldMetadata('job', userRole);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Get job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching job' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { description, urgency, priority, scheduledDate, scheduledTimeStart, scheduledTimeEnd, ...otherData } = await request.json();

    const existing = await JobService.getJobById(session.organizationId, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // SECURITY: Block updates on completed/cancelled jobs
    // This is the authoritative server-side check - frontend disabled state is cosmetic only
    // ═══════════════════════════════════════════════════════════════════════════════
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      return NextResponse.json(
        {
          success: false,
          error: `Este trabajo está ${existing.status === 'COMPLETED' ? 'completado' : 'cancelado'} y no puede ser modificado`
        },
        { status: 403 }
      );
    }

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Prepare update data
    const updateData: Record<string, unknown> = {
      description,
      urgency: urgency || priority?.toUpperCase(),
      scheduledDate: scheduledDate ? parseDateTimeAsArgentina(scheduledDate, scheduledTimeStart) : undefined,
      scheduledTimeSlot: scheduledTimeStart && scheduledTimeEnd
        ? { start: scheduledTimeStart, end: scheduledTimeEnd }
        : undefined,
      ...otherData
    };

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(updateData, 'job', userRole);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    // For technicians, only allow editing their own jobs
    const isAssigned = existing.technicianId === session.userId ||
      existing.assignments.some((a: { technicianId: string }) => a.technicianId === session.userId);

    if (userRole === 'TECHNICIAN' && !isAssigned) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar este trabajo' },
        { status: 403 }
      );
    }

    const job = await JobService.updateJob(session.organizationId, id, updateData);

    // Phase 2.3.3: Trigger route regeneration if schedule changed (non-blocking)
    const scheduleChanged = scheduledDate !== existing.scheduledDate?.toISOString()?.split('T')[0] ||
      scheduledTimeStart !== (existing as Record<string, unknown>).scheduledTimeStart ||
      scheduledTimeEnd !== (existing as Record<string, unknown>).scheduledTimeEnd;

    if (scheduleChanged && job.technicianId && job.scheduledDate) {
      jobRouteIntegrationService.onJobChange({
        jobId: id,
        technicianId: job.technicianId,
        organizationId: session.organizationId,
        scheduledDate: job.scheduledDate,
        previousScheduledDate: existing.scheduledDate || null,
        status: job.status,
      }).catch((err) => {
        console.error('Route regeneration error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: transformJobTimeSlot(job),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Update job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error updating job' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session || session.role !== 'OWNER' && session.role !== 'DISPATCHER') {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    await JobService.deleteJob(session.organizationId, id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Delete job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error deleting job' },
      { status: 500 }
    );
  }
}
