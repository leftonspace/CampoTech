/**
 * Geo Search Service
 * ==================
 *
 * Geographic search functionality for finding nearby businesses.
 * Uses PostGIS-compatible queries for spatial operations.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import { ServiceCategory } from '../consumer.types';
import { GeoSearchParams, GeoSearchResult } from './discovery.types';

// ═══════════════════════════════════════════════════════════════════════════════
// GEO SEARCH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class GeoSearchService {
  constructor(private pool: Pool) {}

  /**
   * Find businesses within a radius of a point
   * Uses Haversine formula for distance calculation
   */
  async findNearby(
    params: GeoSearchParams,
    client?: PoolClient
  ): Promise<GeoSearchResult[]> {
    const conn = client || this.pool;
    const { lat, lng, radiusKm, category, limit = 50 } = params;

    // Haversine formula in SQL
    // Note: For production, consider using PostGIS extension for better performance
    let query = `
      SELECT
        bpp.id as business_id,
        sa.lat,
        sa.lng,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(sa.lat)) *
            cos(radians(sa.lng) - radians($2)) +
            sin(radians($1)) * sin(radians(sa.lat))
          )
        ) as distance
      FROM business_public_profiles bpp
      CROSS JOIN LATERAL (
        SELECT
          COALESCE((service_areas->0->>'lat')::decimal, -34.6037) as lat,
          COALESCE((service_areas->0->>'lng')::decimal, -58.3816) as lng
        FROM business_public_profiles
        WHERE id = bpp.id
      ) sa
      WHERE bpp.is_visible = true
        AND bpp.is_suspended = false
        AND bpp.accepting_new_clients = true
    `;

    const values: any[] = [lat, lng];
    let paramIndex = 3;

    if (category) {
      query += ` AND $${paramIndex} = ANY(bpp.categories)`;
      values.push(category);
      paramIndex++;
    }

    query += `
      HAVING (
        6371 * acos(
          cos(radians($1)) * cos(radians(sa.lat)) *
          cos(radians(sa.lng) - radians($2)) +
          sin(radians($1)) * sin(radians(sa.lat))
        )
      ) <= $${paramIndex}
      ORDER BY distance ASC
      LIMIT $${paramIndex + 1}
    `;
    values.push(radiusKm, limit);

    const result = await conn.query(query, values);

    return result.rows.map(row => ({
      businessId: row.business_id,
      distance: parseFloat(row.distance),
      lat: parseFloat(row.lat),
      lng: parseFloat(row.lng),
    }));
  }

  /**
   * Find businesses serving a specific area
   * Checks if the business's service areas cover the requested location
   */
  async findServingArea(
    lat: number,
    lng: number,
    city: string,
    neighborhood?: string,
    category?: ServiceCategory,
    limit = 50,
    client?: PoolClient
  ): Promise<{ businessId: string; distance: number }[]> {
    const conn = client || this.pool;

    let query = `
      SELECT DISTINCT
        bpp.id as business_id,
        (
          6371 * acos(
            cos(radians($1)) * cos(radians(
              COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
            )) *
            cos(radians(
              COALESCE((bpp.service_areas->0->>'lng')::decimal, -58.3816)
            ) - radians($2)) +
            sin(radians($1)) * sin(radians(
              COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
            ))
          )
        ) as distance
      FROM business_public_profiles bpp
      WHERE bpp.is_visible = true
        AND bpp.is_suspended = false
        AND bpp.accepting_new_clients = true
        AND (
          -- Check if any service area matches
          EXISTS (
            SELECT 1 FROM jsonb_array_elements(bpp.service_areas) sa
            WHERE sa->>'city' = $3
              OR (sa->>'neighborhood' IS NOT NULL AND sa->>'neighborhood' = $4)
          )
          -- Or check if business serves within max travel distance
          OR (
            6371 * acos(
              cos(radians($1)) * cos(radians(
                COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
              )) *
              cos(radians(
                COALESCE((bpp.service_areas->0->>'lng')::decimal, -58.3816)
              ) - radians($2)) +
              sin(radians($1)) * sin(radians(
                COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
              ))
            )
          ) <= bpp.max_travel_distance_km
        )
    `;

    const values: any[] = [lat, lng, city, neighborhood || ''];
    let paramIndex = 5;

    if (category) {
      query += ` AND $${paramIndex} = ANY(bpp.categories)`;
      values.push(category);
      paramIndex++;
    }

    query += `
      ORDER BY distance ASC
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    const result = await conn.query(query, values);

    return result.rows.map(row => ({
      businessId: row.business_id,
      distance: parseFloat(row.distance),
    }));
  }

  /**
   * Get business service coverage areas
   */
  async getBusinessCoverage(
    businessId: string,
    client?: PoolClient
  ): Promise<{ areas: { city: string; neighborhood?: string; radiusKm?: number }[]; maxDistance: number }> {
    const conn = client || this.pool;

    const result = await conn.query(
      `SELECT service_areas, max_travel_distance_km
       FROM business_public_profiles
       WHERE id = $1`,
      [businessId]
    );

    if (result.rows.length === 0) {
      return { areas: [], maxDistance: 0 };
    }

    const row = result.rows[0];
    return {
      areas: row.service_areas || [],
      maxDistance: row.max_travel_distance_km || 20,
    };
  }

  /**
   * Calculate distance between two points (Haversine)
   */
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  /**
   * Get bounding box for a radius search
   * Useful for initial filtering before precise distance calculation
   */
  getBoundingBox(
    lat: number,
    lng: number,
    radiusKm: number
  ): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
    // Approximate degrees per km
    const latDelta = radiusKm / 111.32;
    const lngDelta = radiusKm / (111.32 * Math.cos(this.toRad(lat)));

    return {
      minLat: lat - latDelta,
      maxLat: lat + latDelta,
      minLng: lng - lngDelta,
      maxLng: lng + lngDelta,
    };
  }

  /**
   * Get popular neighborhoods in a city
   */
  async getPopularNeighborhoods(
    city: string,
    category?: ServiceCategory,
    limit = 20,
    client?: PoolClient
  ): Promise<{ neighborhood: string; businessCount: number }[]> {
    const conn = client || this.pool;

    let query = `
      SELECT
        sa->>'neighborhood' as neighborhood,
        COUNT(DISTINCT bpp.id) as business_count
      FROM business_public_profiles bpp,
           jsonb_array_elements(bpp.service_areas) sa
      WHERE bpp.is_visible = true
        AND bpp.is_suspended = false
        AND sa->>'city' = $1
        AND sa->>'neighborhood' IS NOT NULL
    `;

    const values: any[] = [city];
    let paramIndex = 2;

    if (category) {
      query += ` AND $${paramIndex} = ANY(bpp.categories)`;
      values.push(category);
      paramIndex++;
    }

    query += `
      GROUP BY sa->>'neighborhood'
      ORDER BY business_count DESC
      LIMIT $${paramIndex}
    `;
    values.push(limit);

    const result = await conn.query(query, values);

    return result.rows.map(row => ({
      neighborhood: row.neighborhood,
      businessCount: parseInt(row.business_count, 10),
    }));
  }

  /**
   * Check if a business serves a specific location
   */
  async businessServesLocation(
    businessId: string,
    lat: number,
    lng: number,
    city: string,
    neighborhood?: string,
    client?: PoolClient
  ): Promise<boolean> {
    const conn = client || this.pool;

    const result = await conn.query(
      `SELECT 1 FROM business_public_profiles bpp
       WHERE bpp.id = $1
         AND bpp.is_visible = true
         AND bpp.is_suspended = false
         AND (
           -- Check if any service area matches
           EXISTS (
             SELECT 1 FROM jsonb_array_elements(bpp.service_areas) sa
             WHERE sa->>'city' = $3
               OR (sa->>'neighborhood' IS NOT NULL AND sa->>'neighborhood' = $4)
           )
           -- Or check distance
           OR (
             6371 * acos(
               cos(radians($2)) * cos(radians(
                 COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
               )) *
               cos(radians(
                 COALESCE((bpp.service_areas->0->>'lng')::decimal, -58.3816)
               ) - radians($5)) +
               sin(radians($2)) * sin(radians(
                 COALESCE((bpp.service_areas->0->>'lat')::decimal, -34.6037)
               ))
             )
           ) <= bpp.max_travel_distance_km
         )`,
      [businessId, lat, city, neighborhood || '', lng]
    );

    return result.rows.length > 0;
  }
}
