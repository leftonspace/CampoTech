import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { onJobStatusChange } from '@/src/modules/whatsapp/notification-triggers.service';
import { randomUUID } from 'crypto';
import { JobService } from '@/src/services/job.service';

type JobStatus = 'PENDING' | 'SCHEDULED' | 'ASSIGNED' | 'EN_ROUTE' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Map frontend status to database status
const STATUS_MAP: Record<string, string> = {
  pending: 'PENDING',
  scheduled: 'ASSIGNED',
  en_camino: 'EN_ROUTE',
  working: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

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

    const { status } = await request.json();

    // Verify the job belongs to the organization
    const existing = await JobService.getJobById(session.organizationId, id);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Job not found' },
        { status: 404 }
      );
    }

    const dbStatus = STATUS_MAP[status] || status.toUpperCase();

    // Use JobService to update status with automatic timestamp handling
    const job = await JobService.updateJobStatus(session.organizationId, id, dbStatus);

    // Generate rating token when job is completed
    let ratingToken: string | null = null;
    if (dbStatus === 'COMPLETED' && existing.status !== 'COMPLETED') {
      try {
        // Check if review already exists for this job
        const existingReview = await prisma.review.findFirst({
          where: { jobId: id },
        });

        if (!existingReview) {
          // Generate secure token for rating link
          ratingToken = randomUUID();

          // Create review record with token (rating will be filled when customer submits)
          await prisma.review.create({
            data: {
              jobId: id,
              organizationId: session.organizationId,
              customerId: job.customerId || null,
              technicianId: job.technicianId || null,
              token: ratingToken,
              // Token expires in 30 days
              tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });

          console.log(`[Rating] Created rating token for job ${id}: ${ratingToken}`);
        } else if (existingReview.token) {
          ratingToken = existingReview.token;
        }
      } catch (reviewError) {
        console.error('Error creating rating token:', reviewError);
        // Don't fail the request if rating creation fails
      }
    }

    // Trigger WhatsApp notification for status change (non-blocking)
    const oldStatus = existing.status as JobStatus;
    const newStatus = dbStatus as JobStatus;
    if (oldStatus !== newStatus) {
      onJobStatusChange(id, oldStatus, newStatus, {
        technicianId: job.technicianId || undefined,
      }).catch((err) => {
        console.error('WhatsApp notification error:', err);
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...job,
        ratingToken, // Include rating token in response for completed jobs
        ratingUrl: ratingToken ? `/rate/${ratingToken}` : null,
      },
    });
  } catch (error) {
    console.error('Update job status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error updating job status' },
      { status: 500 }
    );
  }
}
