import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the household-user helper and the drafts repo. The repo layer
// exists specifically so route tests don't have to wrangle Drizzle's
// chained builder — we just stub the four repo functions and assert
// the route wired them correctly.
vi.mock('../db/household.js', () => ({
  getOrCreateHouseholdUser: vi.fn(),
}));
vi.mock('../db/drafts-repo.js', () => ({
  listDraftsForUser: vi.fn(),
  createDraft: vi.fn(),
  updateDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

import { getOrCreateHouseholdUser } from '../db/household.js';
import { createDraft, deleteDraft, listDraftsForUser, updateDraft } from '../db/drafts-repo.js';
import { createApp } from '../app.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const DRAFT_ID = '11111111-1111-1111-1111-111111111111';

const SAMPLE_DRAFT = {
  id: DRAFT_ID,
  userId: USER_ID,
  payload: { title: 'Half-finished listing' },
  createdAt: new Date('2026-05-11T12:00:00Z'),
  updatedAt: new Date('2026-05-11T12:00:00Z'),
};

describe('drafts route', () => {
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

  describe('GET /api/drafts', () => {
    it("returns the household user's drafts in updated-desc order", async () => {
      vi.mocked(listDraftsForUser).mockResolvedValue([SAMPLE_DRAFT]);
      const res = await createApp().request('/api/drafts');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { drafts: unknown[] };
      expect(body.drafts).toHaveLength(1);
      expect(vi.mocked(listDraftsForUser)).toHaveBeenCalledWith(USER_ID);
    });

    it('returns an empty array when no drafts exist', async () => {
      vi.mocked(listDraftsForUser).mockResolvedValue([]);
      const res = await createApp().request('/api/drafts');
      expect(res.status).toBe(200);
      const body = (await res.json()) as { drafts: unknown[] };
      expect(body.drafts).toEqual([]);
    });
  });

  describe('POST /api/drafts', () => {
    it('creates a draft with the given payload and returns 201 with the row', async () => {
      vi.mocked(createDraft).mockResolvedValue(SAMPLE_DRAFT);
      const res = await createApp().request('/api/drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Half-finished listing' }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { draft: { id: string } };
      expect(body.draft.id).toBe(DRAFT_ID);
      expect(vi.mocked(createDraft)).toHaveBeenCalledWith(USER_ID, {
        title: 'Half-finished listing',
      });
    });

    it('accepts an empty body and creates a blank draft', async () => {
      vi.mocked(createDraft).mockResolvedValue(SAMPLE_DRAFT);
      const res = await createApp().request('/api/drafts', { method: 'POST' });
      expect(res.status).toBe(201);
      expect(vi.mocked(createDraft)).toHaveBeenCalledWith(USER_ID, {});
    });
  });

  describe('PATCH /api/drafts/:id', () => {
    it('updates an existing draft and returns the new row', async () => {
      vi.mocked(updateDraft).mockResolvedValue({
        ...SAMPLE_DRAFT,
        payload: { title: 'Updated title' },
      });
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Updated title' }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { draft: { payload: { title: string } } };
      expect(body.draft.payload.title).toBe('Updated title');
      expect(vi.mocked(updateDraft)).toHaveBeenCalledWith(USER_ID, DRAFT_ID, {
        title: 'Updated title',
      });
    });

    it('returns 404 when the draft does not exist or belongs to someone else', async () => {
      vi.mocked(updateDraft).mockResolvedValue(null);
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'whatever' }),
      });
      expect(res.status).toBe(404);
    });

    it('returns 400 when no body is provided', async () => {
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}`, { method: 'PATCH' });
      expect(res.status).toBe(400);
      expect(vi.mocked(updateDraft)).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/drafts/:id', () => {
    it('deletes an existing draft and returns 204', async () => {
      vi.mocked(deleteDraft).mockResolvedValue(true);
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}`, { method: 'DELETE' });
      expect(res.status).toBe(204);
      expect(vi.mocked(deleteDraft)).toHaveBeenCalledWith(USER_ID, DRAFT_ID);
    });

    it('returns 404 when the draft does not exist or belongs to someone else', async () => {
      vi.mocked(deleteDraft).mockResolvedValue(false);
      const res = await createApp().request(`/api/drafts/${DRAFT_ID}`, { method: 'DELETE' });
      expect(res.status).toBe(404);
    });
  });
});
