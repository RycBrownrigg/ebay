import { customType, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Postgres bytea (binary) column — used for libsodium-sealed values
// where the raw ciphertext is binary, not base64/hex. Drizzle ships
// no first-class bytea helper, so we declare a customType.
const bytea = customType<{ data: Buffer; notNull: true }>({
  dataType() {
    return 'bytea';
  },
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  // Nullable in M1 (no household auth UI yet). Will become NOT NULL once
  // the login flow lands; until then the single household user has no
  // local password and authenticates via session cookie alone.
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const ebayAuth = pgTable('ebay_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique() // one eBay account per app user
    .references(() => users.id, { onDelete: 'cascade' }),
  // libsodium-sealed eBay refresh token. Plaintext never touches disk
  // or logs. Sealed/unsealed by the OAuth handler in M1.2 with a key
  // from EBAY_REFRESH_TOKEN_SEAL_KEY.
  refreshTokenSealed: bytea('refresh_token_sealed').notNull(),
  // Cached access token + its expiry. We mint a new access token from
  // the refresh token whenever this one is missing or within ~60s of
  // expiry. Stored in plaintext because eBay access tokens are short-
  // lived (~2 hours) and encrypting them adds little value vs the
  // refresh token.
  accessTokenCache: text('access_token_cache'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
  // eBay's seller user id (e.g. sandbox testuser_xyz). Sourced from
  // the OAuth callback's id_token / userinfo and pinned here so we
  // can scope account-deletion notifications to the right row.
  ebayUserId: text('ebay_user_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type EbayAuth = typeof ebayAuth.$inferSelect;
export type NewEbayAuth = typeof ebayAuth.$inferInsert;
