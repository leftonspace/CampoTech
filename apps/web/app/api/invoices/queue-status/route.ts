import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Invoice Queue Status API
 * Returns the status of the invoice processing queue
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

    // Return queue status (placeholder - would integrate with BullMQ in production)
    return NextResponse.json({
      success: true,
      data: {
        queue: 'invoice-processing',
        status: 'healthy',
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        lastProcessedAt: null,
      },
    });
  } catch (error) {
    console.error('Invoice queue status error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching queue status' },
      { status: 500 }
    );
  }
}
