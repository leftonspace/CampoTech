/**
 * WhatsApp Conversations API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: [],
    });
  } catch (error) {
    console.error('WhatsApp conversations list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching conversations' },
      { status: 500 }
    );
  }
}
