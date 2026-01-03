import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Payment Disputes API
 * List and manage payment disputes
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

    // Return empty disputes list (feature placeholder)
    return NextResponse.json({
      success: true,
      data: [],
      pagination: {
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      },
    });
  } catch (error) {
    console.error('Payment disputes error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching disputes' },
      { status: 500 }
    );
  }
}
