/**
 * Maps Components Module
 * ======================
 *
 * Phase 9.9: Customer Live Tracking System
 * Exports map components and utilities.
 */

// Map Providers
export {
  getMapProvider,
  getTileLayerUrl,
  calculateRoute,
  decodePolyline,
  ARGENTINA_DEFAULTS,
  MAP_PROVIDERS,
} from './map-providers';
export type {
  MapProviderType,
  MapProviderConfig,
  RouteOptions,
  RouteResult,
} from './map-providers';

// Marker Animation
export {
  interpolatePosition,
  calculateBearing,
  animateMarker,
  PositionTracker,
  createPulseAnimation,
  getRotationStyle,
} from './marker-animation';
export type { Position, AnimationOptions } from './marker-animation';

// Components
export { default as TrackingMap } from './TrackingMap';
export { MapLayerControls } from './MapLayerControls';
export type { MapLayerState } from './MapLayerControls';
export { MapFiltersPanel } from './MapFiltersPanel';
export type { MapFilters } from './MapFiltersPanel';
export { ItineraryPanel } from './ItineraryPanel';
