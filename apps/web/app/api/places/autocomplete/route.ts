/**
 * Places Autocomplete API Route
 * Proxies requests to Google Places Autocomplete API
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
    const input = searchParams.get('input');
    const country = searchParams.get('country') || 'AR';

    if (!input || input.length < 3) {
      return NextResponse.json({
        success: true,
        predictions: [],
      });
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      // Return empty results if no API key configured
      console.warn('Google Maps API key not configured');
      return NextResponse.json({
        success: true,
        predictions: [],
      });
    }

    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    url.searchParams.set('input', input);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('types', 'address');
    url.searchParams.set('components', `country:${country.toLowerCase()}`);
    url.searchParams.set('language', 'es');

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return NextResponse.json({
        success: true,
        predictions: data.predictions || [],
      });
    }

    console.error('Google Places API error:', data.status, data.error_message);
    return NextResponse.json({
      success: false,
      error: data.error_message || 'Failed to fetch suggestions',
      predictions: [],
    });
  } catch (error) {
    console.error('Places autocomplete error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', predictions: [] },
      { status: 500 }
    );
  }
}
