/**
 * WatermelonDB Database Initialization
 * ====================================
 *
 * Sets up the local SQLite database for offline-first functionality.
 */

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import schema from './schema';
import { modelClasses } from './models';

// Create adapter
const adapter = new SQLiteAdapter({
  schema,
  // (optional) migrations
  // migrations,
  // (optional) jsi: Platform.OS === 'ios',
  dbName: 'campotech',
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

// Create database instance
export const database = new Database({
  adapter,
  modelClasses,
});

// Export collections for easy access
export const jobsCollection = database.get('jobs');
export const customersCollection = database.get('customers');
export const priceBookCollection = database.get('price_book_items');
export const jobPhotosCollection = database.get('job_photos');
export const syncQueueCollection = database.get('sync_queue');
export const syncConflictsCollection = database.get('sync_conflicts');
export const userSessionCollection = database.get('user_session');

export default database;
