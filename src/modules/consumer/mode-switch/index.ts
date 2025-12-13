/**
 * Mode Switch Module
 * ==================
 *
 * Exports for dual profile and mode switching.
 * Phase 15: Consumer Marketplace
 */

export { ModeSwitchService } from './mode-switch.service';
export type {
  AppMode,
  DualProfileInfo,
  ConsumerProfileSummary,
  BusinessProfileSummary,
  ModePreference,
} from './mode-switch.service';

export { createModeSwitchRoutes } from './mode-switch.routes';
