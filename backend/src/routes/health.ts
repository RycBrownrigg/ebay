/**
 * Health-check route.
 *
 * Returns a JSON payload confirming the service is running, including the
 * current version, uptime, and a timestamp. Used by the web front end's
 * HealthCard component and by container health checks.
 *
 * Routes:
 * - GET / — Returns service status, version, uptime, and current timestamp.
 */
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
