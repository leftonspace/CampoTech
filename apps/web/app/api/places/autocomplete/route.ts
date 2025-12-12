/**
 * Places Autocomplete API Route
 * Proxies requests to Google Places API (New)
 * https://developers.google.com/maps/documentation/places/web-service/place-autocomplete
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

    // Use Places API (New) - POST request with JSON body
    const response = await fetch(
      'https://places.googleapis.com/v1/places:autocomplete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
        },
        body: JSON.stringify({
          input: input,
          includedRegionCodes: [country.toLowerCase()],
          includedPrimaryTypes: ['street_address', 'subpremise', 'premise', 'route'],
          languageCode: 'es',
        }),
      }
    );

    const data = await response.json();

    if (response.ok) {
      // Transform new API response to match legacy format for compatibility
      const predictions = (data.suggestions || []).map((suggestion: any) => ({
        place_id: suggestion.placePrediction?.placeId || '',
        description: suggestion.placePrediction?.text?.text || '',
        structured_formatting: {
          main_text: suggestion.placePrediction?.structuredFormat?.mainText?.text || '',
          secondary_text: suggestion.placePrediction?.structuredFormat?.secondaryText?.text || '',
        },
      }));

      return NextResponse.json({
        success: true,
        predictions,
      });
    }

    console.error('Google Places API (New) error:', data.error?.message || data);
    return NextResponse.json({
      success: false,
      error: data.error?.message || 'Failed to fetch suggestions',
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
