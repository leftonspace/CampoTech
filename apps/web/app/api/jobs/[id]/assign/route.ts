import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { onTechnicianAssigned } from '@/src/modules/whatsapp/notification-triggers.service';
import { canEmployeeBeAssignedJobs } from '@/lib/services/employee-verification-notifications';
import { JobService } from '@/src/services/job.service';
import { jobRouteIntegrationService } from '@/lib/services/job-route-integration.service';
import { validateBody, jobAssignSchema } from '@/lib/validation/api-schemas';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id } = await params;

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateBody(body, jobAssignSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    // Note: jobAssignSchema expects 'technicianId', but route uses 'userId' - handle both
    const userId = body.userId || validation.data.technicianId;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    // Verify the job belongs to the organization
    const existing = await JobService.getJobById(session.organizationId, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    // Phase 10 Security: Check terminal state before allowing assignment
    const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
    if (TERMINAL_STATES.includes(existing.status)) {
      console.warn('[SECURITY] Job assign terminal state violation:', {
        jobId: id,
        currentStatus: existing.status,
        userId: session.userId,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        {
          success: false,
          error: `No se puede asignar técnico a un trabajo ${existing.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
          terminalStateBlocked: true,
        },
        { status: 403 }
      );
    }

    // Verify the user belongs to the organization
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId: session.organizationId,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if employee can be assigned jobs (verification status)
    const verificationCheck = await canEmployeeBeAssignedJobs(userId, session.organizationId);
    if (!verificationCheck.canAssign) {
      return NextResponse.json(
        {
          success: false,
          error: verificationCheck.reason || 'Este empleado no puede recibir trabajos. Verificación pendiente.',
          verificationLink: `/dashboard/team?employee=${userId}&tab=verification`,
        },
        { status: 403 }
      );
    }

    // Use JobService to assign the job
    const job = await JobService.assignJob(session.organizationId, id, userId);

    // Trigger WhatsApp notification for technician assignment (non-blocking)
    onTechnicianAssigned(id, userId).catch((err) => {
      console.error('WhatsApp notification error:', err);
    });

    // Phase 2.3.3: Trigger route regeneration on job assignment (non-blocking)
    if (job.scheduledDate) {
      jobRouteIntegrationService.onJobChange({
        jobId: id,
        technicianId: userId,
        organizationId: session.organizationId,
        scheduledDate: job.scheduledDate,
        previousTechnicianId: existing.technicianId || null,
        status: job.status,
      }).catch((err) => {
        console.error('Route regeneration error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Assign job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error assigning job' },
      { status: 500 }
    );
  }
}
