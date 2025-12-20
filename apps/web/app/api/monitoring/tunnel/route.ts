/**
 * Sentry Tunnel API Route
 * =======================
 *
 * Proxies Sentry requests to avoid ad blockers.
 * This route forwards envelope requests to Sentry's ingest endpoint.
 *
 * Reference: https://docs.sentry.io/platforms/javascript/troubleshooting/#using-the-tunnel-option
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed Sentry hosts for security
const SENTRY_HOSTS = [
  'sentry.io',
  'o4507281234567890.ingest.sentry.io', // Replace with your org's ingest URL
  '.ingest.sentry.io',
];

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.text();
    const pieces = envelope.split('\n');

    // Parse the envelope header to get the DSN
    const header = JSON.parse(pieces[0]);
    const dsn = new URL(header.dsn);
    const projectId = dsn.pathname.replace('/', '');

    // Validate the host is a Sentry host
    const isValidHost = SENTRY_HOSTS.some(
      (host) => dsn.hostname === host || dsn.hostname.endsWith(host)
    );

    if (!isValidHost) {
      console.warn('[Sentry Tunnel] Invalid host:', dsn.hostname);
      return NextResponse.json(
        { error: 'Invalid Sentry host' },
        { status: 400 }
      );
    }

    // Forward to Sentry
    const sentryUrl = `https://${dsn.hostname}/api/${projectId}/envelope/`;

    const response = await fetch(sentryUrl, {
      method: 'POST',
      body: envelope,
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
      },
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('[Sentry Tunnel] Error:', error);
    return NextResponse.json(
      { error: 'Failed to forward to Sentry' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
