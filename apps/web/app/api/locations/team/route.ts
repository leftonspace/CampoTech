import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LocationAssignmentService,
  AssignmentError,
} from '@/src/modules/locations/resources';
import { z } from 'zod';

const assignmentService = new LocationAssignmentService(prisma);

const AssignTechnicianSchema = z.object({
  userId: z.string().cuid(),
  locationId: z.string().cuid(),
});

const BulkAssignSchema = z.object({
  assignments: z.array(
    z.object({
      userId: z.string().cuid(),
      locationId: z.string().cuid(),
    })
  ),
});

/**
 * GET /api/locations/team
 * Get all technician assignments and location teams
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
    const view = searchParams.get('view') || 'teams';
    const locationId = searchParams.get('locationId');

    if (view === 'teams') {
      const teams = await assignmentService.getAllLocationTeams(session.organizationId);
      return NextResponse.json({
        success: true,
        data: { teams },
      });
    }

    if (view === 'assignments') {
      const assignments = await assignmentService.getAllTechnicianAssignments(
        session.organizationId,
        {
          locationId: locationId || undefined,
          onlyActive: searchParams.get('onlyActive') === 'true',
          onlyUnassigned: searchParams.get('onlyUnassigned') === 'true',
        }
      );
      return NextResponse.json({
        success: true,
        data: { assignments },
      });
    }

    if (view === 'recommendations') {
      const recommendations = await assignmentService.getAssignmentRecommendations(
        session.organizationId
      );
      return NextResponse.json({
        success: true,
        data: { recommendations },
      });
    }

    if (view === 'balance') {
      const report = await assignmentService.getTeamBalanceReport(session.organizationId);
      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get team assignments error:', error);

    return NextResponse.json(
      { success: false, error: 'Error fetching team assignments' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/locations/team
 * Assign a technician to a location
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
    const input = AssignTechnicianSchema.parse(body);

    const assignment = await assignmentService.assignTechnicianToLocation(
      session.organizationId,
      input.userId,
      input.locationId
    );

    return NextResponse.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    console.error('Assign technician error:', error);

    if (error instanceof AssignmentError) {
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
      { success: false, error: 'Error assigning technician' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/locations/team
 * Bulk assign technicians to locations
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
    const input = BulkAssignSchema.parse(body);

    const result = await assignmentService.bulkAssignTechnicians(
      session.organizationId,
      input.assignments
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Bulk assign error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error bulk assigning technicians' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/locations/team
 * Unassign a technician from their location
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'userId is required' },
        { status: 400 }
      );
    }

    await assignmentService.unassignTechnician(session.organizationId, userId);

    return NextResponse.json({
      success: true,
      message: 'Technician unassigned successfully',
    });
  } catch (error) {
    console.error('Unassign technician error:', error);

    if (error instanceof AssignmentError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Error unassigning technician' },
      { status: 500 }
    );
  }
}
