/**
 * API Version Info Endpoint (Phase 6.3)
 * ======================================
 *
 * Returns information about API versioning.
 *
 * GET /api/version - Returns version info
 */

import { NextResponse } from 'next/server';
import { getApiVersionInfo, API_VERSION } from '@/lib/api/versioning';

export async function GET() {
  const versionInfo = getApiVersionInfo();

  return NextResponse.json({
    success: true,
    ...versionInfo,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'X-API-Version': API_VERSION,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
