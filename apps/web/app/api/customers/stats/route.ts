import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { CustomerService } from '@/src/services/customer.service';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const stats = await CustomerService.getCustomerStats(session.organizationId);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Customer stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching customer stats' },
      { status: 500 }
    );
  }
}
