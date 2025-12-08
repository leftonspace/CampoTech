import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: { message: 'Phone number is required' } },
        { status: 400 }
      );
    }

    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if user exists
    const user = await prisma.user.findFirst({
      where: {
        phone: {
          contains: cleanPhone.slice(-10), // Match last 10 digits
        },
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: { message: 'Usuario no encontrado' } },
        { status: 404 }
      );
    }

    // In production, you would send SMS here
    // For demo, we just return success
    // The OTP code is "123456" for testing

    console.log(`OTP requested for ${phone} - Use code: 123456`);

    return NextResponse.json({
      success: true,
      data: { sent: true },
    });
  } catch (error) {
    console.error('Request OTP error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Error al enviar el código' } },
      { status: 500 }
    );
  }
}
