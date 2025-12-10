import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  LocationInvoiceRouter,
  InvoiceRoutingError,
} from '@/src/modules/locations/billing';
import { z } from 'zod';

const invoiceRouter = new LocationInvoiceRouter(prisma);

const RoutingInputSchema = z.object({
  jobId: z.string().cuid().optional(),
  customerId: z.string().cuid().optional(),
  customerCoordinates: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional(),
  customerCondicionIva: z.enum([
    'RESPONSABLE_INSCRIPTO',
    'MONOTRIBUTISTA',
    'EXENTO',
    'CONSUMIDOR_FINAL',
  ]).optional(),
  explicitLocationId: z.string().cuid().optional(),
});

/**
 * POST /api/billing/routing
 * Determine best location to issue invoice from
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
    const input = RoutingInputSchema.parse(body);

    const result = await invoiceRouter.routeInvoice(session.organizationId, input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Invoice routing error:', error);

    if (error instanceof InvoiceRoutingError) {
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
      { success: false, error: 'Error determining invoice routing' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/billing/routing
 * Get all routing options (locations with AFIP config)
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

    const options = await invoiceRouter.getRoutingOptions(session.organizationId);

    return NextResponse.json({
      success: true,
      data: options,
    });
  } catch (error) {
    console.error('Get routing options error:', error);

    return NextResponse.json(
      { success: false, error: 'Error fetching routing options' },
      { status: 500 }
    );
  }
}
