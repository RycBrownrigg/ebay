import { randomBytes } from 'node:crypto';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sealRefreshToken } from '../crypto/seal.js';
import { db } from '../db/client.js';
import { getOrCreateHouseholdUser } from '../db/household.js';
import { ebayAuth } from '../db/schema.js';
import {
  buildConsentUrl,
  exchangeCodeForTokens,
  fetchEbayUserInfo,
  loadOAuthConfig,
} from '../ebay/oauth.js';

export const authEbayRoute = new Hono();

const STATE_COOKIE = 'ebay_oauth_state';
const STATE_MAX_AGE_SECONDS = 600; // 10 minutes — covers the longest reasonable consent flow

// GET /api/auth/ebay/login
//
// Generates a CSRF state token, stores it in an HttpOnly cookie, and
// redirects to eBay's consent page. eBay echoes the state back via the
// callback; we verify it there to prevent CSRF.
authEbayRoute.get('/login', (c) => {
  let config;
  try {
    config = loadOAuthConfig();
  } catch (e) {
    return c.json({ error: (e as Error).message }, 503);
  }
  const state = randomBytes(16).toString('hex');
  setCookie(c, STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: STATE_MAX_AGE_SECONDS,
  });
  return c.redirect(buildConsentUrl(config, state));
});

// GET /api/auth/ebay/callback
//
// eBay redirects here after the user consents. Verifies the state cookie
// matches the returned state, exchanges the auth code for tokens, looks
// up the eBay-side user id, and seals + stores the refresh token in
// ebay_auth (upserting on user_id so re-connecting overwrites cleanly).
authEbayRoute.get('/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');
  if (!code || !state) {
    return c.json({ error: 'missing code or state' }, 400);
  }

  const cookieState = getCookie(c, STATE_COOKIE);
  if (state !== cookieState) {
    return c.json({ error: 'state mismatch' }, 400);
  }

  let config;
  try {
    config = loadOAuthConfig();
  } catch (e) {
    return c.json({ error: (e as Error).message }, 503);
  }

  try {
    const tokens = await exchangeCodeForTokens(config, code);
    if (!tokens.refresh_token) {
      return c.json({ error: 'eBay did not return a refresh_token' }, 502);
    }

    const userInfo = await fetchEbayUserInfo(config, tokens.access_token);
    const householdUser = await getOrCreateHouseholdUser();
    const sealed = sealRefreshToken(tokens.refresh_token);
    const now = Date.now();
    const expiresAt = new Date(now + tokens.expires_in * 1000);

    await db
      .insert(ebayAuth)
      .values({
        userId: householdUser.id,
        refreshTokenSealed: sealed,
        accessTokenCache: tokens.access_token,
        accessTokenExpiresAt: expiresAt,
        ebayUserId: userInfo.userId,
      })
      .onConflictDoUpdate({
        target: ebayAuth.userId,
        set: {
          refreshTokenSealed: sealed,
          accessTokenCache: tokens.access_token,
          accessTokenExpiresAt: expiresAt,
          ebayUserId: userInfo.userId,
          updatedAt: new Date(),
        },
      });

    deleteCookie(c, STATE_COOKIE, { path: '/' });
    return c.redirect('/?ebay=connected');
  } catch (e) {
    return c.json({ error: (e as Error).message }, 502);
  }
});

// GET /api/auth/ebay/declined
//
// Landing page if the user clicks "Decline" on eBay's consent screen.
// No data was sent to us by eBay; we just acknowledge and offer a way
// back to the home page.
authEbayRoute.get('/declined', (c) => {
  deleteCookie(c, STATE_COOKIE, { path: '/' });
  return c.html(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>eBay sign-in declined</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; max-width: 40rem; margin: 4rem auto; padding: 0 1.5rem; color: #111; }
    h1 { font-size: 1.5rem; }
    a { color: #0a58ca; }
  </style>
</head>
<body>
  <h1>eBay sign-in declined</h1>
  <p>You declined to grant Brownrigg Ebay Listing Tool access to your eBay account. No data was stored.</p>
  <p><a href="/">Back to home</a></p>
</body>
</html>`,
  );
});
