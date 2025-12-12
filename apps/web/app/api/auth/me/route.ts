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
        { success: false, error: { message: 'User not found' } },
        { status: 401 }
      );
    }

    // Extract subscription tier from organization settings
    const settings = user.organization.settings as Record<string, unknown> | null;
    const subscriptionTier = (settings?.subscriptionTier as string) || 'FREE';

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        organization: {
          id: user.organization.id,
          name: user.organization.name,
          subscriptionTier,
        },
      },
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error getting user' } },
      { status: 500 }
    );
  }
}
