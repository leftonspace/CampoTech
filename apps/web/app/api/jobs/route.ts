import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';
import { JobService } from '@/src/services/job.service';

// Transform scheduledTimeSlot JSON to separate start/end fields for frontend compatibility
function transformJobTimeSlot(job: any): any {
  if (!job) return job;
  const timeSlot = job.scheduledTimeSlot as { start?: string; end?: string } | null;
  return {
    ...job,
    scheduledTimeStart: timeSlot?.start || null,
    scheduledTimeEnd: timeSlot?.end || null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const durationType = searchParams.get('durationType');
    const technicianId = searchParams.get('technicianId');
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search') || searchParams.get('q');
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');
    const sort = searchParams.get('sort') || 'scheduledDate';
    const order = (searchParams.get('order') || 'asc') as 'asc' | 'desc';

    const result = await JobService.listJobs(session.organizationId, {
      status: status && status !== 'all' ? status : undefined,
      durationType: durationType && durationType !== 'all' ? durationType : undefined,
      technicianId: technicianId && technicianId !== 'all' ? technicianId : undefined,
      customerId: customerId || undefined,
      search: search || undefined,
    }, {
      page,
      limit,
      sort,
      order,
    });

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Transform scheduledTimeSlot to separate fields for frontend compatibility
    const transformedJobs = result.items.map(transformJobTimeSlot);

    // Filter data based on user role
    const filteredJobs = filterEntitiesByRole(transformedJobs, 'job', userRole);
    const fieldMeta = getEntityFieldMetadata('job', userRole);

    return NextResponse.json({
      success: true,
      data: filteredJobs,
      _fieldMeta: fieldMeta,
      pagination: result.pagination,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Jobs list error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();

    const job = await JobService.createJob(session.organizationId, session.userId, body);

    return NextResponse.json({
      success: true,
      data: transformJobTimeSlot(job),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Create job error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error creating job' },
      { status: 500 }
    );
  }
}
