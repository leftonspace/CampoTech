import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Health check endpoint for debugging database connectivity
export async function GET() {
  // Parse DATABASE_URL to show structure without exposing password
  const dbUrl = process.env.DATABASE_URL || '';
  let dbInfo = {};
  try {
    const url = new URL(dbUrl);
    dbInfo = {
      protocol: url.protocol,
      username: url.username,
      host: url.host,
      port: url.port,
      pathname: url.pathname,
      search: url.search,
    };
  } catch {
    dbInfo = { parseError: 'Could not parse DATABASE_URL' };
  }

  const checks: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDbUrl: !!process.env.DATABASE_URL,
      dbUrlLength: dbUrl.length,
    },
    connectionInfo: dbInfo,
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
