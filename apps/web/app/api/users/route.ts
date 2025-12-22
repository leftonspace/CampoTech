/**
 * Users API Route
 * Self-contained implementation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email';
import { requestOTP } from '@/lib/otp';
import {
  filterEntitiesByRole,
  getEntityFieldMetadata,
  UserRole,
} from '@/lib/middleware/field-filter';

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
    const search = searchParams.get('search');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    const where: any = {
      organizationId: session.organizationId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          role: true,
          specialty: true,
          skillLevel: true,
          avatar: true,
          isActive: true,
          createdAt: true,
          // Count jobs assigned to this user (both legacy and new assignment model)
          _count: {
            select: {
              assignedJobs: true,      // Legacy: Job.technicianId
              jobAssignments: true,    // New: JobAssignment table
            },
          },
          // Note: Removed technicianReviews - using database aggregation instead
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Get user IDs for aggregation query
    const userIds = users.map((u: typeof users[number]) => u.id);

    // Use database aggregation for review stats (much more efficient than fetching all reviews)
    const reviewStats = await prisma.review.groupBy({
      by: ['technicianId'],
      where: {
        technicianId: { in: userIds },
        rating: { not: null },
      },
      _avg: { rating: true },
      _count: { rating: true },
    });

    // Create a map for quick lookup
    const reviewStatsMap = new Map<string, { avgRating: number | null; reviewCount: number }>();
    for (const stat of reviewStats) {
      if (stat.technicianId) {
        reviewStatsMap.set(stat.technicianId, {
          avgRating: stat._avg.rating ? Number(stat._avg.rating.toFixed(1)) : null,
          reviewCount: stat._count.rating,
        });
      }
    }

    // Transform users to include computed jobCount and avgRating
    const usersWithStats = users.map((user: typeof users[number]) => {
      // Use the higher of the two job counts (they may overlap)
      // jobAssignments is the more accurate count for multi-technician jobs
      const jobCount = Math.max(
        user._count.assignedJobs,
        user._count.jobAssignments
      );

      // Get pre-computed rating stats from database aggregation
      const stats = reviewStatsMap.get(user.id);
      const avgRating = stats?.avgRating ?? null;
      const reviewCount = stats?.reviewCount ?? 0;

      // Remove internal fields and add computed ones
      const { _count, ...userData } = user;
      return {
        ...userData,
        jobCount,
        avgRating,
        reviewCount,
      };
    });

    // Normalize user role for permission checking
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Filter data based on user role
    const filteredUsers = filterEntitiesByRole(usersWithStats, 'user', userRole);
    const fieldMeta = getEntityFieldMetadata('user', userRole);

    return NextResponse.json({
      success: true,
      data: filteredUsers,
      _fieldMeta: fieldMeta,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Users list error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Session missing organizationId' },
        { status: 400 }
      );
    }

    if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    if (!body.name || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    const existingPhone = await prisma.user.findFirst({
      where: { phone: body.phone },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number already in use' },
        { status: 400 }
      );
    }

    if (body.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot create users with OWNER role' },
        { status: 400 }
      );
    }

    // Fetch organization details for notifications
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: { name: true },
    });

    // Fetch admin name for email
    const admin = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true },
    });

    const user = await prisma.user.create({
      data: {
        name: body.name,
        phone: body.phone,
        email: body.email || null,
        role: body.role || 'TECHNICIAN',
        specialty: body.specialty || null,
        skillLevel: body.skillLevel || null,
        isActive: body.isActive ?? true,
        organizationId: session.organizationId,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        specialty: true,
        skillLevel: true,
        avatar: true,
        isActive: true,
      },
    });

    // Send notifications in the background (don't block the response)
    const notificationResults = {
      emailSent: false,
      whatsappOtpSent: false,
      emailError: null as string | null,
      whatsappError: null as string | null,
    };

    const organizationName = organization?.name || 'CampoTech';

    // Send welcome email if email is provided
    if (user.email) {
      try {
        const emailResult = await sendWelcomeEmail(
          user.email,
          user.name,
          organizationName,
          user.role,
          admin?.name || undefined
        );
        notificationResults.emailSent = emailResult.success;
        if (!emailResult.success) {
          notificationResults.emailError = emailResult.error || 'Unknown email error';
          console.error('[User Create] Welcome email failed:', emailResult.error);
        } else {
          console.log('[User Create] Welcome email sent to:', user.email);
        }
      } catch (emailError) {
        console.error('[User Create] Welcome email exception:', emailError);
        notificationResults.emailError = emailError instanceof Error ? emailError.message : 'Email exception';
      }
    }

    // Send WhatsApp OTP for phone verification
    if (user.phone) {
      try {
        const otpResult = await requestOTP(user.phone, 'whatsapp');
        notificationResults.whatsappOtpSent = otpResult.success;
        if (!otpResult.success) {
          notificationResults.whatsappError = otpResult.error || 'Unknown WhatsApp error';
          console.error('[User Create] WhatsApp OTP failed:', otpResult.error);
        } else {
          console.log('[User Create] WhatsApp OTP sent to:', user.phone, otpResult.devMode ? '(dev mode)' : '');
        }
      } catch (otpError) {
        console.error('[User Create] WhatsApp OTP exception:', otpError);
        notificationResults.whatsappError = otpError instanceof Error ? otpError.message : 'OTP exception';
      }
    }

    return NextResponse.json({
      success: true,
      data: user,
      notificationSent: notificationResults.emailSent || notificationResults.whatsappOtpSent,
      onboardingInitialized: notificationResults.whatsappOtpSent,
      notifications: {
        email: {
          sent: notificationResults.emailSent,
          error: notificationResults.emailError,
        },
        whatsapp: {
          sent: notificationResults.whatsappOtpSent,
          error: notificationResults.whatsappError,
        },
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creating user' },
      { status: 500 }
    );
  }
}
