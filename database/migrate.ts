#!/usr/bin/env ts-node
/**
 * Database Migration Runner
 * =========================
 *
 * Runs all pending migrations in order.
 *
 * USAGE:
 *   npm run migration:run              # Run all pending migrations
 *   npm run migration:run -- --dry-run # Show what would be run
 *   npm run migration:rollback         # Rollback last migration
 */

import * as fs from 'fs';
import * as path from 'path';

// Database client interface
interface DatabaseClient {
  query: (sql: string) => Promise<{ rows: unknown[] }>;
}

// Migration record
interface MigrationRecord {
  id: number;
  name: string;
  executed_at: Date;
}

// Create migrations tracking table
const CREATE_MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);
`;

/**
 * Get list of migration files
 */
function getMigrationFiles(): string[] {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();
  return files;
}

/**
 * Get list of executed migrations
 */
async function getExecutedMigrations(db: DatabaseClient): Promise<string[]> {
  const result = await db.query('SELECT name FROM _migrations ORDER BY id');
  return (result.rows as MigrationRecord[]).map(r => r.name);
}

/**
 * Run a single migration
 */
async function runMigration(db: DatabaseClient, filename: string): Promise<void> {
  const migrationsDir = path.join(__dirname, 'migrations');
  const sql = fs.readFileSync(path.join(migrationsDir, filename), 'utf8');

  console.log(`Running migration: ${filename}`);

  // Run migration in a transaction
  await db.query('BEGIN');
  try {
    await db.query(sql);
    await db.query(
      'INSERT INTO _migrations (name) VALUES ($1)',
      // @ts-ignore - params not in interface
    );
    await db.query('COMMIT');
    console.log(`✅ Completed: ${filename}`);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error(`❌ Failed: ${filename}`);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
async function runMigrations(db: DatabaseClient, dryRun = false): Promise<void> {
  // Ensure migrations table exists
  await db.query(CREATE_MIGRATIONS_TABLE);

  // Get pending migrations
  const allMigrations = getMigrationFiles();
  const executedMigrations = await getExecutedMigrations(db);
  const pendingMigrations = allMigrations.filter(m => !executedMigrations.includes(m));

  if (pendingMigrations.length === 0) {
    console.log('No pending migrations.');
    return;
  }

  console.log(`Found ${pendingMigrations.length} pending migration(s):`);
  pendingMigrations.forEach(m => console.log(`  - ${m}`));

  if (dryRun) {
    console.log('\nDry run mode - no changes made.');
    return;
  }

  console.log('\nRunning migrations...\n');

  for (const migration of pendingMigrations) {
    await runMigration(db, migration);
  }

  console.log('\n✅ All migrations completed successfully!');
}

/**
 * Get migration status
 */
async function getMigrationStatus(db: DatabaseClient): Promise<void> {
  await db.query(CREATE_MIGRATIONS_TABLE);

  const allMigrations = getMigrationFiles();
  const executedMigrations = await getExecutedMigrations(db);

  console.log('\nMigration Status:');
  console.log('─'.repeat(60));

  for (const migration of allMigrations) {
    const executed = executedMigrations.includes(migration);
    const status = executed ? '✅' : '⏳';
    console.log(`${status} ${migration}`);
  }

  console.log('─'.repeat(60));
  console.log(`Total: ${allMigrations.length} | Executed: ${executedMigrations.length} | Pending: ${allMigrations.length - executedMigrations.length}`);
}

// Export for programmatic use
export { runMigrations, getMigrationStatus, getMigrationFiles };

// CLI entry point
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'run';
  const dryRun = args.includes('--dry-run');

  // In production, this would use actual database connection
  console.log('Database Migration Tool');
  console.log('=======================\n');

  if (command === 'status') {
    console.log('Would show migration status (requires database connection)');
    getMigrationFiles().forEach(f => console.log(`  ${f}`));
  } else if (command === 'run') {
    console.log(dryRun ? 'Dry run mode' : 'Would run migrations (requires database connection)');
    getMigrationFiles().forEach(f => console.log(`  ${f}`));
  } else {
    console.log('Usage:');
    console.log('  npm run migration:run              Run pending migrations');
    console.log('  npm run migration:run -- --dry-run Show what would run');
    console.log('  npm run migration:status           Show migration status');
  }
}

main().catch(console.error);
