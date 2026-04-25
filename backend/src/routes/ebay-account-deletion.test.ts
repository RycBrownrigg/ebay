import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createApp } from '../app.js';

const TEST_TOKEN = 'test-verification-token-12345678901234567890';
const TEST_URL = 'https://ebay.rycsprojects.com/api/ebay/account-deletion';

describe('eBay account-deletion endpoint', () => {
  beforeEach(() => {
    process.env['EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN'] = TEST_TOKEN;
    process.env['EBAY_ACCOUNT_DELETION_ENDPOINT_URL'] = TEST_URL;
  });

  afterEach(() => {
    delete process.env['EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN'];
    delete process.env['EBAY_ACCOUNT_DELETION_ENDPOINT_URL'];
  });

  describe('GET (challenge verification)', () => {
    it('returns the SHA256(challengeCode + token + url) hex digest', async () => {
      const app = createApp();
      const challengeCode = 'sample-challenge-abc123';
      const res = await app.request(`/api/ebay/account-deletion?challenge_code=${challengeCode}`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { challengeResponse?: string };

      const expected = createHash('sha256')
        .update(challengeCode)
        .update(TEST_TOKEN)
        .update(TEST_URL)
        .digest('hex');

      expect(body.challengeResponse).toBe(expected);
    });

    it('returns 400 when challenge_code query param is missing', async () => {
      const app = createApp();
      const res = await app.request('/api/ebay/account-deletion');
      expect(res.status).toBe(400);
    });

    it('returns 503 when the verification token env var is unset', async () => {
      delete process.env['EBAY_ACCOUNT_DELETION_VERIFICATION_TOKEN'];
      const app = createApp();
      const res = await app.request('/api/ebay/account-deletion?challenge_code=abc');
      expect(res.status).toBe(503);
    });

    it('returns 503 when the endpoint url env var is unset', async () => {
      delete process.env['EBAY_ACCOUNT_DELETION_ENDPOINT_URL'];
      const app = createApp();
      const res = await app.request('/api/ebay/account-deletion?challenge_code=abc');
      expect(res.status).toBe(503);
    });
  });

  describe('POST (notification ACK)', () => {
    it('returns 204 on a well-formed notification body', async () => {
      const app = createApp();
      const res = await app.request('/api/ebay/account-deletion', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          metadata: {
            topic: 'MARKETPLACE_ACCOUNT_DELETION',
            schemaVersion: '1.0',
            deprecated: false,
          },
          notification: {
            notificationId: 'test-notification-1',
            eventDate: '2026-04-25T20:00:00.000Z',
            publishDate: '2026-04-25T20:00:01.000Z',
            publishAttemptCount: 1,
            data: {
              username: 'test_user',
              userId: 'TEST_USER_ID',
              eiasToken: 'test_eias_token',
            },
          },
        }),
      });
      expect(res.status).toBe(204);
    });

    it('returns 204 even on an empty body (we still ACK to stop eBay retries)', async () => {
      const app = createApp();
      const res = await app.request('/api/ebay/account-deletion', {
        method: 'POST',
      });
      expect(res.status).toBe(204);
    });
  });
});
