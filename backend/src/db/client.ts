import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

// Lazy-init the Drizzle client on first access. Reasons for the Proxy:
// - Tests import app.ts → routes → this module without setting
//   DATABASE_URL. Eager init would throw at import time and crash the
//   test runner before any beforeEach() can configure env.
// - Production code paths (api startup, migrations) all set DATABASE_URL
//   before touching the db, so the lazy init still throws at the right
//   time (first query) with a clear error.
// postgres-js itself is lazy (no connection until first query), so the
// Proxy pattern is purely about deferring the env-var read.

type DB = ReturnType<typeof drizzle<typeof schema>>;

let cached: DB | null = null;

function ensureDb(): DB {
  if (cached) return cached;
  const url = process.env['DATABASE_URL'];
  if (!url) {
    throw new Error('DATABASE_URL must be set');
  }
  const client = postgres(url, { max: 5 });
  cached = drizzle(client, { schema });
  return cached;
}

export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    return Reflect.get(ensureDb(), prop, receiver);
  },
});

export type { DB };
