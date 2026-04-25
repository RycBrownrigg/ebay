import { HealthCard } from './health-card';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">eBay Seller</h1>
      <p className="mt-2 text-sm text-neutral-600">M0 skeleton — backend health probe.</p>
      <section className="mt-6 rounded border border-neutral-200 bg-white p-4">
        <HealthCard />
      </section>
    </main>
  );
}
