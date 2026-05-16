import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Hono } from 'hono';
import sharp from 'sharp';
import { getDraftById } from '../db/drafts-repo.js';
import { getOrCreateHouseholdUser } from '../db/household.js';
import {
  deleteImageRecord,
  insertImage,
  listImagesForDraft,
  updateImageSortOrder,
} from '../db/images-repo.js';
import type { DraftImage } from '../db/schema.js';

const IMAGES_DIR = process.env['IMAGES_DIR'] ?? '/images';
const IMAGES_BASE_URL = process.env['IMAGES_BASE_URL'] ?? '';
const MAX_IMAGES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function imageUrl(storagePath: string): string {
  return `${IMAGES_BASE_URL}/images/${storagePath}`;
}

function withUrl(img: DraftImage): DraftImage & { url: string } {
  return { ...img, url: imageUrl(img.storagePath) };
}

export const draftImagesRoute = new Hono();

// GET /api/drafts/:id/images — list images for a draft in sort order.
draftImagesRoute.get('/:id/images', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const draftId = c.req.param('id');
  const draft = await getDraftById(user.id, draftId);
  if (!draft) return c.json({ error: 'draft not found' }, 404);
  const images = await listImagesForDraft(draftId);
  return c.json({ images: images.map(withUrl) });
});

// POST /api/drafts/:id/images — upload one image (multipart field name: "image").
// Resizes to ≤1600px long edge, strips EXIF, outputs JPEG. Returns the new row.
draftImagesRoute.post('/:id/images', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const draftId = c.req.param('id');
  const draft = await getDraftById(user.id, draftId);
  if (!draft) return c.json({ error: 'draft not found' }, 404);

  const existing = await listImagesForDraft(draftId);
  if (existing.length >= MAX_IMAGES) {
    return c.json({ error: `maximum ${MAX_IMAGES} images per draft` }, 422);
  }

  const body = (await c.req.parseBody().catch(() => ({}))) as Record<string, unknown>;
  const file = body['image'];
  if (!(file instanceof File)) {
    return c.json({ error: 'image field is required' }, 400);
  }
  if (file.size > MAX_FILE_BYTES) {
    return c.json({ error: 'image exceeds 10 MB limit' }, 413);
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return c.json({ error: 'unsupported image type; use JPEG, PNG, WEBP, or GIF' }, 415);
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  // sharp strips all metadata by default (no .withMetadata() = no EXIF preserved).
  const processed = await sharp(inputBuffer)
    .rotate()
    .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();

  const imageId = randomUUID();
  const storagePath = `${draftId}/${imageId}.jpg`;
  const absDir = path.join(IMAGES_DIR, draftId);
  const absPath = path.join(IMAGES_DIR, storagePath);

  await mkdir(absDir, { recursive: true });
  await writeFile(absPath, processed);

  const image = await insertImage({
    draftId,
    storagePath,
    mimeType: 'image/jpeg',
    sortOrder: existing.length,
  });

  return c.json({ image: withUrl(image) }, 201);
});

// DELETE /api/drafts/:id/images/:imageId — remove an image. Deletes the file
// best-effort (if already missing on disk, the DB row is still removed).
draftImagesRoute.delete('/:id/images/:imageId', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const draftId = c.req.param('id');
  const imageId = c.req.param('imageId');
  const draft = await getDraftById(user.id, draftId);
  if (!draft) return c.json({ error: 'draft not found' }, 404);

  const deleted = await deleteImageRecord(draftId, imageId);
  if (!deleted) return c.json({ error: 'image not found' }, 404);

  await unlink(path.join(IMAGES_DIR, deleted.storagePath)).catch(() => {});

  return c.body(null, 204);
});

// PATCH /api/drafts/:id/images/:imageId — update sort order. Body: { sortOrder: number }.
// Used by the web UI's up/down buttons to reorder thumbnails.
draftImagesRoute.patch('/:id/images/:imageId', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const draftId = c.req.param('id');
  const imageId = c.req.param('imageId');
  const draft = await getDraftById(user.id, draftId);
  if (!draft) return c.json({ error: 'draft not found' }, 404);

  const body = (await c.req.json().catch(() => null)) as { sortOrder?: unknown } | null;
  if (
    !body ||
    typeof body.sortOrder !== 'number' ||
    !Number.isInteger(body.sortOrder) ||
    body.sortOrder < 0
  ) {
    return c.json({ error: 'sortOrder (non-negative integer) is required' }, 400);
  }

  const image = await updateImageSortOrder(draftId, imageId, body.sortOrder);
  if (!image) return c.json({ error: 'image not found' }, 404);

  return c.json({ image: withUrl(image) });
});
