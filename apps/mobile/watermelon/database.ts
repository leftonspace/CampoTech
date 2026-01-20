/**
 * WatermelonDB Database - Platform Router
 * ========================================
 * 
 * This file routes to the correct database implementation based on platform.
 * Metro bundler will use:
 * - database.native.ts for iOS/Android
 * - database.web.ts for web
 * 
 * This file is a fallback that re-exports the native version.
 */

export * from './database.native';
export { default } from './database.native';
