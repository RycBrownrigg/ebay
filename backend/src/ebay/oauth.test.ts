import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildConsentUrl,
  exchangeCodeForTokens,
  loadOAuthConfig,
  refreshAccessToken,
  SCOPES,
  fetchEbayUserInfo,
} from './oauth.js';

const ENV_KEYS = [
  'EBAY_ENV',
  'EBAY_APP_ID',
  'EBAY_CERT_ID',
  'EBAY_RUNAME_SANDBOX',
  'EBAY_RUNAME_PRODUCTION',
] as const;

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const k of ENV_KEYS) {
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined) process.env[k] = v;
  }
}

const VALID_ENV = {
  EBAY_ENV: 'sandbox',
  EBAY_APP_ID: 'RycBrown-myApp-SBX-184c0e5fe-74b030a2',
  EBAY_CERT_ID: 'SBX-CERT-secret',
  EBAY_RUNAME_SANDBOX: 'Ryc_Brownrigg-RycBrown-myApp--kwxqr',
} as const;

describe('loadOAuthConfig', () => {
  afterEach(() => setEnv({}));

  it('returns sandbox endpoints when EBAY_ENV=sandbox', () => {
    setEnv(VALID_ENV);
    const c = loadOAuthConfig();
    expect(c.env).toBe('sandbox');
    expect(c.endpoints.authorize).toContain('auth.sandbox.ebay.com');
    expect(c.endpoints.token).toContain('api.sandbox.ebay.com');
    expect(c.endpoints.apiBase).toBe('https://api.sandbox.ebay.com');
  });

  it('returns production endpoints when EBAY_ENV=production', () => {
    setEnv({
      EBAY_ENV: 'production',
      EBAY_APP_ID: 'app-prod',
      EBAY_CERT_ID: 'cert-prod',
      EBAY_RUNAME_PRODUCTION: 'runame-prod',
    });
    const c = loadOAuthConfig();
    expect(c.env).toBe('production');
    expect(c.endpoints.authorize).toBe('https://auth.ebay.com/oauth2/authorize');
    expect(c.endpoints.token).toBe('https://api.ebay.com/identity/v1/oauth2/token');
  });

  it('defaults to sandbox when EBAY_ENV is unset', () => {
    setEnv({ ...VALID_ENV, EBAY_ENV: undefined });
    const c = loadOAuthConfig();
    expect(c.env).toBe('sandbox');
  });

  it('rejects an invalid EBAY_ENV value', () => {
    setEnv({ ...VALID_ENV, EBAY_ENV: 'staging' });
    expect(() => loadOAuthConfig()).toThrow(/EBAY_ENV/);
  });

  it('throws when EBAY_APP_ID is missing', () => {
    setEnv({ ...VALID_ENV, EBAY_APP_ID: undefined });
    expect(() => loadOAuthConfig()).toThrow(/EBAY_APP_ID/);
  });

  it('throws when the env-specific RuName is missing', () => {
    setEnv({ ...VALID_ENV, EBAY_RUNAME_SANDBOX: undefined });
    expect(() => loadOAuthConfig()).toThrow(/EBAY_RUNAME_SANDBOX/);
  });
});

describe('buildConsentUrl', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => setEnv({}));

  it('points at the sandbox authorize endpoint', () => {
    const url = buildConsentUrl(loadOAuthConfig(), 'state123');
    expect(url.startsWith('https://auth.sandbox.ebay.com/oauth2/authorize?')).toBe(true);
  });

  it('includes client_id, response_type, redirect_uri (RuName), scope, state', () => {
    const url = new URL(buildConsentUrl(loadOAuthConfig(), 'mystate'));
    expect(url.searchParams.get('client_id')).toBe(VALID_ENV.EBAY_APP_ID);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('redirect_uri')).toBe(VALID_ENV.EBAY_RUNAME_SANDBOX);
    expect(url.searchParams.get('state')).toBe('mystate');
    const scopes = url.searchParams.get('scope')?.split(' ') ?? [];
    for (const s of SCOPES) expect(scopes).toContain(s);
  });
});

describe('exchangeCodeForTokens', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => {
    setEnv({});
    vi.unstubAllGlobals();
  });

  it('parses a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'AT',
          expires_in: 7200,
          refresh_token: 'RT',
          refresh_token_expires_in: 47304000,
          token_type: 'User Access Token',
        }),
      }),
    );
    const tokens = await exchangeCodeForTokens(loadOAuthConfig(), 'code123');
    expect(tokens.access_token).toBe('AT');
    expect(tokens.refresh_token).toBe('RT');
    expect(tokens.expires_in).toBe(7200);
  });

  it('throws on non-2xx with the eBay body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      }),
    );
    await expect(exchangeCodeForTokens(loadOAuthConfig(), 'bad')).rejects.toThrow(/HTTP 400/);
  });

  it('sends Basic auth derived from APP_ID:CERT_ID and form-encoded body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'x', expires_in: 1, token_type: 'User Access Token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await exchangeCodeForTokens(loadOAuthConfig(), 'thecode');
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const expectedBasic = Buffer.from(
      `${VALID_ENV.EBAY_APP_ID}:${VALID_ENV.EBAY_CERT_ID}`,
    ).toString('base64');
    expect(init.headers.Authorization).toBe(`Basic ${expectedBasic}`);
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('thecode');
    expect(body.get('redirect_uri')).toBe(VALID_ENV.EBAY_RUNAME_SANDBOX);
  });
});

describe('refreshAccessToken', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => {
    setEnv({});
    vi.unstubAllGlobals();
  });

  it('parses a refresh response (refresh_token may be omitted)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'NEW_AT',
          expires_in: 7200,
          token_type: 'User Access Token',
        }),
      }),
    );
    const tokens = await refreshAccessToken(loadOAuthConfig(), 'old-refresh');
    expect(tokens.access_token).toBe('NEW_AT');
    expect(tokens.refresh_token).toBeUndefined();
  });

  it('sends grant_type=refresh_token plus the scope list', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'x', expires_in: 1, token_type: 'User Access Token' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await refreshAccessToken(loadOAuthConfig(), 'rt');
    const [, init] = fetchMock.mock.calls[0]!;
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('rt');
    expect(body.get('scope')?.split(' ')).toEqual(expect.arrayContaining([...SCOPES]));
  });
});

describe('fetchEbayUserInfo', () => {
  beforeEach(() => setEnv(VALID_ENV));
  afterEach(() => {
    setEnv({});
    vi.unstubAllGlobals();
  });

  it('GETs the identity endpoint with Bearer auth and parses userId', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ userId: 'TestUser_123', username: 'testuser_123' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const info = await fetchEbayUserInfo(loadOAuthConfig(), 'access-token-xyz');
    expect(info.userId).toBe('TestUser_123');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.sandbox.ebay.com/commerce/identity/v1/user/');
    expect(init.headers.Authorization).toBe('Bearer access-token-xyz');
  });

  it('throws on non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' }),
    );
    await expect(fetchEbayUserInfo(loadOAuthConfig(), 'bad')).rejects.toThrow(/HTTP 401/);
  });
});
