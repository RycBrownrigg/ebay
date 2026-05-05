import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the dependencies that touch the DB or eBay's network. We test
// only the route's HTTP behavior here; the underlying logic (XML
// builder, parser, OAuth helpers) has its own unit tests.
vi.mock('../db/household.js', () => ({
  getOrCreateHouseholdUser: vi.fn(),
}));
vi.mock('../ebay/access-token.js', () => ({
  getEbayAccessToken: vi.fn(),
}));
vi.mock('../ebay/trading/add-fixed-price-item.js', () => ({
  addFixedPriceItem: vi.fn(),
}));

import { getOrCreateHouseholdUser } from '../db/household.js';
import { getEbayAccessToken } from '../ebay/access-token.js';
import { addFixedPriceItem } from '../ebay/trading/add-fixed-price-item.js';
import { createApp } from '../app.js';

const VALID_OAUTH_ENV = {
  EBAY_ENV: 'sandbox',
  EBAY_APP_ID: 'app',
  EBAY_CERT_ID: 'cert',
  EBAY_RUNAME_SANDBOX: 'runame',
} as const;

describe('POST /api/listings/publish', () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(VALID_OAUTH_ENV)) {
      process.env[k] = v;
    }
    vi.mocked(getOrCreateHouseholdUser).mockResolvedValue({
      id: 'user-uuid',
      email: 'household@local',
      passwordHash: null,
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    for (const k of Object.keys(VALID_OAUTH_ENV)) {
      delete process.env[k];
    }
    vi.clearAllMocks();
  });

  it('returns 503 when OAuth config is incomplete', async () => {
    delete process.env['EBAY_APP_ID'];
    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    expect(res.status).toBe(503);
  });

  it('returns 401 when getEbayAccessToken throws (user not connected)', async () => {
    vi.mocked(getEbayAccessToken).mockRejectedValue(new Error('no ebay_auth row'));
    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/eBay not connected/);
  });

  it('returns 200 with itemId and sandbox listingUrl on Success', async () => {
    vi.mocked(getEbayAccessToken).mockResolvedValue('access-token-xyz');
    vi.mocked(addFixedPriceItem).mockResolvedValue({
      ack: 'Success',
      itemId: '110123456789',
      startTime: '2026-04-29T12:00:00.000Z',
      endTime: '2026-05-06T12:00:00.000Z',
    });

    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ack?: string;
      itemId?: string;
      listingUrl?: string;
    };
    expect(body.ack).toBe('Success');
    expect(body.itemId).toBe('110123456789');
    expect(body.listingUrl).toBe('https://www.sandbox.ebay.com/itm/110123456789');

    // The hardcoded payload should have been passed to addFixedPriceItem.
    const callArgs = vi.mocked(addFixedPriceItem).mock.calls[0]!;
    const [payload, token] = callArgs;
    expect(token).toBe('access-token-xyz');
    expect(payload.title).toMatch(/M1 test listing/);
    expect(payload.title.length).toBeLessThanOrEqual(80);
    expect(payload.startPrice.currency).toBe('USD');
  });

  it('uses production listingUrl host when EBAY_ENV=production', async () => {
    process.env['EBAY_ENV'] = 'production';
    process.env['EBAY_RUNAME_PRODUCTION'] = 'prod-runame';
    vi.mocked(getEbayAccessToken).mockResolvedValue('access-token-xyz');
    vi.mocked(addFixedPriceItem).mockResolvedValue({
      ack: 'Success',
      itemId: '111111111',
    });

    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    const body = (await res.json()) as { listingUrl?: string };
    expect(body.listingUrl).toBe('https://www.ebay.com/itm/111111111');

    delete process.env['EBAY_RUNAME_PRODUCTION'];
  });

  it('returns 502 with errors on Failure ack', async () => {
    vi.mocked(getEbayAccessToken).mockResolvedValue('token');
    vi.mocked(addFixedPriceItem).mockResolvedValue({
      ack: 'Failure',
      errors: [
        {
          errorCode: '166',
          severity: 'Error',
          shortMessage: 'Bad postal code',
        },
      ],
    });

    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { ack?: string; errors?: { errorCode: string }[] };
    expect(body.ack).toBe('Failure');
    expect(body.errors?.[0]?.errorCode).toBe('166');
  });

  it('returns 502 when addFixedPriceItem throws', async () => {
    vi.mocked(getEbayAccessToken).mockResolvedValue('token');
    vi.mocked(addFixedPriceItem).mockRejectedValue(new Error('network unreachable'));

    const res = await createApp().request('/api/listings/publish', { method: 'POST' });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/network unreachable/);
  });
});
