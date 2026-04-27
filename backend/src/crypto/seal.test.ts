import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sealRefreshToken, unsealRefreshToken } from './seal.js';

const TEST_KEY_B64 = Buffer.from(new Uint8Array(32).fill(7)).toString('base64');
const OTHER_KEY_B64 = Buffer.from(new Uint8Array(32).fill(8)).toString('base64');

describe('sealRefreshToken / unsealRefreshToken', () => {
  beforeEach(() => {
    process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'] = TEST_KEY_B64;
  });

  afterEach(() => {
    delete process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'];
  });

  it('roundtrips a plaintext token', () => {
    const plaintext = 'eBay-OAuth-RefreshToken-abc123/xyz+__+';
    const sealed = sealRefreshToken(plaintext);
    expect(unsealRefreshToken(sealed)).toBe(plaintext);
  });

  it('produces different ciphertext on each call (random nonce)', () => {
    const a = sealRefreshToken('same-plaintext');
    const b = sealRefreshToken('same-plaintext');
    expect(a.equals(b)).toBe(false);
  });

  it('rejects a sealed value shorter than nonce + tag', () => {
    expect(() => unsealRefreshToken(Buffer.alloc(20))).toThrow(/shorter/);
  });

  it('rejects tampered ciphertext (auth tag check)', () => {
    const sealed = sealRefreshToken('a token');
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 0x01;
    expect(() => unsealRefreshToken(sealed)).toThrow();
  });

  it('rejects when decrypted with the wrong key', () => {
    const sealed = sealRefreshToken('original');
    process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'] = OTHER_KEY_B64;
    expect(() => unsealRefreshToken(sealed)).toThrow();
  });

  it('throws when EBAY_REFRESH_TOKEN_SEAL_KEY is unset', () => {
    delete process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'];
    expect(() => sealRefreshToken('x')).toThrow(/EBAY_REFRESH_TOKEN_SEAL_KEY/);
  });

  it('throws when the key is not exactly 32 bytes', () => {
    process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'] = Buffer.from('short').toString('base64');
    expect(() => sealRefreshToken('x')).toThrow(/32 bytes/);
  });
});
