import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { JobService } from '@/src/services/job.service';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await JobService.getJobStats(session.organizationId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Jobs stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching job stats' },
      { status: 500 }
    );
  }
}
