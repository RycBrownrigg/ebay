import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HealthCard } from './health-card';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe('HealthCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders status fields when the API returns a valid HealthResponse', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'ok',
        service: 'ebay-api',
        version: '0.0.0',
        uptimeSeconds: 12.34,
        timestamp: '2026-04-24T20:00:00.000Z',
      }),
    });

    renderWithClient(<HealthCard />);

    await waitFor(() => {
      expect(screen.getByText('ok')).toBeInTheDocument();
    });
    expect(screen.getByText('ebay-api')).toBeInTheDocument();
    expect(screen.getByText('0.0.0')).toBeInTheDocument();
  });

  it('shows an error state when the API returns a malformed body', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'definitely not ok' }),
    });

    renderWithClient(<HealthCard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/health response invalid/);
  });

  it('shows an error state when the API is unreachable', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    renderWithClient(<HealthCard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/HTTP 503/);
  });
});
