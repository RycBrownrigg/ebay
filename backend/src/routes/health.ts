import { Hono } from 'hono';
import type { HealthResponse } from '@ebay/shared';
import pkg from '../../package.json' with { type: 'json' };

export const healthRoute = new Hono();

healthRoute.get('/', (c) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'ebay-api',
    version: pkg.version,
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  };
  return c.json(body);
});
