import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';


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
    const userId = body.userId;

    if (!userId || typeof userId !== 'string') {
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

    // Phase 10 Security: Check terminal state before allowing unassignment
    const TERMINAL_STATES = ['COMPLETED', 'CANCELLED'];
    if (TERMINAL_STATES.includes(existing.status)) {
      console.warn('[SECURITY] Job unassign terminal state violation:', {
        jobId: id,
        currentStatus: existing.status,
        userId: session.userId,
        timestamp: new Date().toISOString(),
      });
      return NextResponse.json(
        {
          success: false,
          error: `No se puede desasignar técnico de un trabajo ${existing.status === 'COMPLETED' ? 'completado' : 'cancelado'}`,
          terminalStateBlocked: true,
        },
        { status: 403 }
      );
    }

    // Use JobService to unassign the technician
    const job = await JobService.unassignJob(session.organizationId, id, userId);

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Unassign job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error unassigning job' },
      { status: 500 }
    );
  }
}
