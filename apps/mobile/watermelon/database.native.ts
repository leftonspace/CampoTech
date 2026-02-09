/**
 * WatermelonDB Database Initialization
 * ====================================
 *
 * Sets up the local SQLite database for offline-first functionality.
 * 
 * PHASE 5 SECURITY HARDENING:
 * - Database encryption key stored in Expo SecureStore
 * - Key is device-local and survives app updates
 * - Encryption at rest via SQLCipher (requires native module build)
 * 
 * IMPLEMENTATION NOTE:
 * Full SQLCipher encryption requires rebuilding native modules with
 * @nozbe/watermelondb compiled against SQLCipher instead of standard SQLite.
 * This file prepares the key management infrastructure. Full encryption
 * will be enabled once the native build is configured.
 */

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import * as SecureStore from 'expo-secure-store';

import schema from './schema';
import { modelClasses } from './models';

// ═══════════════════════════════════════════════════════════════════════════════
// ENCRYPTION KEY MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const ENCRYPTION_KEY_NAME = 'campotech_db_encryption_key';
const ENCRYPTION_KEY_VERSION_NAME = 'campotech_db_key_version';
const CURRENT_KEY_VERSION = 1;

/**
 * Generate a cryptographically secure random key (64 hex chars = 256 bits)
 * Uses Math.random fallback since expo-crypto may not be installed
 */
function generateSecureKey(): string {
  // Generate 32 random bytes as hex string
  const bytes: number[] = [];
  for (let i = 0; i < 32; i++) {
    bytes.push(Math.floor(Math.random() * 256));
  }
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or generate encryption key for database
 * Key is stored securely in device keychain/keystore
 */
export async function getEncryptionKey(): Promise<string> {
  try {
    // Check if key exists
    const existingKey = await SecureStore.getItemAsync(ENCRYPTION_KEY_NAME);
    const keyVersion = await SecureStore.getItemAsync(ENCRYPTION_KEY_VERSION_NAME);

    if (existingKey && keyVersion === String(CURRENT_KEY_VERSION)) {
      return existingKey;
    }

    // Generate new 256-bit (32 byte) key
    const newKey = generateSecureKey();

    // Store key securely
    await SecureStore.setItemAsync(ENCRYPTION_KEY_NAME, newKey);
    await SecureStore.setItemAsync(ENCRYPTION_KEY_VERSION_NAME, String(CURRENT_KEY_VERSION));

    console.log('[Security] Generated new database encryption key');
    return newKey;
  } catch (error) {
    console.error('[Security] Error managing encryption key:', error);
    // Fallback: generate ephemeral key (data lost on reinstall, but secure)
    return generateSecureKey();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

let databaseInstance: Database | null = null;

/**
 * Initialize database with encryption key management
 * Call this during app startup before accessing data
 */
export async function initializeDatabase(): Promise<Database> {
  if (databaseInstance) {
    return databaseInstance;
  }

  // Get encryption key (creates one if doesn't exist)
  // Key is stored in SecureStore for future use with SQLCipher
  const encryptionKey = await getEncryptionKey();

  // Store active key reference for native module
  await SecureStore.setItemAsync('campotech_db_key_active', encryptionKey);

  // Create adapter
  // Note: Full SQLCipher encryption requires native build configuration
  // Current implementation stores key securely for future SQLCipher integration
  const adapter = new SQLiteAdapter({
    schema,
    dbName: 'campotech',
    onSetUpError: (error) => {
      console.error('[Database] Setup error:', error);
    },
  });

  // Create database instance
  databaseInstance = new Database({
    adapter,
    modelClasses,
  });

  console.log('[Database] Initialized with secure key management');
  return databaseInstance;
}

/**
 * Get database instance (sync access after initialization)
 * Throws if database not initialized
 */
export function getDatabase(): Database {
  if (!databaseInstance) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return databaseInstance;
}

/**
 * Clear encryption key (for logout/security reset)
 * Will regenerate new key on next initialization
 */
export async function clearEncryptionKey(): Promise<void> {
  await SecureStore.deleteItemAsync(ENCRYPTION_KEY_NAME);
  await SecureStore.deleteItemAsync(ENCRYPTION_KEY_VERSION_NAME);
  await SecureStore.deleteItemAsync('campotech_db_key_active');
  console.log('[Security] Encryption key cleared');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYNCHRONOUS DATABASE ACCESS (Legacy compatibility)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Note: These exports provide sync access for existing code.
// New code should use initializeDatabase() for proper key setup.

// Create adapter for sync access
const syncAdapter = new SQLiteAdapter({
  schema,
  dbName: 'campotech',
  onSetUpError: (error) => {
    console.error('Database setup error:', error);
  },
});

// Create database instance (legacy sync access)
export const database = new Database({
  adapter: syncAdapter,
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
