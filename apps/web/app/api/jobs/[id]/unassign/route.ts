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

    const { userId } = await request.json();

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
