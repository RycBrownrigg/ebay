'use client';

import { useState } from 'react';
import { DraftsPanel, type DraftRecord } from './drafts-panel';
import { ListingForm } from './listing-form';

// Glue Client Component. Holds the "which draft is currently loaded
// into the form" state and threads it between the drafts list and
// the form. Lives here rather than inside either child so they don't
// have to know about each other.

export function ListingsPage() {
  const [activeDraft, setActiveDraft] = useState<DraftRecord | null>(null);

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
            // If the deleted draft was the active one, clear it so the
            // form's next save creates a new draft rather than 404-ing
            // a PATCH to the gone id.
            if (activeDraft?.id === id) {
              setActiveDraft(null);
            }
          }}
        />
      </div>

      <ListingForm
        activeDraft={activeDraft}
        onDraftSaved={setActiveDraft}
        onAfterPublish={() => setActiveDraft(null)}
      />
    </>
  );
}
