import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Health check endpoint for debugging database connectivity
export async function GET() {
  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlStart: process.env.DATABASE_URL?.substring(0, 30) + '...',
    },
  };

  try {
    // Test database connection
    const userCount = await prisma.user.count();
    checks.database = {
      connected: true,
      userCount,
    };

    // Try to find admin user
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true, name: true, phone: true, email: true },
    });
    checks.adminUser = admin;

  } catch (error) {
    checks.database = {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  return NextResponse.json(checks);
}
