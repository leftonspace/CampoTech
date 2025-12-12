import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // If technician, only show their jobs (either via legacy field or assignments)
    if (session.role === 'TECHNICIAN') {
      where.OR = [
        { technicianId: session.userId },
        { assignments: { some: { technicianId: session.userId } } },
      ];
    }

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          customer: true,
          technician: {
            select: { id: true, name: true },
          },
          assignments: {
            include: {
              technician: {
                select: { id: true, name: true },
              },
            },
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

    // Support both single technicianId (legacy) and array technicianIds
    const technicianIds: string[] = body.technicianIds?.length
      ? body.technicianIds
      : body.technicianId
        ? [body.technicianId]
        : [];

    const job = await prisma.job.create({
      data: {
        jobNumber,
        serviceType: body.serviceType,
        description: body.description,
        urgency: body.urgency || 'NORMAL',
        scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
        scheduledTimeSlot: body.scheduledTimeSlot,
        customerId: body.customerId,
        // Keep legacy technicianId for backwards compatibility (first technician)
        technicianId: technicianIds[0] || null,
        createdById: session.userId,
        organizationId: session.organizationId,
        // Create job assignments for all technicians
        assignments: {
          create: technicianIds.map((techId: string) => ({
            technicianId: techId,
          })),
        },
      },
      include: {
        customer: true,
        technician: {
          select: { id: true, name: true },
        },
        assignments: {
          include: {
            technician: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

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
