/**
 * AEAD encryption helpers for sealing the eBay refresh token at rest.
 *
 * Uses XChaCha20-Poly1305 (24-byte nonce, 32-byte key, Poly1305 integrity tag).
 * Storage layout on disk/DB is: nonce(24) || ciphertext+tag. Each call to
 * `sealRefreshToken` generates a fresh random nonce, so identical plaintexts
 * produce different ciphertext while the tag still authenticates the bytes.
 *
 * Exports:
 * - `sealRefreshToken`   — Encrypts a plaintext refresh token and returns the sealed buffer.
 * - `unsealRefreshToken` — Decrypts a sealed buffer and returns the plaintext token.
 */
import { randomBytes } from 'node:crypto';
import { xchacha20poly1305 } from '@noble/ciphers/chacha';

// Sealing utility for the eBay refresh token at rest. AEAD construction:
// XChaCha20-Poly1305 (24-byte nonce, 32-byte key, integrity-protected via
// the Poly1305 tag). Storage layout: nonce(24) || ciphertext+tag.
//
// The key comes from EBAY_REFRESH_TOKEN_SEAL_KEY (32 random bytes,
// base64-encoded). Generate with:
//   openssl rand -base64 32 | tr -d '\n'
// Each seal() generates a fresh random nonce, so re-encrypting the same
// plaintext produces different ciphertext — the tag still authenticates
// the bytes, so any tampering causes decrypt() to throw.

const NONCE_BYTES = 24;
const KEY_BYTES = 32;
const TAG_BYTES = 16;

function loadKey(): Uint8Array {
  const b64 = process.env['EBAY_REFRESH_TOKEN_SEAL_KEY'];
  if (!b64) {
    throw new Error('EBAY_REFRESH_TOKEN_SEAL_KEY must be set');
  }
  const buf = Buffer.from(b64, 'base64');
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `EBAY_REFRESH_TOKEN_SEAL_KEY must decode to ${KEY_BYTES} bytes (got ${buf.length})`,
    );
  }
  return new Uint8Array(buf);
}

/** Encrypts a plaintext refresh token string into a sealed binary buffer. */
export function sealRefreshToken(plaintext: string): Buffer {
  const key = loadKey();
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = xchacha20poly1305(key, new Uint8Array(nonce));
  const ct = cipher.encrypt(new TextEncoder().encode(plaintext));
  return Buffer.concat([nonce, Buffer.from(ct)]);
}

/** Decrypts a sealed buffer and returns the original plaintext refresh token.
 * @throws If the buffer is too short or the Poly1305 tag fails to authenticate.
 */
export function unsealRefreshToken(sealed: Buffer): string {
  if (sealed.length < NONCE_BYTES + TAG_BYTES) {
    throw new Error('sealed value is shorter than nonce + tag');
  }
  const key = loadKey();
  const nonce = sealed.subarray(0, NONCE_BYTES);
  const ct = sealed.subarray(NONCE_BYTES);
  const cipher = xchacha20poly1305(key, new Uint8Array(nonce));
  const pt = cipher.decrypt(new Uint8Array(ct));
  return new TextDecoder().decode(pt);
}
