import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

const VALID_ENV = {
  EBAY_ENV: 'sandbox',
  EBAY_APP_ID: 'app-id-test',
  EBAY_CERT_ID: 'cert-id-test',
  EBAY_RUNAME_SANDBOX: 'runame-test',
  EBAY_REFRESH_TOKEN_SEAL_KEY: Buffer.from(new Uint8Array(32).fill(7)).toString('base64'),
};

function setEnv(values: Record<string, string | undefined>) {
  for (const k of Object.keys(VALID_ENV)) {
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) process.env[k] = v;
  }
}

describe('GET /api/auth/ebay/login', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => setEnv({}));

  it('returns 302 with a Location pointing at the eBay consent endpoint', async () => {
    const res = await createApp().request('/api/auth/ebay/login');
    expect(res.status).toBe(302);
    const loc = res.headers.get('location');
    expect(loc).not.toBeNull();
    const url = new URL(loc!);
    expect(url.host).toBe('auth.sandbox.ebay.com');
    expect(url.pathname).toBe('/oauth2/authorize');
    expect(url.searchParams.get('client_id')).toBe(VALID_ENV.EBAY_APP_ID);
    expect(url.searchParams.get('redirect_uri')).toBe(VALID_ENV.EBAY_RUNAME_SANDBOX);
  });

  it('sets a HttpOnly Secure state cookie matching the redirect state param', async () => {
    const res = await createApp().request('/api/auth/ebay/login');
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toBeTruthy();

    const loc = res.headers.get('location')!;
    const state = new URL(loc).searchParams.get('state')!;
    expect(state.length).toBeGreaterThan(0);
    expect(setCookie).toContain(`ebay_oauth_state=${state}`);
    expect(setCookie!.toLowerCase()).toContain('httponly');
    expect(setCookie!.toLowerCase()).toContain('secure');
  });

  it('returns 503 if EBAY_APP_ID is unset', async () => {
    setEnv({ ...VALID_ENV, EBAY_APP_ID: undefined });
    const res = await createApp().request('/api/auth/ebay/login');
    expect(res.status).toBe(503);
  });
});

describe('GET /api/auth/ebay/callback', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => setEnv({}));

  it('returns 400 when code is missing', async () => {
    const res = await createApp().request('/api/auth/ebay/callback?state=x');
    expect(res.status).toBe(400);
  });

  it('returns 400 when state is missing', async () => {
    const res = await createApp().request('/api/auth/ebay/callback?code=abc');
    expect(res.status).toBe(400);
  });

  it('returns 400 with state mismatch when cookie is absent', async () => {
    const res = await createApp().request('/api/auth/ebay/callback?code=abc&state=xyz');
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/state mismatch/);
  });

  it('returns 400 with state mismatch when cookie value differs', async () => {
    const res = await createApp().request('/api/auth/ebay/callback?code=abc&state=xyz', {
      headers: { cookie: 'ebay_oauth_state=different' },
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/ebay/declined', () => {
  it('returns a 200 HTML page that mentions the app name', async () => {
    const res = await createApp().request('/api/auth/ebay/declined');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/html/);
    const html = await res.text();
    expect(html).toContain('declined');
    expect(html).toContain('Brownrigg Ebay Listing Tool');
  });
});
