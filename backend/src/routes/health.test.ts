import { describe, it, expect } from 'vitest';
import { HealthResponseSchema } from '@ebay/shared';
import { createApp } from '../app.js';

describe('GET /api/health', () => {
  it('returns 200', async () => {
    const app = createApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
  });

  it('returns a body that conforms to HealthResponseSchema', async () => {
    const app = createApp();
    const res = await app.request('/api/health');
    const body = await res.json();
    const parsed = HealthResponseSchema.safeParse(body);
    if (!parsed.success) {
      throw new Error(`health response failed schema validation: ${parsed.error.message}`);
    }
    expect(parsed.data.status).toBe('ok');
    expect(parsed.data.service).toBe('ebay-api');
  });
});
