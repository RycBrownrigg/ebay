/**
 * Backend API entry point.
 *
 * Runs pending database migrations, constructs the Hono app, then starts the
 * Node HTTP server. The server binds to the port in the PORT environment
 * variable (default 3001) and logs its address when ready.
 */
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';

const port = Number(process.env['PORT'] ?? 3001);

await runMigrations();

const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`ebay-api listening on http://localhost:${info.port}`);
});
