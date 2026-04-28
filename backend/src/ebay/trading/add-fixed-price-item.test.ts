import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addFixedPriceItem } from './add-fixed-price-item.js';
import type { ListingPayload } from './xml.js';

const VALID_OAUTH_ENV = {
  EBAY_ENV: 'sandbox',
  EBAY_APP_ID: 'app',
  EBAY_CERT_ID: 'cert',
  EBAY_RUNAME_SANDBOX: 'runame',
} as const;

const PAYLOAD: ListingPayload = {
  title: 'Test Item',
  description: 'A description.',
  categoryId: '11116',
  conditionId: 1000,
  startPrice: { value: 9.99, currency: 'USD' },
  postalCode: '95125',
  quantity: 1,
  shippingService: 'USPSPriority',
  shippingCost: { value: 5, currency: 'USD' },
  returnAcceptedDays: 30,
};

const SUCCESS_RESPONSE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Success</Ack>
  <ItemID>110123456789</ItemID>
  <StartTime>2026-04-28T17:00:00.000Z</StartTime>
  <EndTime>2026-05-05T17:00:00.000Z</EndTime>
</AddFixedPriceItemResponse>`;

describe('addFixedPriceItem', () => {
  beforeEach(() => {
    for (const [k, v] of Object.entries(VALID_OAUTH_ENV)) {
      process.env[k] = v;
    }
  });

  afterEach(() => {
    for (const k of Object.keys(VALID_OAUTH_ENV)) {
      delete process.env[k];
    }
    vi.unstubAllGlobals();
  });

  it('builds XML, POSTs to the sandbox Trading endpoint, returns parsed Success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SUCCESS_RESPONSE_XML,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await addFixedPriceItem(PAYLOAD, 'access-token-xyz');
    expect(result.ack).toBe('Success');
    if (result.ack !== 'Success' && result.ack !== 'Warning') {
      throw new Error('expected success');
    }
    expect(result.itemId).toBe('110123456789');

    // Assert the HTTP call
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.sandbox.ebay.com/ws/api.dll');
    expect(init.method).toBe('POST');
  });

  it('sends the required Trading API headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SUCCESS_RESPONSE_XML,
    });
    vi.stubGlobal('fetch', fetchMock);

    await addFixedPriceItem(PAYLOAD, 'my-access-token');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['X-EBAY-API-CALL-NAME']).toBe('AddFixedPriceItem');
    expect(init.headers['X-EBAY-API-COMPATIBILITY-LEVEL']).toBe('1227');
    expect(init.headers['X-EBAY-API-SITEID']).toBe('0');
    expect(init.headers['X-EBAY-API-IAF-TOKEN']).toBe('my-access-token');
    expect(String(init.headers['Content-Type'])).toMatch(/text\/xml/);
  });

  it('sends a body containing the AddFixedPriceItemRequest envelope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SUCCESS_RESPONSE_XML,
    });
    vi.stubGlobal('fetch', fetchMock);

    await addFixedPriceItem(PAYLOAD, 'token');

    const [, init] = fetchMock.mock.calls[0]!;
    const body = init.body as string;
    expect(body).toContain('<AddFixedPriceItemRequest');
    expect(body).toContain('<Title>Test Item</Title>');
  });

  it('targets the production endpoint when EBAY_ENV=production', async () => {
    process.env['EBAY_ENV'] = 'production';
    process.env['EBAY_RUNAME_PRODUCTION'] = 'prod-runame';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => SUCCESS_RESPONSE_XML,
    });
    vi.stubGlobal('fetch', fetchMock);

    await addFixedPriceItem(PAYLOAD, 'token');

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.ebay.com/ws/api.dll');

    delete process.env['EBAY_RUNAME_PRODUCTION'];
  });

  it('throws on non-2xx HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => '<error>internal</error>',
      }),
    );
    await expect(addFixedPriceItem(PAYLOAD, 'token')).rejects.toThrow(/HTTP 500/);
  });

  it('returns a parsed Failure when eBay returns Ack=Failure', async () => {
    const failureXml = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ShortMessage>Bad postal code</ShortMessage>
    <ErrorCode>166</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
</AddFixedPriceItemResponse>`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => failureXml }),
    );
    const result = await addFixedPriceItem(PAYLOAD, 'token');
    expect(result.ack).toBe('Failure');
    if (result.ack !== 'Failure' && result.ack !== 'PartialFailure') {
      throw new Error('expected failure');
    }
    expect(result.errors[0]!.errorCode).toBe('166');
  });
});
