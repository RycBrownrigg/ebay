/**
 * Draft image CRUD operations.
 *
 * Thin query layer over the draft_images table. Keeping DB calls here makes
 * route handlers testable via vi.mock without wrangling Drizzle's chained
 * query builder.
 *
 * Exports:
 * - `listImagesForDraft`    — Returns all images for a draft in sort order.
 * - `insertImage`           — Inserts a new image record and returns it.
 * - `deleteImageRecord`     — Deletes an image row and returns its storagePath, or null if not found.
 * - `updateImageSortOrder`  — Updates the sort order of an image; returns the updated row or null.
 */
import { and, asc, eq } from 'drizzle-orm';
import { db } from './client.js';
import { draftImages, type DraftImage } from './schema.js';

/** Returns all images attached to a draft, ordered by ascending sort order. */
export async function listImagesForDraft(draftId: string): Promise<DraftImage[]> {
  return db
    .select()
    .from(draftImages)
    .where(eq(draftImages.draftId, draftId))
    .orderBy(asc(draftImages.sortOrder));
}

/** Inserts a new image record and returns the created row. */
export async function insertImage(data: {
  draftId: string;
  storagePath: string;
  mimeType: string;
  sortOrder: number;
}): Promise<DraftImage> {
  const [row] = await db.insert(draftImages).values(data).returning();
  if (!row) throw new Error('insert returned no row');
  return row;
}

/** Deletes an image record and returns its storagePath, or null if the record wasn't found. */
export async function deleteImageRecord(
  draftId: string,
  imageId: string,
): Promise<{ storagePath: string } | null> {
  const rows = await db
    .delete(draftImages)
    .where(and(eq(draftImages.id, imageId), eq(draftImages.draftId, draftId)))
    .returning({ storagePath: draftImages.storagePath });
  return rows[0] ?? null;
}

/** Updates the sort order of an image; returns the updated row, or null if not found. */
export async function updateImageSortOrder(
  draftId: string,
  imageId: string,
  sortOrder: number,
): Promise<DraftImage | null> {
  const [row] = await db
    .update(draftImages)
    .set({ sortOrder })
    .where(and(eq(draftImages.id, imageId), eq(draftImages.draftId, draftId)))
    .returning();
  return row ?? null;
}
