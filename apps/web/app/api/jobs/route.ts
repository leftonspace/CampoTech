import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { scheduleJobReminders } from '@/../../src/workers/notifications/reminder-scheduler';
import { sendNotification } from '@/../../src/modules/notifications/notification.service';
import { collectJobCreated } from '@/src/analytics';

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
    const limit = parseInt(searchParams.get('limit') || '20');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (status && status !== 'all') {
      where.status = status.toUpperCase();
    }

    // If technician, only show their jobs
    if (session.role === 'TECHNICIAN') {
      where.technicianId = session.userId;
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          customer: true,
          technician: {
            select: { id: true, name: true },
          },
        },
        orderBy: { scheduledDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.job.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: jobs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Jobs list error:', error);
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

    // Generate job number
    const lastJob = await prisma.job.findFirst({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: 'desc' },
    });

    const jobCount = lastJob
      ? parseInt(lastJob.jobNumber.replace('JOB-', '')) + 1
      : 1;
    const jobNumber = `JOB-${String(jobCount).padStart(5, '0')}`;

    const job = await prisma.job.create({
      data: {
        jobNumber,
        serviceType: body.serviceType,
        description: body.description,
        urgency: body.urgency || 'NORMAL',
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        scheduledTimeSlot: body.scheduledTimeSlot,
        customerId: body.customerId,
        technicianId: body.technicianId,
        createdById: session.userId,
        organizationId: session.organizationId,
      },
      include: {
        customer: true,
        technician: {
          select: { id: true, name: true },
        },
      },
    });

    // Collect analytics event (non-blocking)
    collectJobCreated(session.organizationId, {
      jobId: job.id,
      customerId: job.customerId,
      technicianId: job.technicianId || undefined,
      serviceType: job.serviceType || 'other',
      estimatedAmount: 0, // Not available at creation
      scheduledAt: job.scheduledDate || undefined,
    }).catch((err) => console.error('Analytics event error:', err));

    // Send notification to assigned technician
    if (job.technicianId) {
      try {
        await sendNotification({
          eventType: 'job_assigned',
          userId: job.technicianId,
          organizationId: session.organizationId,
          title: 'Nuevo trabajo asignado',
          body: `Te asignaron: ${job.description || 'Sin descripción'} - ${job.customer?.name || 'Cliente'}`,
          entityType: 'job',
          entityId: job.id,
          templateName: 'job_assigned_tech',
          templateParams: {
            '1': job.technician?.name || 'Técnico',
            '2': job.customer?.name || 'Cliente',
            '3': job.description || 'Servicio técnico',
            '4': job.scheduledDate
              ? new Intl.DateTimeFormat('es-AR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Argentina/Buenos_Aires',
                }).format(new Date(job.scheduledDate))
              : 'Fecha a confirmar',
          },
        });

        // Schedule reminders if job has scheduled date
        if (job.scheduledDate) {
          await scheduleJobReminders(job.id);
        }
      } catch (notifError) {
        console.error('Error sending job notification:', notifError);
        // Don't fail job creation if notification fails
      }
    }

    return NextResponse.json({
      success: true,
      data: job,
    });
  } catch (error) {
    console.error('Create job error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating job' },
      { status: 500 }
    );
  }
}
