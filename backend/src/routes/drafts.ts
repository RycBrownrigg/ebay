/**
 * Listing draft CRUD routes.
 *
 * Exposes create, list, update, and delete operations for listing drafts.
 * Drafts are deliberately permissive — no payload validation at save time;
 * validation happens at publish. All operations are scoped to the household
 * user via getOrCreateHouseholdUser.
 *
 * Routes:
 * - GET    /    — List all drafts for the household user, newest-edited first.
 * - POST   /    — Create a new draft with an arbitrary JSON payload.
 * - PATCH  /:id — Replace the payload of an existing draft; 404 if not found.
 * - DELETE /:id — Remove a draft; 404 if not found.
 */
import { Hono } from 'hono';
import { getOrCreateHouseholdUser } from '../db/household.js';
import { createDraft, deleteDraft, listDraftsForUser, updateDraft } from '../db/drafts-repo.js';

export const draftsRoute = new Hono();

// GET /api/drafts — list all drafts for the household user, newest-edited first.
draftsRoute.get('/', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const drafts = await listDraftsForUser(user.id);
  return c.json({ drafts });
});

// POST /api/drafts — create a new draft. Body is an arbitrary JSON payload
// (no validation; drafts are work-in-progress). Returns the inserted row.
draftsRoute.post('/', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const payload = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const draft = await createDraft(user.id, payload);
  return c.json({ draft }, 201);
});

// PATCH /api/drafts/:id — replace the payload of an existing draft.
// 404 if the draft doesn't exist or doesn't belong to this user.
draftsRoute.patch('/:id', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const id = c.req.param('id');
  const payload = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (payload === null) {
    return c.json({ error: 'request body is required' }, 400);
  }
  const draft = await updateDraft(user.id, id, payload);
  if (!draft) {
    return c.json({ error: 'draft not found' }, 404);
  }
  return c.json({ draft });
});

// DELETE /api/drafts/:id — remove a draft. Used by the publish flow on
// success (so the published draft disappears from the list) and by the
// "Delete" button in the drafts UI.
draftsRoute.delete('/:id', async (c) => {
  const user = await getOrCreateHouseholdUser();
  const id = c.req.param('id');
  const removed = await deleteDraft(user.id, id);
  if (!removed) {
    return c.json({ error: 'draft not found' }, 404);
  }
  return c.body(null, 204);
});
