import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { ebayAuth } from '../db/schema.js';
import { unsealRefreshToken } from '../crypto/seal.js';
import { loadOAuthConfig, refreshAccessToken } from './oauth.js';

// Refresh ~60s before expiry so an in-flight Trading API call doesn't
// sail over the boundary mid-request.
const REFRESH_BUFFER_MS = 60_000;

// Returns a valid eBay access token for the given app user. Mints a new
// one from the sealed refresh token if the cached value is missing or
// near expiry. Persists the new cache value back to the row.
//
// Used by the M1.3+ Trading API client. Throws if the user has not
// completed the OAuth flow yet (no ebay_auth row).
export async function getEbayAccessToken(userId: string): Promise<string> {
  const row = await db
    .select()
    .from(ebayAuth)
    .where(eq(ebayAuth.userId, userId))
    .then((r) => r[0]);

  if (!row) {
    throw new Error(`user ${userId} has not connected eBay (no ebay_auth row)`);
  }

  const now = Date.now();
  const expiresAt = row.accessTokenExpiresAt?.getTime() ?? 0;
  if (row.accessTokenCache && expiresAt > now + REFRESH_BUFFER_MS) {
    return row.accessTokenCache;
  }

  const config = loadOAuthConfig();
  const refreshToken = unsealRefreshToken(row.refreshTokenSealed);
  const fresh = await refreshAccessToken(config, refreshToken);

  await db
    .update(ebayAuth)
    .set({
      accessTokenCache: fresh.access_token,
      accessTokenExpiresAt: new Date(now + fresh.expires_in * 1000),
      updatedAt: new Date(),
    })
    .where(eq(ebayAuth.userId, userId));

  return fresh.access_token;
}
