'use client';

import { useQuery } from '@tanstack/react-query';
import { HealthResponseSchema, type HealthResponse } from '@ebay/shared';

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`health check failed: HTTP ${res.status}`);
  }
  const json: unknown = await res.json();
  const parsed = HealthResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`health response invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

export function HealthCard() {
  const { data, error, isPending } = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
  });

  if (isPending) {
    return <p data-testid="health-status">checking…</p>;
  }
  if (error) {
    return (
      <p data-testid="health-status" role="alert">
        backend unreachable: {error.message}
      </p>
    );
  }
  return (
    <dl data-testid="health-status">
      <dt>status</dt>
      <dd>{data.status}</dd>
      <dt>service</dt>
      <dd>{data.service}</dd>
      <dt>version</dt>
      <dd>{data.version}</dd>
      <dt>uptime</dt>
      <dd>{data.uptimeSeconds.toFixed(2)}s</dd>
    </dl>
  );
}
