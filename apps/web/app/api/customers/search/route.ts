import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { CustomerService } from '@/src/services/customer.service';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query || query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    const customers = await CustomerService.searchCustomers(
      session.organizationId,
      query,
      10
    );

    return NextResponse.json({
      success: true,
      data: customers,
    });
  } catch (error) {
    console.error('Customer search error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SEARCH_ERROR', message: 'Error searching customers' } },
      { status: 500 }
    );
  }
}
