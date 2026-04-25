import { Hono } from 'hono';
import { healthRoute } from './routes/health.js';

export function createApp(): Hono {
  const app = new Hono();
  app.route('/api/health', healthRoute);
  return app;
}
