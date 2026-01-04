/**
 * API Documentation Endpoint (Phase 6.3)
 * =======================================
 *
 * Returns OpenAPI specification for the CampoTech API.
 *
 * GET /api/docs - Returns OpenAPI 3.0 spec in JSON format
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/api/openapi';
import { API_VERSION } from '@/lib/api/versioning';

export async function GET(request: NextRequest) {
  // Get base URL from request
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host') || 'localhost:3000';
  const baseUrl = `${protocol}://${host}`;

  // Generate OpenAPI spec
  const spec = generateOpenAPISpec(baseUrl);

  // Return as JSON (YAML support can be added later)
  return NextResponse.json(spec, {
    headers: {
      'X-API-Version': API_VERSION,
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
}
