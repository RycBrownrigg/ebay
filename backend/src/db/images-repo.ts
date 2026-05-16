import { and, asc, eq } from 'drizzle-orm';
import { db } from './client.js';
import { draftImages, type DraftImage } from './schema.js';

export async function listImagesForDraft(draftId: string): Promise<DraftImage[]> {
  return db
    .select()
    .from(draftImages)
    .where(eq(draftImages.draftId, draftId))
    .orderBy(asc(draftImages.sortOrder));
}

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
