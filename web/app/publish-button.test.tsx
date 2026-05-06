import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PublishButton } from './publish-button';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const SUCCESS_BODY = {
  ack: 'Success',
  itemId: '110589395525',
  listingUrl: 'https://www.sandbox.ebay.com/itm/110589395525',
  startTime: '2026-05-06T17:37:04.943Z',
  endTime: '2026-06-06T17:37:04.943Z',
  payload: { title: 'M1 test listing 20260506173703 (DO NOT BUY)' },
};

const FAILURE_BODY = {
  ack: 'Failure',
  errors: [
    {
      errorCode: '87',
      severity: 'Error',
      shortMessage: 'Invalid category.',
      longMessage: 'The category selected is not a leaf category.',
    },
  ],
};

const SERVER_ERROR_BODY = {
  error: 'eBay not connected — visit /api/auth/ebay/login to authorize.',
};

describe('PublishButton', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders an idle button initially with no result', () => {
    renderWithClient(<PublishButton />);
    const button = screen.getByTestId('publish-button');
    expect(button).toBeEnabled();
    expect(button).toHaveTextContent('Publish dummy listing');
    expect(screen.queryByTestId('publish-success')).not.toBeInTheDocument();
    expect(screen.queryByTestId('publish-ebay-failure')).not.toBeInTheDocument();
    expect(screen.queryByTestId('publish-server-error')).not.toBeInTheDocument();
  });

  it('shows ItemID and listing URL on a Success response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SUCCESS_BODY,
    });

    renderWithClient(<PublishButton />);
    screen.getByTestId('publish-button').click();

    await waitFor(() => {
      expect(screen.getByTestId('publish-success')).toBeInTheDocument();
    });
    expect(screen.getByText('Listing published')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: SUCCESS_BODY.itemId });
    expect(link).toHaveAttribute('href', SUCCESS_BODY.listingUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders eBay error list on a Failure response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => FAILURE_BODY,
    });

    renderWithClient(<PublishButton />);
    screen.getByTestId('publish-button').click();

    await waitFor(() => {
      expect(screen.getByTestId('publish-ebay-failure')).toBeInTheDocument();
    });
    expect(screen.getByText(/eBay rejected the listing \(Failure\)/)).toBeInTheDocument();
    expect(screen.getByText(/\[87\] Invalid category\./)).toBeInTheDocument();
  });

  it('renders the server error string on a top-level {error} response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => SERVER_ERROR_BODY,
    });

    renderWithClient(<PublishButton />);
    screen.getByTestId('publish-button').click();

    await waitFor(() => {
      expect(screen.getByTestId('publish-server-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('publish-server-error').textContent).toMatch(/eBay not connected/);
  });

  it('renders a network-level error if fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('NetworkError when attempting to fetch resource.'),
    );

    renderWithClient(<PublishButton />);
    screen.getByTestId('publish-button').click();

    await waitFor(() => {
      expect(screen.getByTestId('publish-network-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('publish-network-error').textContent).toMatch(/NetworkError/);
  });
});
