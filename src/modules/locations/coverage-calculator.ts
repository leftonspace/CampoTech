/**
 * Coverage Calculator
 * ===================
 *
 * Geographic calculations for coverage areas, distance, and job assignment.
 * Supports both radius-based and polygon-based coverage areas.
 */

import {
  Coordinates,
  GeoJSONPolygon,
  Location,
  LocationWithRelations,
  Zone,
  CoverageCheckResult,
  JobAssignmentSuggestion,
  LocationSettings,
} from './location.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// Average speed for travel time estimation (km/h)
const AVERAGE_SPEED_KMH = 30;

// Default scoring weights for job assignment
const SCORING_WEIGHTS = {
  distance: 0.4,        // Lower distance = higher score
  availability: 0.3,    // More technicians available = higher score
  capacity: 0.2,        // More available slots = higher score
  priority: 0.1,        // Zone priority
};

// ═══════════════════════════════════════════════════════════════════════════════
// COVERAGE CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

export class CoverageCalculator {
  /**
   * Calculate distance between two points using Haversine formula
   * Returns distance in kilometers
   */
  calculateDistance(point1: Coordinates, point2: Coordinates): number {
    const lat1Rad = this.toRadians(point1.lat);
    const lat2Rad = this.toRadians(point2.lat);
    const deltaLat = this.toRadians(point2.lat - point1.lat);
    const deltaLng = this.toRadians(point2.lng - point1.lng);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) *
      Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
  }

  /**
   * Estimate travel time in minutes
   */
  estimateTravelTime(distance: number, speedKmh: number = AVERAGE_SPEED_KMH): number {
    return Math.round((distance / speedKmh) * 60);
  }

  /**
   * Check if a point is within a radius from a center point
   */
  isPointInRadius(center: Coordinates, point: Coordinates, radiusKm: number): boolean {
    const distance = this.calculateDistance(center, point);
    return distance <= radiusKm;
  }

  /**
   * Check if a point is inside a polygon using ray casting algorithm
   */
  isPointInPolygon(point: Coordinates, polygon: GeoJSONPolygon): boolean {
    const x = point.lng;
    const y = point.lat;
    const ring = polygon.coordinates[0];

    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];

      const intersect = ((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi);

      if (intersect) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Check if a point is covered by a location's coverage area
   */
  isPointCoveredByLocation(location: LocationWithRelations, point: Coordinates): {
    covered: boolean;
    zone?: Zone;
    distance: number;
  } {
    const locationCoords = location.coordinates as Coordinates;
    if (!locationCoords) {
      return { covered: false, distance: Infinity };
    }

    const distance = this.calculateDistance(locationCoords, point);

    // Check polygon coverage first (more specific)
    if (location.coverageArea) {
      const inPolygon = this.isPointInPolygon(point, location.coverageArea as GeoJSONPolygon);
      if (inPolygon) {
        // Find matching zone
        const zone = this.findZoneForPoint(location.zones || [], point);
        return { covered: true, zone, distance };
      }
    }

    // Fall back to radius coverage
    if (location.coverageRadius && distance <= location.coverageRadius) {
      const zone = this.findZoneForPoint(location.zones || [], point);
      return { covered: true, zone, distance };
    }

    return { covered: false, distance };
  }

  /**
   * Find the first zone that contains the point
   */
  private findZoneForPoint(zones: Zone[], point: Coordinates): Zone | undefined {
    // Sort by priority (higher first)
    const sortedZones = [...zones].sort((a, b) => b.priority - a.priority);

    for (const zone of sortedZones) {
      if (zone.boundary && zone.isActive) {
        if (this.isPointInPolygon(point, zone.boundary as GeoJSONPolygon)) {
          return zone;
        }
      }
    }

    return undefined;
  }

  /**
   * Find the covering location for a point
   */
  findCoveringLocation(
    locations: LocationWithRelations[],
    point: Coordinates
  ): CoverageCheckResult {
    let bestMatch: {
      location: LocationWithRelations;
      zone?: Zone;
      distance: number;
    } | null = null;

    for (const location of locations) {
      if (!location.isActive) continue;

      const result = this.isPointCoveredByLocation(location, point);

      if (result.covered) {
        // If we find a zone match, prefer that
        if (result.zone) {
          return {
            isCovered: true,
            location: location as any,
            zone: result.zone,
            distance: result.distance,
            pricingMultiplier: location.settings?.pricingMultiplier || 1.0,
            travelFee: this.calculateTravelFee(
              result.distance,
              location.settings as LocationSettings
            ),
          };
        }

        // Keep track of the closest covering location
        if (!bestMatch || result.distance < bestMatch.distance) {
          bestMatch = { location, zone: result.zone, distance: result.distance };
        }
      }
    }

    if (bestMatch) {
      return {
        isCovered: true,
        location: bestMatch.location as any,
        zone: bestMatch.zone,
        distance: bestMatch.distance,
        pricingMultiplier: bestMatch.location.settings?.pricingMultiplier || 1.0,
        travelFee: this.calculateTravelFee(
          bestMatch.distance,
          bestMatch.location.settings as LocationSettings
        ),
      };
    }

    // Find closest location even if not covered
    let closestDistance = Infinity;
    let closestLocation: LocationWithRelations | null = null;

    for (const location of locations) {
      if (!location.isActive || !location.coordinates) continue;

      const distance = this.calculateDistance(
        location.coordinates as Coordinates,
        point
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestLocation = location;
      }
    }

    return {
      isCovered: false,
      location: closestLocation as any,
      distance: closestDistance,
    };
  }

  /**
   * Calculate travel fee based on distance and location settings
   */
  private calculateTravelFee(distance: number, settings?: LocationSettings): number {
    if (!settings) return 0;

    const feePerKm = settings.travelFeePerKm || 0;
    const minimumFee = settings.minimumTravelFee || 0;

    const calculatedFee = distance * feePerKm;
    return Math.max(calculatedFee, minimumFee);
  }

  /**
   * Suggest job assignments ranked by suitability
   */
  suggestJobAssignments(
    locations: LocationWithRelations[],
    customerLocation: Coordinates,
    scheduledDate?: Date
  ): JobAssignmentSuggestion[] {
    const suggestions: JobAssignmentSuggestion[] = [];

    for (const location of locations) {
      if (!location.isActive || !location.coordinates) continue;

      const locationCoords = location.coordinates as Coordinates;
      const distance = this.calculateDistance(locationCoords, customerLocation);
      const travelTime = this.estimateTravelTime(distance);

      // Check if within coverage
      const coverageResult = this.isPointCoveredByLocation(location, customerLocation);

      // Skip if too far (more than 100km and not in coverage area)
      if (!coverageResult.covered && distance > 100) continue;

      const settings = location.settings;
      const pricingMultiplier = settings?.pricingMultiplier || 1.0;
      const travelFee = this.calculateTravelFee(distance, settings as LocationSettings);

      // Get technician count
      const techniciansAvailable = location._count?.technicians || 0;

      // Calculate score
      const score = this.calculateAssignmentScore({
        distance,
        maxDistance: 100, // Normalize to 100km
        techniciansAvailable,
        maxTechnicians: 20, // Normalize to 20 technicians
        zonePriority: coverageResult.zone?.priority || 0,
        isInCoverage: coverageResult.covered,
      });

      suggestions.push({
        locationId: location.id,
        locationName: location.name,
        zoneId: coverageResult.zone?.id,
        zoneName: coverageResult.zone?.name,
        distance: Math.round(distance * 100) / 100,
        estimatedTravelTime: travelTime,
        availableTechnicians: techniciansAvailable,
        suggestedPrice: 0, // Would need base price to calculate
        pricingMultiplier: typeof pricingMultiplier === 'number' ? pricingMultiplier : 1.0,
        score,
      });
    }

    // Sort by score (highest first)
    return suggestions.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate assignment score (0-100)
   */
  private calculateAssignmentScore(params: {
    distance: number;
    maxDistance: number;
    techniciansAvailable: number;
    maxTechnicians: number;
    zonePriority: number;
    isInCoverage: boolean;
  }): number {
    const { distance, maxDistance, techniciansAvailable, maxTechnicians, zonePriority, isInCoverage } = params;

    // Distance score (closer = better)
    const distanceScore = Math.max(0, 100 - (distance / maxDistance) * 100);

    // Availability score
    const availabilityScore = Math.min(100, (techniciansAvailable / maxTechnicians) * 100);

    // Capacity score (simplified - would need actual job counts)
    const capacityScore = availabilityScore; // Proxy for now

    // Priority score
    const priorityScore = Math.min(100, zonePriority * 10);

    // Coverage bonus
    const coverageBonus = isInCoverage ? 20 : 0;

    // Weighted average
    const score =
      distanceScore * SCORING_WEIGHTS.distance +
      availabilityScore * SCORING_WEIGHTS.availability +
      capacityScore * SCORING_WEIGHTS.capacity +
      priorityScore * SCORING_WEIGHTS.priority +
      coverageBonus;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Get bounding box for a polygon
   */
  getPolygonBoundingBox(polygon: GeoJSONPolygon): {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  } {
    const ring = polygon.coordinates[0];
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const [lng, lat] of ring) {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    }

    return { minLat, maxLat, minLng, maxLng };
  }

  /**
   * Get centroid of a polygon
   */
  getPolygonCentroid(polygon: GeoJSONPolygon): Coordinates {
    const ring = polygon.coordinates[0];
    let sumLng = 0;
    let sumLat = 0;
    const n = ring.length - 1; // Exclude closing point

    for (let i = 0; i < n; i++) {
      sumLng += ring[i][0];
      sumLat += ring[i][1];
    }

    return {
      lng: sumLng / n,
      lat: sumLat / n,
    };
  }

  /**
   * Calculate approximate area of polygon in square kilometers
   */
  calculatePolygonAreaKm2(polygon: GeoJSONPolygon): number {
    const ring = polygon.coordinates[0];
    let area = 0;

    for (let i = 0; i < ring.length - 1; i++) {
      const p1 = ring[i];
      const p2 = ring[i + 1];

      // Shoelace formula with coordinate transformation
      area += this.toRadians(p2[0] - p1[0]) *
        (2 + Math.sin(this.toRadians(p1[1])) + Math.sin(this.toRadians(p2[1])));
    }

    area = Math.abs(area * EARTH_RADIUS_KM * EARTH_RADIUS_KM / 2);
    return area;
  }

  /**
   * Create a circular polygon (approximation) from a center and radius
   */
  createCircularPolygon(center: Coordinates, radiusKm: number, points: number = 32): GeoJSONPolygon {
    const coordinates: number[][] = [];

    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * 2 * Math.PI;
      const point = this.destinationPoint(center, radiusKm, angle);
      coordinates.push([point.lng, point.lat]);
    }

    return {
      type: 'Polygon',
      coordinates: [coordinates],
    };
  }

  /**
   * Calculate destination point given start, distance, and bearing
   */
  private destinationPoint(start: Coordinates, distanceKm: number, bearingRad: number): Coordinates {
    const lat1 = this.toRadians(start.lat);
    const lng1 = this.toRadians(start.lng);
    const angularDistance = distanceKm / EARTH_RADIUS_KM;

    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    const lng2 = lng1 + Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2)
    );

    return {
      lat: this.toDegrees(lat2),
      lng: this.toDegrees(lng2),
    };
  }

  /**
   * Check if two polygons overlap
   */
  doPolygonsOverlap(polygon1: GeoJSONPolygon, polygon2: GeoJSONPolygon): boolean {
    // Simple check: see if any vertex of one polygon is inside the other
    const ring1 = polygon1.coordinates[0];
    const ring2 = polygon2.coordinates[0];

    // Check if any point of polygon1 is inside polygon2
    for (const [lng, lat] of ring1) {
      if (this.isPointInPolygon({ lat, lng }, polygon2)) {
        return true;
      }
    }

    // Check if any point of polygon2 is inside polygon1
    for (const [lng, lat] of ring2) {
      if (this.isPointInPolygon({ lat, lng }, polygon1)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Convert degrees to radians
   */
  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Convert radians to degrees
   */
  private toDegrees(radians: number): number {
    return radians * (180 / Math.PI);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let coverageCalculator: CoverageCalculator | null = null;

export function getCoverageCalculator(): CoverageCalculator {
  if (!coverageCalculator) {
    coverageCalculator = new CoverageCalculator();
  }
  return coverageCalculator;
}
