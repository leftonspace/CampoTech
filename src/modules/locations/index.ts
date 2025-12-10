/**
 * Locations Module
 * ================
 *
 * Multi-location support for CampoTech.
 * Enables organizations to manage multiple branches, service areas, and zones.
 */

// Types
export * from './location.types';

// Validation
export * from './location.validation';

// Services
export { LocationService, LocationError, getLocationService } from './location.service';
export { ZoneManager, getZoneManager } from './zone-manager';
export { CoverageCalculator, getCoverageCalculator } from './coverage-calculator';
