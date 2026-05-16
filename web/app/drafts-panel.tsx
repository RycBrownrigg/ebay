'use client';

/**
 * Saved listing drafts list panel.
 *
 * Fetches the drafts list from GET /api/drafts, renders each draft as a
 * selectable row, and provides a delete button per row. Highlights the
 * currently active draft and notifies the parent on selection or deletion.
 *
 * Exports:
 * - `DraftsPanel`  — Scrollable list of saved drafts with select and delete controls.
 * - `DraftRecord`  — TypeScript shape of a draft row returned by the API.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ListingDraft } from '@ebay/shared';

export interface DraftRecord {
  id: string;
  userId: string;
  payload: Partial<ListingDraft>;
  createdAt: string;
  updatedAt: string;
}

async function fetchDrafts(): Promise<DraftRecord[]> {
  const res = await fetch('/api/drafts');
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} listing drafts`);
  }
  const json = (await res.json()) as { drafts: DraftRecord[] };
  return json.drafts;
}

async function deleteDraftById(id: string): Promise<void> {
  const res = await fetch(`/api/drafts/${id}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) {
    throw new Error(`HTTP ${res.status} deleting draft`);
  }
}

interface DraftsPanelProps {
  activeDraftId: string | null;
  onSelectDraft: (draft: DraftRecord) => void;
  onDraftDeleted: (id: string) => void;
}

/** Renders the list of saved drafts with select and delete controls. */
export function DraftsPanel({ activeDraftId, onSelectDraft, onDraftDeleted }: DraftsPanelProps) {
  const queryClient = useQueryClient();
  const draftsQuery = useQuery({
    queryKey: ['drafts'],
    queryFn: fetchDrafts,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDraftById,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] });
      onDraftDeleted(id);
    },
  });

  if (draftsQuery.isPending) {
    return <p className="text-sm text-neutral-500">Loading drafts…</p>;
  }

  if (draftsQuery.isError) {
    return (
      <p role="alert" className="text-sm text-red-700">
        Failed to load drafts: {draftsQuery.error.message}
      </p>
    );
  }

  const drafts = draftsQuery.data;
  if (drafts.length === 0) {
    return <p className="text-sm text-neutral-500">No saved drafts yet.</p>;
  }

  return (
    <ul
      className="divide-y divide-neutral-200 rounded border border-neutral-200"
      data-testid="drafts-list"
    >
      {drafts.map((draft) => {
        const isActive = draft.id === activeDraftId;
        const title = draft.payload.title || '(untitled draft)';
        return (
          <li
            key={draft.id}
            className={`flex items-center gap-3 px-3 py-2 text-sm ${isActive ? 'bg-blue-50' : ''}`}
            data-testid={`draft-${draft.id}`}
          >
            <button
              type="button"
              onClick={() => onSelectDraft(draft)}
              className="flex-1 text-left underline-offset-2 hover:underline"
            >
              <span className="font-medium">{title}</span>
              <span className="ml-2 text-xs text-neutral-500">
                edited {new Date(draft.updatedAt).toLocaleString()}
              </span>
              {isActive && (
                <span className="ml-2 rounded bg-blue-200 px-1.5 py-0.5 text-xs text-blue-900">
                  loaded
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(draft.id)}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-600 underline disabled:opacity-50"
              data-testid={`delete-draft-${draft.id}`}
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
