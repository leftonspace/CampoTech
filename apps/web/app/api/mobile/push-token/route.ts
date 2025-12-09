import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Mobile Push Token Registration API
 * ===================================
 *
 * Registers or updates push notification tokens for mobile devices.
 * Supports Expo push notifications.
 */

interface PushTokenRequest {
  token: string;
  deviceId: string;
  platform: 'ios' | 'android';
  deviceName?: string;
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

    const body: PushTokenRequest = await request.json();
    const { token, deviceId, platform, deviceName } = body;

    if (!token || !deviceId || !platform) {
      return NextResponse.json(
        { success: false, error: 'Token, deviceId, and platform are required' },
        { status: 400 }
      );
    }

    // Validate Expo push token format
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('expo-')) {
      // Also accept FCM tokens for Android
      if (platform === 'android' && token.length < 100) {
        return NextResponse.json(
          { success: false, error: 'Invalid push token format' },
          { status: 400 }
        );
      }
    }

    // Upsert push token
    await prisma.pushToken.upsert({
      where: {
        userId_deviceId: {
          userId: session.userId,
          deviceId,
        },
      },
      update: {
        token,
        platform,
        deviceName,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: session.userId,
        organizationId: session.organizationId,
        token,
        deviceId,
        platform,
        deviceName,
        isActive: true,
      },
    });

    // Deactivate other tokens for same user on same device type
    // (user logged in on a different device)
    await prisma.pushToken.updateMany({
      where: {
        userId: session.userId,
        platform,
        deviceId: { not: deviceId },
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Push token registered',
    });
  } catch (error) {
    console.error('Push token registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Error registering push token' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get('deviceId');

    if (!deviceId) {
      return NextResponse.json(
        { success: false, error: 'deviceId is required' },
        { status: 400 }
      );
    }

    // Deactivate push token
    await prisma.pushToken.updateMany({
      where: {
        userId: session.userId,
        deviceId,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Push token deactivated',
    });
  } catch (error) {
    console.error('Push token deletion error:', error);
    return NextResponse.json(
      { success: false, error: 'Error deactivating push token' },
      { status: 500 }
    );
  }
}
