import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  InterLocationChargeManager,
  ChargeError,
} from '@/src/modules/locations/billing';
import { z } from 'zod';

const chargeManager = new InterLocationChargeManager(prisma);

const CreateChargeSchema = z.object({
  fromLocationId: z.string().cuid(),
  toLocationId: z.string().cuid(),
  chargeType: z.enum([
    'TECHNICIAN_LOAN',
    'EQUIPMENT_RENTAL',
    'REVENUE_SHARE',
    'INVENTORY_TRANSFER',
    'OVERHEAD_ALLOCATION',
    'OTHER',
  ]),
  amount: z.number().positive(),
  description: z.string().min(1).max(500),
  referenceId: z.string().optional(),
  referenceType: z.enum(['JOB', 'INVOICE', 'TRANSFER']).optional(),
});

const ApproveChargeSchema = z.object({
  chargeId: z.string().cuid(),
  approved: z.boolean(),
  notes: z.string().optional(),
});

const SettleChargesSchema = z.object({
  chargeIds: z.array(z.string().cuid()).min(1),
  settlementDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/billing/charges
 * Get organization balances and pending charges
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
    const view = searchParams.get('view') || 'balances';
    const locationId = searchParams.get('locationId');

    if (view === 'balances') {
      const balances = await chargeManager.getOrganizationBalances(session.organizationId);
      return NextResponse.json({
        success: true,
        data: { balances },
      });
    }

    if (view === 'pending' && locationId) {
      const pending = await chargeManager.getPendingCharges(
        session.organizationId,
        locationId
      );
      return NextResponse.json({
        success: true,
        data: { pending },
      });
    }

    if (view === 'history' && locationId) {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');

      const history = await chargeManager.getChargeHistory(
        session.organizationId,
        locationId,
        {
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        }
      );
      return NextResponse.json({
        success: true,
        data: { history },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid view parameter or missing locationId' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Get charges error:', error);

    return NextResponse.json(
      { success: false, error: 'Error fetching charges' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing/charges
 * Create a new inter-location charge
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
    const input = CreateChargeSchema.parse(body);

    const charge = await chargeManager.createCharge(session.organizationId, {
      fromLocationId: input.fromLocationId,
      toLocationId: input.toLocationId,
      chargeType: input.chargeType,
      amount: input.amount,
      description: input.description,
      referenceId: input.referenceId,
      referenceType: input.referenceType,
      createdBy: session.userId,
    });

    return NextResponse.json({
      success: true,
      data: charge,
    });
  } catch (error) {
    console.error('Create charge error:', error);

    if (error instanceof ChargeError) {
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
      { success: false, error: 'Error creating charge' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/billing/charges
 * Approve or reject a charge
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
    const input = ApproveChargeSchema.parse(body);

    let result;
    if (input.approved) {
      result = await chargeManager.approveCharge(
        input.chargeId,
        session.userId,
        input.notes
      );
    } else {
      result = await chargeManager.rejectCharge(
        input.chargeId,
        session.userId,
        input.notes || 'Rejected'
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Approve/reject charge error:', error);

    if (error instanceof ChargeError) {
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
      { success: false, error: 'Error processing charge' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/billing/charges
 * Settle multiple charges
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const input = SettleChargesSchema.parse(body);

    const result = await chargeManager.settleCharges(
      input.chargeIds,
      session.userId,
      input.settlementDate ? new Date(input.settlementDate) : undefined,
      input.notes
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Settle charges error:', error);

    if (error instanceof ChargeError) {
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
      { success: false, error: 'Error settling charges' },
      { status: 500 }
    );
  }
}
