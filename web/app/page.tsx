/**
 * Application home page (server component).
 *
 * Renders the top-level layout: a backend health card and the full listings
 * workflow (drafts list, image uploader, listing form). All interactive
 * elements are delegated to client components.
 *
 * Exports:
 * - `HomePage` — Default-exported server component that composes the page layout.
 */
import { HealthCard } from './health-card';
import { ListingsPage } from './listings-page';

/** Root page layout: health status section and the full listing-management workflow. */
export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">eBay Seller</h1>
      <p className="mt-2 text-sm text-neutral-600">M2 — listing form with drafts.</p>

      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Backend health</h2>
        <HealthCard />
      </section>

      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium text-neutral-700">Publish a listing</h2>
        <p className="mt-1 mb-3 text-xs text-neutral-500">
          Save in-progress listings as drafts, return to edit them later, then publish to eBay
          sandbox via <code>/api/listings/publish</code>. Form values validate against the shared
          <code> ListingDraftSchema</code> on both the client and the server.
        </p>
        <ListingsPage />
      </section>
    </main>
  );
}
