import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db/household.js', () => ({
  getOrCreateHouseholdUser: vi.fn(),
}));
vi.mock('../db/drafts-repo.js', () => ({
  getDraftById: vi.fn(),
  // stub unused exports so other routes that import drafts-repo don't break
  listDraftsForUser: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));
vi.mock('../db/images-repo.js', () => ({
  listImagesForDraft: vi.fn(),
  insertImage: vi.fn(),
  deleteImageRecord: vi.fn(),
  updateImageSortOrder: vi.fn(),
}));
vi.mock('sharp', () => ({
  default: vi.fn().mockReturnValue({
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    removeMetadata: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('processed')),
  }),
}));
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

import { getOrCreateHouseholdUser } from '../db/household.js';
import { getDraftById } from '../db/drafts-repo.js';
import {
  deleteImageRecord,
  insertImage,
  listImagesForDraft,
  updateImageSortOrder,
} from '../db/images-repo.js';
import { createApp } from '../app.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const DRAFT_ID = '11111111-1111-1111-1111-111111111111';
const IMAGE_ID = '22222222-2222-2222-2222-222222222222';

const SAMPLE_DRAFT = {
  id: DRAFT_ID,
  userId: USER_ID,
  payload: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const SAMPLE_IMAGE = {
  id: IMAGE_ID,
  draftId: DRAFT_ID,
  storagePath: `${DRAFT_ID}/${IMAGE_ID}.jpg`,
  epsUrl: null,
  mimeType: 'image/jpeg',
  sortOrder: 0,
  createdAt: new Date(),
};

describe('draft images routes', () => {
  beforeEach(() => {
    vi.mocked(getOrCreateHouseholdUser).mockResolvedValue({
      id: USER_ID,
      email: 'household@local',
      passwordHash: null,
      createdAt: new Date(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/drafts/:id/images', () => {
    it('returns images for a draft in sort order', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(listImagesForDraft).mockResolvedValue([SAMPLE_IMAGE]);
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { images: { id: string; url: string }[] };
      expect(body.images).toHaveLength(1);
      expect(body.images[0]!.id).toBe(IMAGE_ID);
      expect(body.images[0]!.url).toContain(SAMPLE_IMAGE.storagePath);
    });

    it('returns 404 when draft does not belong to user', async () => {
      vi.mocked(getDraftById).mockResolvedValue(null);
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/drafts/:id/images', () => {
    it('processes an uploaded image and returns 201', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(listImagesForDraft).mockResolvedValue([]);
      vi.mocked(insertImage).mockResolvedValue(SAMPLE_IMAGE);

      const form = new FormData();
      form.append('image', new File([new Uint8Array(100)], 'photo.jpg', { type: 'image/jpeg' }));

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { image: { id: string } };
      expect(body.image.id).toBe(IMAGE_ID);
      expect(vi.mocked(insertImage)).toHaveBeenCalledWith(
        expect.objectContaining({ draftId: DRAFT_ID, mimeType: 'image/jpeg', sortOrder: 0 }),
      );
    });

    it('returns 422 when draft already has 12 images', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(listImagesForDraft).mockResolvedValue(Array(12).fill(SAMPLE_IMAGE));

      const form = new FormData();
      form.append('image', new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' }));

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(422);
    });

    it('returns 415 for an unsupported file type', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(listImagesForDraft).mockResolvedValue([]);

      const form = new FormData();
      form.append('image', new File(['data'], 'doc.pdf', { type: 'application/pdf' }));

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(415);
    });

    it('returns 400 when the image field is missing', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(listImagesForDraft).mockResolvedValue([]);

      const form = new FormData();
      form.append('other', 'value');

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when draft not found', async () => {
      vi.mocked(getDraftById).mockResolvedValue(null);

      const form = new FormData();
      form.append('image', new File([new Uint8Array(10)], 'x.jpg', { type: 'image/jpeg' }));

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images`, {
        method: 'POST',
        body: form,
      });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/drafts/:id/images/:imageId', () => {
    it('deletes image record and file, returns 204', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(deleteImageRecord).mockResolvedValue({
        storagePath: SAMPLE_IMAGE.storagePath,
      });

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(204);
      expect(vi.mocked(deleteImageRecord)).toHaveBeenCalledWith(DRAFT_ID, IMAGE_ID);
    });

    it('returns 404 when image not found', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(deleteImageRecord).mockResolvedValue(null);

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'DELETE',
      });
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/drafts/:id/images/:imageId', () => {
    it('updates sort order and returns the image', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(updateImageSortOrder).mockResolvedValue({ ...SAMPLE_IMAGE, sortOrder: 2 });

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sortOrder: 2 }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { image: { sortOrder: number } };
      expect(body.image.sortOrder).toBe(2);
      expect(vi.mocked(updateImageSortOrder)).toHaveBeenCalledWith(DRAFT_ID, IMAGE_ID, 2);
    });

    it('returns 400 when sortOrder is missing', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ other: 'field' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 when sortOrder is negative', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sortOrder: -1 }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when image not found', async () => {
      vi.mocked(getDraftById).mockResolvedValue(SAMPLE_DRAFT);
      vi.mocked(updateImageSortOrder).mockResolvedValue(null);

      const res = await createApp().request(`/api/drafts/${DRAFT_ID}/images/${IMAGE_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sortOrder: 1 }),
      });
      expect(res.status).toBe(404);
    });
  });
});
