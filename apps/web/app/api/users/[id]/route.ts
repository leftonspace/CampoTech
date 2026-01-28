import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  filterEntityByRole,
  getEntityFieldMetadata,
  validateEntityUpdate,
  UserRole,
} from '@/lib/middleware/field-filter';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const user = await prisma.user.findFirst({
      where: {
        id,
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
        specialties: true,
        certifications: true,
        avatar: true,
        isActive: true,
        // Driver's license fields
        driverLicenseNumber: true,
        driverLicenseExpiry: true,
        driverLicenseCategory: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Normalize user role and check if viewing self
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;
    const isSelf = session.userId === id;

    // Filter data based on user role
    const filteredData = filterEntityByRole(user, 'user', userRole, isSelf);
    const fieldMeta = getEntityFieldMetadata('user', userRole, isSelf);

    return NextResponse.json({
      success: true,
      data: filteredData,
      _fieldMeta: fieldMeta,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error fetching user' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();

    // First verify user belongs to this organization
    const existing = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Normalize user role
    const userRole = (session.role?.toUpperCase() || 'TECHNICIAN') as UserRole;

    // Only OWNER and DISPATCHER can update other users
    const isEditingSelf = session.userId === id;
    if (!isEditingSelf && !['OWNER', 'DISPATCHER'].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // Validate that user can edit the fields they're trying to update
    const validation = validateEntityUpdate(body, 'user', userRole, isEditingSelf);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.errors.join(' ') },
        { status: 403 }
      );
    }

    // Prevent changing OWNER role
    if (existing.role === 'OWNER' && body.role && body.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot change OWNER role' },
        { status: 400 }
      );
    }

    // Prevent assigning OWNER role to non-owners
    if (body.role === 'OWNER' && existing.role !== 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot assign OWNER role' },
        { status: 400 }
      );
    }

    // SELF-DEACTIVATION PREVENTION: Cannot deactivate yourself
    if (isEditingSelf && body.isActive === false) {
      return NextResponse.json(
        { success: false, error: 'No podés desactivar tu propia cuenta' },
        { status: 400 }
      );
    }

    // Check if email already exists in organization (if changed)
    if (body.email && body.email !== existing.email) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: body.email,
          organizationId: session.organizationId,
          NOT: { id },
        },
      });

      if (existingEmail) {
        return NextResponse.json(
          { success: false, error: 'Email already in use in this organization' },
          { status: 400 }
        );
      }
    }

    // Build update data - only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email || null;
    if (body.role !== undefined) updateData.role = body.role;
    if (body.specialty !== undefined) updateData.specialty = body.specialty || null;
    if (body.skillLevel !== undefined) updateData.skillLevel = body.skillLevel || null;
    if (body.specialties !== undefined) updateData.specialties = body.specialties || [];
    if (body.certifications !== undefined) updateData.certifications = body.certifications || null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.avatar !== undefined) updateData.avatar = body.avatar;
    // Driver's license fields
    if (body.driverLicenseNumber !== undefined) updateData.driverLicenseNumber = body.driverLicenseNumber || null;
    if (body.driverLicenseExpiry !== undefined) updateData.driverLicenseExpiry = body.driverLicenseExpiry ? new Date(body.driverLicenseExpiry) : null;
    if (body.driverLicenseCategory !== undefined) updateData.driverLicenseCategory = body.driverLicenseCategory || null;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        role: true,
        specialty: true,
        skillLevel: true,
        specialties: true,
        certifications: true,
        avatar: true,
        isActive: true,
        driverLicenseNumber: true,
        driverLicenseExpiry: true,
        driverLicenseCategory: true,
      },
    });

    // Handle resend notifications if requested
    const notifications = {
      emailSent: false,
      otpSent: false,
    };

    // Resend email notification if email changed
    if (body.resendEmailNotification && user.email) {
      try {
        // Import Resend dynamically to avoid issues if not configured
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
          to: user.email,
          subject: 'Tu perfil ha sido actualizado',
          html: `
            <h2>Hola ${user.name},</h2>
            <p>Tu perfil en CampoTech ha sido actualizado.</p>
            <p>Si tienes alguna pregunta, contacta a tu administrador.</p>
          `,
        });
        notifications.emailSent = true;
      } catch (emailError) {
        console.error('Failed to send email notification:', emailError);
      }
    }

    // Resend phone OTP if requested
    if (body.resendPhoneOTP && user.phone) {
      try {
        // Generate a new OTP code
        const crypto = await import('crypto');
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

        // Store the OTP in database
        const { prisma: dbPrisma } = await import('@/lib/prisma');
        await dbPrisma.otpCode.create({
          data: {
            phone: user.phone,
            codeHash: otpHash,
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          },
        });

        // TODO: Send OTP via WhatsApp
        // For now, log it (in production, integrate with WhatsApp API)
        console.log(`[RESEND OTP] Phone: ${user.phone}, Code: ${otp}`);
        notifications.otpSent = true;
      } catch (otpError) {
        console.error('Failed to send phone OTP:', otpError);
      }
    }

    return NextResponse.json({
      success: true,
      data: user,
      notifications,
    });
  } catch (error) {
    console.error('Update user error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: `Error updating user: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Only OWNER and DISPATCHER can delete users
    if (!['OWNER', 'DISPATCHER'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    // First verify user belongs to this organization
    const existing = await prisma.user.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting OWNER
    if (existing.role === 'OWNER') {
      return NextResponse.json(
        { success: false, error: 'Cannot delete organization owner' },
        { status: 400 }
      );
    }

    // Prevent deleting yourself
    if (session.userId === id) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    // Check if user has assigned jobs
    const assignedJobs = await prisma.job.count({
      where: {
        technicianId: id,
        status: { in: ['PENDING', 'ASSIGNED', 'EN_ROUTE', 'IN_PROGRESS'] },
      },
    });

    if (assignedJobs > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete user with ${assignedJobs} active job(s). Please reassign or complete them first.`
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deleting user' },
      { status: 500 }
    );
  }
}
