import { and, desc, eq } from 'drizzle-orm';
import type { ListingDraft } from '@ebay/shared';
import { db } from './client.js';
import { listingDrafts, type ListingDraftRecord } from './schema.js';

// Thin Drizzle-call layer for listing_drafts. Keeping queries here
// (rather than inline in routes/drafts.ts) makes the route shape
// trivially mockable in tests via vi.mock of this module, without
// having to mock Drizzle's chained query builder.

export async function listDraftsForUser(userId: string): Promise<ListingDraftRecord[]> {
  return db
    .select()
    .from(listingDrafts)
    .where(eq(listingDrafts.userId, userId))
    .orderBy(desc(listingDrafts.updatedAt));
}

export async function createDraft(
  userId: string,
  payload: Partial<ListingDraft>,
): Promise<ListingDraftRecord> {
  const [row] = await db.insert(listingDrafts).values({ userId, payload }).returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

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

export async function deleteDraft(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(listingDrafts)
    .where(and(eq(listingDrafts.id, id), eq(listingDrafts.userId, userId)))
    .returning({ id: listingDrafts.id });
  return rows.length > 0;
}

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
