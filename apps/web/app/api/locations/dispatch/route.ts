import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  InterLocationDispatchService,
  DispatchError,
} from '@/src/modules/locations/resources';
import { z } from 'zod';

const dispatchService = new InterLocationDispatchService(prisma);

const CreateDispatchSchema = z.object({
  jobId: z.string().cuid(),
  technicianId: z.string().cuid(),
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
});

const UpdateDispatchSchema = z.object({
  dispatchId: z.string().cuid(),
  status: z.enum(['APPROVED', 'IN_TRANSIT', 'ARRIVED', 'COMPLETED', 'CANCELLED']),
  notes: z.string().optional(),
});

/**
 * GET /api/locations/dispatch
 * Get dispatch information
 */
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
    const view = searchParams.get('view') || 'pending';
    const jobId = searchParams.get('jobId');
    const technicianId = searchParams.get('technicianId');

    if (view === 'pending') {
      const dispatches = await dispatchService.getPendingDispatches(
        session.organizationId
      );
      return NextResponse.json({
        success: true,
        data: { dispatches },
      });
    }

    if (view === 'candidates' && jobId) {
      const candidates = await dispatchService.findAvailableTechnicians(
        session.organizationId,
        jobId,
        {
          maxDistance: parseFloat(searchParams.get('maxDistance') || '50'),
          requiredSpecialty: searchParams.get('specialty') || undefined,
        }
      );
      return NextResponse.json({
        success: true,
        data: { candidates },
      });
    }

    if (view === 'recommendation' && jobId) {
      const recommendation = await dispatchService.getDispatchRecommendation(
        session.organizationId,
        jobId
      );
      return NextResponse.json({
        success: true,
        data: recommendation,
      });
    }

    if (view === 'travel-matrix') {
      const matrix = await dispatchService.getTravelTimeMatrix(session.organizationId);
      return NextResponse.json({
        success: true,
        data: matrix,
      });
    }

    if (view === 'availability' && technicianId) {
      const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date();
      const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const availability = await dispatchService.getTechnicianAvailability(
        session.organizationId,
        technicianId,
        startDate,
        endDate
      );
      return NextResponse.json({
        success: true,
        data: { availability },
      });
    }

    if (view === 'optimize') {
      const dateStr = searchParams.get('date');
      const date = dateStr ? new Date(dateStr) : new Date();

      const optimization = await dispatchService.optimizeDispatches(
        session.organizationId,
        date
      );
      return NextResponse.json({
        success: true,
        data: optimization,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter or missing required params' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get dispatch error:', error);

    if (error instanceof DispatchError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error fetching dispatch information' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations/dispatch
 * Create a cross-location dispatch
 */
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
    const input = CreateDispatchSchema.parse(body);

    const dispatch = await dispatchService.createCrossLocationDispatch(
      session.organizationId,
      input.jobId,
      input.technicianId,
      input.fromLocationId,
      input.toLocationId,
      session.userId
    );

    return NextResponse.json({
      success: true,
      data: dispatch,
    });
  } catch (error) {
    console.error('Create dispatch error:', error);

    if (error instanceof DispatchError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error creating dispatch' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations/dispatch
 * Update dispatch status
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const input = UpdateDispatchSchema.parse(body);

    const dispatch = await dispatchService.updateDispatchStatus(
      input.dispatchId,
      input.status,
      session.userId,
      input.notes
    );

    return NextResponse.json({
      success: true,
      data: dispatch,
    });
  } catch (error) {
    console.error('Update dispatch error:', error);

    if (error instanceof DispatchError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error updating dispatch' },
      { status: 500 }
    );
  }
}
