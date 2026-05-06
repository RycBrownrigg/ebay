import { HealthCard } from './health-card';
import { PublishButton } from './publish-button';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">eBay Seller</h1>
      <p className="mt-2 text-sm text-neutral-600">M1 — OAuth + Trading API de-risk.</p>

      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-neutral-700">Backend health</h2>
        <HealthCard />
      </section>

      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <h2 className="text-sm font-medium text-neutral-700">Publish a test listing</h2>
        <p className="mt-1 mb-3 text-xs text-neutral-500">
          Posts a hardcoded $9.99 dummy listing to eBay sandbox via{' '}
          <code>/api/listings/publish</code>.
        </p>
        <PublishButton />
      </section>
    </main>
  );
}
