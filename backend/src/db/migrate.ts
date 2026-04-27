import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

// Programmatic migration runner. Called at api container startup
// (src/index.ts) so deploys are zero-touch — `docker compose up -d
// --build` rebuilds, restarts the container, and pending migrations
// apply before the server begins accepting requests.
//
// Migrations are idempotent (Drizzle tracks applied migrations in a
// dedicated table), so this is safe to call on every container start.
//
// Uses a separate single-connection client per Drizzle's recommendation
// — the migration step shouldn't share the runtime pool.
export async function runMigrations(): Promise<void> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL must be set to run migrations');
  }

  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../drizzle',
  );

  const migrationClient = postgres(connectionString, { max: 1 });
  try {
    const migrationDb = drizzle(migrationClient);
    console.log(`[db] running migrations from ${migrationsFolder}`);
    await migrate(migrationDb, { migrationsFolder });
    console.log('[db] migrations complete');
  } finally {
    await migrationClient.end();
  }
}
