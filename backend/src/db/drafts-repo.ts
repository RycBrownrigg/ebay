/**
 * Listing-draft CRUD operations.
 *
 * Thin Drizzle query layer over the listing_drafts table. Keeping DB calls
 * here (rather than inline in the route handlers) makes routes trivially
 * testable via vi.mock without wrangling Drizzle's chained query builder.
 * All operations are scoped to a userId to prevent cross-user access.
 *
 * Exports:
 * - `listDraftsForUser` — Returns all drafts for a user, newest-edited first.
 * - `createDraft`       — Inserts a new draft row and returns it.
 * - `updateDraft`       — Replaces a draft's payload; returns null if not found.
 * - `deleteDraft`       — Removes a draft; returns true if a row was deleted.
 * - `getDraftById`      — Fetches a single draft by id; returns null if not found.
 */
import { and, desc, eq } from 'drizzle-orm';
import type { ListingDraft } from '@ebay/shared';
import { db } from './client.js';
import { listingDrafts, type ListingDraftRecord } from './schema.js';

// Thin Drizzle-call layer for listing_drafts. Keeping queries here
// (rather than inline in routes/drafts.ts) makes the route shape
// trivially mockable in tests via vi.mock of this module, without
// having to mock Drizzle's chained query builder.

/** Returns all drafts for the given user, ordered by most recently updated. */
export async function listDraftsForUser(userId: string): Promise<ListingDraftRecord[]> {
  return db
    .select()
    .from(listingDrafts)
    .where(eq(listingDrafts.userId, userId))
    .orderBy(desc(listingDrafts.updatedAt));
}

/** Inserts a new draft for the given user and returns the created row. */
export async function createDraft(
  userId: string,
  payload: Partial<ListingDraft>,
): Promise<ListingDraftRecord> {
  const [row] = await db.insert(listingDrafts).values({ userId, payload }).returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

/** Replaces a draft's payload and bumps updatedAt; returns null if the draft doesn't exist or belong to the user. */
export async function updateDraft(
  userId: string,
  id: string,
  payload: Partial<ListingDraft>,
): Promise<ListingDraftRecord | null> {
  const [row] = await db
    .update(listingDrafts)
    .set({ payload, updatedAt: new Date() })
    .where(and(eq(listingDrafts.id, id), eq(listingDrafts.userId, userId)))
    .returning();
  return row ?? null;
}

/** Deletes a draft; returns true if a row was removed, false if not found. */
export async function deleteDraft(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(listingDrafts)
    .where(and(eq(listingDrafts.id, id), eq(listingDrafts.userId, userId)))
    .returning({ id: listingDrafts.id });
  return rows.length > 0;
}

/** Fetches a single draft by id scoped to the user; returns null if not found. */
export async function getDraftById(
  userId: string,
  id: string,
): Promise<ListingDraftRecord | null> {
  const [row] = await db
    .select()
    .from(listingDrafts)
    .where(and(eq(listingDrafts.id, id), eq(listingDrafts.userId, userId)));
  return row ?? null;
}
