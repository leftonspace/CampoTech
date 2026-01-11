import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: { message: 'No token provided' } },
        { status: 401 }
      );
    }

    // Verify token
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid token' } },
        { status: 401 }
      );
    }

    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { organization: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found or inactive' } },
        { status: 401 }
      );
    }

    // Prepare organization data safely
    // Type assertion to access fields that may exist on the organization
    type OrgWithExtras = typeof user.organization & {
      subscriptionTier?: string;
      subscriptionStatus?: string;
      verificationStatus?: string;
    };
    const org = user.organization as OrgWithExtras;
    const organization = org ? {
      id: org.id,
      name: org.name,
      subscriptionTier: org.subscriptionTier || 'FREE',
      subscriptionStatus: org.subscriptionStatus || 'none',
      verificationStatus: org.verificationStatus || 'pending',
    } : null;

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organizationId: user.organizationId,
        organization,
      },
    });
  } catch (error) {
    console.error('Auth me API Error:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message, error.stack);
    }
    return NextResponse.json(
      { success: false, error: { message: 'Error getting user' } },
      { status: 500 }
    );
  }
}
