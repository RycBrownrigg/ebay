'use client';

/**
 * Top-level listings workflow client component.
 *
 * Holds the active-draft state and threads it between the drafts list, the
 * image uploader, and the listing form. Acts as the glue layer so its children
 * remain stateless with respect to which draft is loaded.
 *
 * Exports:
 * - `ListingsPage` — Composes DraftsPanel, ImageUploader, and ListingForm with shared draft state.
 */
import { useCallback, useState } from 'react';
import { DraftsPanel, type DraftRecord } from './drafts-panel';
import { ImageUploader } from './image-uploader';
import { ListingForm } from './listing-form';

// Glue Client Component. Holds the "which draft is currently loaded
// into the form" state and threads it between the drafts list, the
// image uploader, and the form. Lives here rather than inside any
// child so they don't have to know about each other.

/** Composes the drafts panel, image uploader, and listing form with shared active-draft state. */
export function ListingsPage() {
  const [activeDraft, setActiveDraft] = useState<DraftRecord | null>(null);
  const [draftImageUrls, setDraftImageUrls] = useState<string[]>([]);

  // Stable reference — setDraftImageUrls is a React state setter and
  // never changes identity, so useCallback with an empty dep array is safe.
  const handleImagesChange = useCallback((urls: string[]) => {
    setDraftImageUrls(urls);
  }, []);

  return (
    <>
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Saved drafts
        </h3>
        <DraftsPanel
          activeDraftId={activeDraft?.id ?? null}
          onSelectDraft={setActiveDraft}
          onDraftDeleted={(id) => {
            if (activeDraft?.id === id) {
              setActiveDraft(null);
            }
          }}
        />
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
          Photos
        </h3>
        <ImageUploader
          draftId={activeDraft?.id ?? null}
          onImagesChange={handleImagesChange}
        />
      </div>

      <ListingForm
        activeDraft={activeDraft}
        pictureUrls={draftImageUrls}
        onDraftSaved={setActiveDraft}
        onClearActiveDraft={() => setActiveDraft(null)}
      />
    </>
  );
}
