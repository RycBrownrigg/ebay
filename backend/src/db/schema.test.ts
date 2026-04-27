import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { ebayAuth, users } from './schema.js';

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
