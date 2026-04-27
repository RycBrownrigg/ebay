import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

function loadConnectionString(): string {
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL must be set');
  }
  return url;
}

// Single shared connection pool for the api process. Small pool size —
// we run one api replica with low traffic, so 5 is plenty. postgres-js
// is a lightweight pg driver Drizzle recommends over node-postgres.
const queryClient = postgres(loadConnectionString(), {
  max: 5,
});

export const db = drizzle(queryClient, { schema });
export type DB = typeof db;
