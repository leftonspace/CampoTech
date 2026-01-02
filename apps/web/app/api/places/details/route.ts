/**
 * Places Details API Route
 * Proxies requests to Google Places API (New)
 * https://developers.google.com/maps/documentation/places/web-service/place-details
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

    // Use Places API (New) - GET request with field mask header
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=es`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,addressComponents',
        },
      }
    );

    const data = await response.json();

    if (response.ok) {
      // Transform new API response to match legacy format for compatibility
      const result = {
        formatted_address: data.formattedAddress || '',
        geometry: {
          location: {
            lat: data.location?.latitude || 0,
            lng: data.location?.longitude || 0,
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        address_components: (data.addressComponents || []).map((component: any) => ({
          long_name: component.longText || '',
          short_name: component.shortText || '',
          types: component.types || [],
        })),
      };

      return NextResponse.json({
        success: true,
        result,
      });
    }

    console.error('Google Places API (New) error:', data.error?.message || data);
    return NextResponse.json({
      success: false,
      error: data.error?.message || 'Failed to fetch place details',
    });
  } catch (error) {
    console.error('Places details error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
