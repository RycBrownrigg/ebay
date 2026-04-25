import { Hono } from 'hono';
import { createHash } from 'node:crypto';

interface DeletionConfig {
  verificationToken: string;
  endpointUrl: string;
}

function loadConfig(): DeletionConfig | null {
  const verificationToken = process.env['EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN'];
  const endpointUrl = process.env['EBAY_ACCOUNT_DELETION_ENDPOINT_URL'];
  if (!verificationToken || !endpointUrl) return null;
  return { verificationToken, endpointUrl };
}

function computeChallengeResponse(challengeCode: string, config: DeletionConfig): string {
  return createHash('sha256')
    .update(challengeCode)
    .update(config.verificationToken)
    .update(config.endpointUrl)
    .digest('hex');
}

export const ebayAccountDeletionRoute = new Hono();

ebayAccountDeletionRoute.get('/', (c) => {
  const challengeCode = c.req.query('challenge_code');
  if (!challengeCode) {
    return c.json({ error: 'missing challenge_code' }, 400);
  }
  const config = loadConfig();
  if (!config) {
    return c.json({ error: 'service not configured' }, 503);
  }
  const challengeResponse = computeChallengeResponse(challengeCode, config);
  return c.json({ challengeResponse });
});

ebayAccountDeletionRoute.post('/', async (c) => {
  // For M0 there is no user data tied to eBay accounts yet, so we just ACK.
  // M1+ will parse the notification, look up the affected user via
  // ebay_user_id, and purge their data per the privacy contract.
  // ACK-ing with 2xx prevents eBay from retrying indefinitely.
  await c.req.text();
  return c.body(null, 204);
});
