import { eq } from 'drizzle-orm';
import { db } from './client.js';
import { users, type User } from './schema.js';

// M1 single-user stub. The eventual household auth flow (login form +
// session cookies) will replace this with a real session lookup. Until
// then, every backend operation that needs "the household user" calls
// this — it returns the single seeded row, creating it on first call.

const HOUSEHOLD_EMAIL = 'household@local';

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
