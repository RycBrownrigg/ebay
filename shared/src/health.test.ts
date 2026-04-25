import { describe, it, expect } from 'vitest';
import { HealthResponseSchema } from './health.js';

describe('HealthResponseSchema', () => {
  it('accepts a well-formed response', () => {
    const ok = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'ebay-api',
      version: '0.0.0',
      uptimeSeconds: 12.34,
      timestamp: '2026-04-24T20:00:00.000Z',
    });
    expect(ok.success).toBe(true);
  });

  it('rejects a wrong status literal', () => {
    const bad = HealthResponseSchema.safeParse({
      status: 'degraded',
      service: 'ebay-api',
      version: '0.0.0',
      uptimeSeconds: 0,
      timestamp: '2026-04-24T20:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a non-ISO timestamp', () => {
    const bad = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'ebay-api',
      version: '0.0.0',
      uptimeSeconds: 0,
      timestamp: 'yesterday',
    });
    expect(bad.success).toBe(false);
  });

  it('rejects a negative uptime', () => {
    const bad = HealthResponseSchema.safeParse({
      status: 'ok',
      service: 'ebay-api',
      version: '0.0.0',
      uptimeSeconds: -1,
      timestamp: '2026-04-24T20:00:00.000Z',
    });
    expect(bad.success).toBe(false);
  });
});
