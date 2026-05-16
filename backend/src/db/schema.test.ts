import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { draftImages, ebayAuth, listingDrafts, users } from './schema.js';

// Schema-shape tests — exercise the table definitions without needing a
// live Postgres. Real DB integration tests land in M1.2 alongside the
// OAuth handlers (Testcontainers per TEST_PLAN.md §3, gated on local
// Docker being available).

describe('users table', () => {
  it('has the expected columns', () => {
    const config = getTableConfig(users);
    const names = config.columns.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['id', 'email', 'password_hash', 'created_at']));
  });

  it('email is NOT NULL and UNIQUE', () => {
    const config = getTableConfig(users);
    const email = config.columns.find((c) => c.name === 'email');
    expect(email).toBeDefined();
    expect(email?.notNull).toBe(true);
    expect(email?.isUnique).toBe(true);
  });

  it('id is the primary key', () => {
    const config = getTableConfig(users);
    const id = config.columns.find((c) => c.name === 'id');
    expect(id?.primary).toBe(true);
  });
});

describe('ebay_auth table', () => {
  it('has the expected columns', () => {
    const config = getTableConfig(ebayAuth);
    const names = config.columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'user_id',
        'refresh_token_sealed',
        'access_token_cache',
        'access_token_expires_at',
        'ebay_user_id',
        'created_at',
        'updated_at',
      ]),
    );
  });

  it('refresh_token_sealed is NOT NULL', () => {
    const config = getTableConfig(ebayAuth);
    const col = config.columns.find((c) => c.name === 'refresh_token_sealed');
    expect(col?.notNull).toBe(true);
  });

  it('user_id is unique (one eBay account per user)', () => {
    const config = getTableConfig(ebayAuth);
    const col = config.columns.find((c) => c.name === 'user_id');
    expect(col?.isUnique).toBe(true);
  });

  it('user_id has a foreign key reference to users with cascade delete', () => {
    const config = getTableConfig(ebayAuth);
    expect(config.foreignKeys.length).toBeGreaterThan(0);
    const fk = config.foreignKeys[0]!;
    expect(fk.onDelete).toBe('cascade');
  });
});

describe('listing_drafts table', () => {
  it('has the expected columns', () => {
    const config = getTableConfig(listingDrafts);
    const names = config.columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining(['id', 'user_id', 'payload', 'created_at', 'updated_at']),
    );
  });

  it('payload is NOT NULL', () => {
    const config = getTableConfig(listingDrafts);
    const col = config.columns.find((c) => c.name === 'payload');
    expect(col?.notNull).toBe(true);
  });

  it('user_id has a foreign key reference to users with cascade delete', () => {
    const config = getTableConfig(listingDrafts);
    expect(config.foreignKeys.length).toBeGreaterThan(0);
    const fk = config.foreignKeys[0]!;
    expect(fk.onDelete).toBe('cascade');
  });
});

describe('draft_images table', () => {
  it('has the expected columns', () => {
    const config = getTableConfig(draftImages);
    const names = config.columns.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'id',
        'draft_id',
        'storage_path',
        'eps_url',
        'mime_type',
        'sort_order',
        'created_at',
      ]),
    );
  });

  it('storage_path and mime_type are NOT NULL', () => {
    const config = getTableConfig(draftImages);
    const storagePath = config.columns.find((c) => c.name === 'storage_path');
    const mimeType = config.columns.find((c) => c.name === 'mime_type');
    expect(storagePath?.notNull).toBe(true);
    expect(mimeType?.notNull).toBe(true);
  });

  it('eps_url is nullable', () => {
    const config = getTableConfig(draftImages);
    const epsUrl = config.columns.find((c) => c.name === 'eps_url');
    expect(epsUrl?.notNull).toBeFalsy();
  });

  it('draft_id has a foreign key reference to listing_drafts with cascade delete', () => {
    const config = getTableConfig(draftImages);
    expect(config.foreignKeys.length).toBeGreaterThan(0);
    const fk = config.foreignKeys[0]!;
    expect(fk.onDelete).toBe('cascade');
  });
});
