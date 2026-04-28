import { loadOAuthConfig } from '../oauth.js';

// Trading API HTTP client. Targets the legacy Trading endpoint
// (.../ws/api.dll) since BUILD_PLAN.md §6.5 chose Trading for v1
// (single code path that supports auctions and fixed-price).
//
// Auth via the modern X-EBAY-API-IAF-TOKEN header (OAuth user access
// token). The historic AppID/DevID/CertID headers are NOT required when
// using IAF-TOKEN — eBay derives the app context from the token itself.

const COMPATIBILITY_LEVEL = '1227';
const SITE_ID_US = '0';

export interface TradingCallOptions {
  callName: string;
  accessToken: string;
  body: string; // already-built XML
}

export async function callTradingApi(opts: TradingCallOptions): Promise<string> {
  const config = loadOAuthConfig();
  const url = `${config.endpoints.apiBase}/ws/api.dll`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'X-EBAY-API-CALL-NAME': opts.callName,
      'X-EBAY-API-COMPATIBILITY-LEVEL': COMPATIBILITY_LEVEL,
      'X-EBAY-API-SITEID': SITE_ID_US,
      'X-EBAY-API-IAF-TOKEN': opts.accessToken,
    },
    body: opts.body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trading API ${opts.callName} HTTP ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.text();
}
