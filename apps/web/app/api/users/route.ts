import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getOrCreateSMSProvider } from '@/lib/sms';

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
    const specialty = searchParams.get('specialty');
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

    if (specialty) {
      where.specialty = specialty;
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
        },
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: users,
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

    // Check if session has organizationId
    if (!session.organizationId) {
      return NextResponse.json(
        { success: false, error: 'Session missing organizationId. Please log out and log back in.' },
        { status: 400 }
      );
    }

    // Only OWNER, ADMIN, and DISPATCHER can create users
    if (!['OWNER', 'ADMIN', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.phone) {
      return NextResponse.json(
        { success: false, error: 'Name and phone are required' },
        { status: 400 }
      );
    }

    // Check if phone already exists
    const existingPhone = await prisma.user.findFirst({
      where: {
        phone: body.phone,
      },
    });

    if (existingPhone) {
      return NextResponse.json(
        { success: false, error: 'Phone number already in use' },
        { status: 400 }
      );
    }

    // Check if email already exists in organization (if provided)
    if (body.email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: body.email,
          organizationId: session.organizationId,
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already in use in this organization' },
          { status: 400 }
        );
      }
    }

    // Prevent creating OWNER role
    if (body.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot create users with OWNER role' },
        { status: 400 }
      );
    }

    // Get organization name for notification
    const organization = await prisma.organization.findUnique({
      where: { id: session.organizationId },
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

    // Send welcome notification if requested
    let notificationSent = false;
    if (body.sendNotification) {
      try {
        const smsProvider = getOrCreateSMSProvider();
        const welcomeMessage = `Hola ${body.name}! Fuiste agregado al equipo de ${organization?.name || 'CampoTech'}. Descargá la app CampoTech para gestionar tus trabajos. Tu número de acceso es: ${body.phone}`;

        const result = await smsProvider.sendSMS(body.phone, welcomeMessage);
        notificationSent = result.success;

        if (!result.success) {
          console.warn('Failed to send welcome SMS:', result.error);
        }
      } catch (smsError) {
        console.error('Error sending welcome SMS:', smsError);
        // Don't fail the user creation if SMS fails
      }
    }

    return NextResponse.json({
      success: true,
      data: user,
      notificationSent,
    });
  } catch (error) {
    console.error('Create user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Error creating user: ${errorMessage}` },
      { status: 500 }
    );
  }
}
