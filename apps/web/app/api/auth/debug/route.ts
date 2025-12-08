import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  const debug = {
    timestamp: new Date().toISOString(),
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    secretLength: process.env.NEXTAUTH_SECRET?.length || 0,
    hasToken: !!token,
    tokenLength: token?.length || 0,
    tokenPreview: token ? `${token.substring(0, 20)}...` : null,
  };

  if (token) {
    try {
      const payload = await verifyToken(token);
      return NextResponse.json({
        ...debug,
        tokenValid: !!payload,
        payload: payload ? {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
        } : null,
      });
    } catch (error) {
      return NextResponse.json({
        ...debug,
        tokenValid: false,
        verifyError: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return NextResponse.json(debug);
}
