import { z } from 'zod';

// Pure HTTP/URL operations against eBay's OAuth endpoints. No DB imports
// here — keeps the module testable without spinning up Postgres. The
// caching layer that decides "is the access token still valid?" lives
// in access-token.ts, which DOES touch the DB.

export type EbayEnv = 'sandbox' | 'production';

interface EbayOAuthEndpoints {
  authorize: string;
  token: string;
  apiBase: string;
}

const ENDPOINTS: Record<EbayEnv, EbayOAuthEndpoints> = {
  sandbox: {
    authorize: 'https://auth.sandbox.ebay.com/oauth2/authorize',
    token: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
    apiBase: 'https://api.sandbox.ebay.com',
  },
  production: {
    authorize: 'https://auth.ebay.com/oauth2/authorize',
    token: 'https://api.ebay.com/identity/v1/oauth2/token',
    apiBase: 'https://api.ebay.com',
  },
};

// Scopes are full URLs and identical between sandbox and production —
// they're identifiers, not endpoints.
//
// M1 minimum: just enough to publish a fixed-price listing via Trading
// API. Each additional scope is opt-in per app from eBay's side; the
// initial OAuth attempt failed with `error=invalid_scope` when we
// requested commerce.identity.readonly (known to require manual
// per-app approval) plus buy.browse and commerce.taxonomy.readonly
// (not auto-granted on new apps). Re-add those as later milestones
// need them, after granting the corresponding scopes in the eBay
// developer console (Application Keys → OAuth Scopes).
export const SCOPES = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment',
  'https://api.ebay.com/oauth/api_scope/sell.marketing',
] as const;

export interface EbayOAuthConfig {
  env: EbayEnv;
  appId: string;
  certId: string;
  ruName: string;
  endpoints: EbayOAuthEndpoints;
}

export function loadOAuthConfig(): EbayOAuthConfig {
  const envRaw = process.env['EBAY_ENV'] ?? 'sandbox';
  if (envRaw !== 'sandbox' && envRaw !== 'production') {
    throw new Error(`EBAY_ENV must be 'sandbox' or 'production' (got '${envRaw}')`);
  }
  const env: EbayEnv = envRaw;

  const appId = process.env['EBAY_APP_ID'];
  const certId = process.env['EBAY_CERT_ID'];
  const ruName =
    env === 'sandbox' ? process.env['EBAY_RUNAME_SANDBOX'] : process.env['EBAY_RUNAME_PRODUCTION'];

  const missing: string[] = [];
  if (!appId) missing.push('EBAY_APP_ID');
  if (!certId) missing.push('EBAY_CERT_ID');
  if (!ruName) missing.push(`EBAY_RUNAME_${env.toUpperCase()}`);
  if (missing.length > 0) {
    throw new Error(`eBay OAuth config incomplete — missing: ${missing.join(', ')}`);
  }

  return {
    env,
    appId: appId!,
    certId: certId!,
    ruName: ruName!,
    endpoints: ENDPOINTS[env],
  };
}

export function buildConsentUrl(config: EbayOAuthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.appId,
    response_type: 'code',
    // eBay quirk: redirect_uri is the RuName, not the actual URL.
    // The accepted/declined URLs are looked up server-side by RuName.
    redirect_uri: config.ruName,
    scope: SCOPES.join(' '),
    state,
  });
  return `${config.endpoints.authorize}?${params}`;
}

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  // refresh_token is returned only on the initial code-for-tokens
  // exchange, not on subsequent refresh-for-access exchanges.
  refresh_token: z.string().optional(),
  refresh_token_expires_in: z.number().optional(),
  token_type: z.string(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

function basicAuthHeader(config: EbayOAuthConfig): string {
  const creds = Buffer.from(`${config.appId}:${config.certId}`).toString('base64');
  return `Basic ${creds}`;
}

async function postToken(config: EbayOAuthConfig, body: URLSearchParams): Promise<TokenResponse> {
  const res = await fetch(config.endpoints.token, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuthHeader(config),
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token endpoint failed: HTTP ${res.status} ${text}`);
  }
  const json: unknown = await res.json();
  return TokenResponseSchema.parse(json);
}

export async function exchangeCodeForTokens(
  config: EbayOAuthConfig,
  code: string,
): Promise<TokenResponse> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.ruName,
    }),
  );
}

export async function refreshAccessToken(
  config: EbayOAuthConfig,
  refreshToken: string,
): Promise<TokenResponse> {
  return postToken(
    config,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES.join(' '),
    }),
  );
}

const UserInfoSchema = z.object({
  userId: z.string(),
  username: z.string().optional(),
});

export type EbayUserInfo = z.infer<typeof UserInfoSchema>;

// Looks up the eBay-side user id for the holder of an access token via
// commerce.identity.readonly. We pin this to ebay_auth.ebay_user_id so
// account-deletion notifications can be scoped to the right row.
export async function fetchEbayUserInfo(
  config: EbayOAuthConfig,
  accessToken: string,
): Promise<EbayUserInfo> {
  const res = await fetch(`${config.endpoints.apiBase}/commerce/identity/v1/user/`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay user info failed: HTTP ${res.status} ${text}`);
  }
  const json: unknown = await res.json();
  return UserInfoSchema.parse(json);
}
