import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';

/**
 * Jobs Today API
 * Returns today's jobs for the dashboard
 */

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get today's date boundaries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch jobs for today using JobService
    const result = await JobService.listJobs(session.organizationId, {
      startDate: today,
      endDate: tomorrow,
    }, {
      limit: 100, // Reasonable limit for "today"
      sort: 'scheduledDate',
      order: 'asc',
    });

    const jobs = result.items;

    // Get summary stats
    type JobType = typeof jobs[number];
    const summary = {
      total: jobs.length,
      pending: jobs.filter((j: JobType) => j.status === 'PENDING').length,
      assigned: jobs.filter((j: JobType) => j.status === 'ASSIGNED').length,
      enRoute: jobs.filter((j: JobType) => j.status === 'EN_ROUTE').length,
      inProgress: jobs.filter((j: JobType) => j.status === 'IN_PROGRESS').length,
      completed: jobs.filter((j: JobType) => j.status === 'COMPLETED').length,
    };

    return NextResponse.json({
      success: true,
      data: {
        jobs,
        summary,
        date: today.toISOString(),
      },
    });
  } catch (error) {
    console.error('Jobs today error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching jobs' },
      { status: 500 }
    );
  }
}

