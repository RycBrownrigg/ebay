/**
 * Hono application factory.
 *
 * Assembles the API by mounting each feature router under its canonical path
 * prefix. Centralising route registration here keeps index.ts thin and makes
 * it easy to confirm the full URL surface at a glance.
 *
 * Exports:
 * - `createApp` — Constructs and returns the configured Hono application instance.
 */
import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { ebayAccountDeletionRoute } from './routes/ebay-account-deletion.js';
import { authEbayRoute } from './routes/auth-ebay.js';
import { listingsPublishRoute } from './routes/listings-publish.js';
import { draftsRoute } from './routes/drafts.js';
import { draftImagesRoute } from './routes/draft-images.js';

/** Constructs the Hono app with all feature routes mounted. */
export function createApp(): Hono {
  const app = new Hono();
  app.route('/api/health', healthRoute);
  app.route('/api/ebay/account-deletion', ebayAccountDeletionRoute);
  app.route('/api/auth/ebay', authEbayRoute);
  app.route('/api/listings/publish', listingsPublishRoute);
  app.route('/api/drafts', draftsRoute);
  app.route('/api/drafts', draftImagesRoute);
  return app;
}
