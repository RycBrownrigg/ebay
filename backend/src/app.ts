import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';
import { ebayAccountDeletionRoute } from './routes/ebay-account-deletion.js';

export function createApp(): Hono {
  const app = new Hono();
  app.route('/api/health', healthRoute);
  app.route('/api/ebay/account-deletion', ebayAccountDeletionRoute);
  return app;
}
