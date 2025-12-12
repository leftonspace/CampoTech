/**
 * Places Details API Route
 * Proxies requests to Google Places Details API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

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
    const placeId = searchParams.get('placeId');

    if (!placeId) {
      return NextResponse.json(
        { success: false, error: 'placeId is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return NextResponse.json({
        success: false,
        error: 'Google Maps API key not configured',
      });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('fields', 'formatted_address,geometry,address_components');
    url.searchParams.set('language', 'es');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      return NextResponse.json({
        success: true,
        result: data.result,
      });
    }

    console.error('Google Places Details API error:', data.status, data.error_message);
    return NextResponse.json({
      success: false,
      error: data.error_message || 'Failed to fetch place details',
    });
  } catch (error) {
    console.error('Places details error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
