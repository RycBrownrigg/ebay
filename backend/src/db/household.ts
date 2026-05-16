/**
 * Household user bootstrap helper.
 *
 * M1 single-user stub used until a real household login flow exists. Every
 * backend operation that needs "the current user" calls this, which returns
 * the single seeded row or creates it on first call. The eventual auth flow
 * will replace this with a real session lookup.
 *
 * Exports:
 * - `getOrCreateHouseholdUser` — Returns the household user row, creating it if absent.
 */
import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { users, type User } from './schema.js';

// M1 single-user stub. The eventual household auth flow (login form +
// session cookies) will replace this with a real session lookup. Until
// then, every backend operation that needs "the household user" calls
// this — it returns the single seeded row, creating it on first call.

const HOUSEHOLD_EMAIL = 'household@local';

/** Returns the single household user row, inserting it on first call. */
export async function getOrCreateHouseholdUser(): Promise<User> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, HOUSEHOLD_EMAIL))
    .then((r) => r[0]);
  if (existing) return existing;

  const created = await db
    .insert(users)
    .values({ email: HOUSEHOLD_EMAIL })
    .returning()
    .then((r) => r[0]);
  if (!created) {
    throw new Error('failed to create household user');
  }
  return created;
}
