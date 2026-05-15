import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ListingForm } from './listing-form';

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const SUCCESS_BODY = {
  ack: 'Success',
  itemId: '110589395541',
  listingUrl: 'https://www.sandbox.ebay.com/itm/110589395541',
  payload: { title: 'From form' },
};

const FAILURE_BODY = {
  ack: 'Failure',
  errors: [
    {
      errorCode: '87',
      severity: 'Error',
      shortMessage: 'Invalid category.',
    },
  ],
};

const SERVER_ERROR_BODY = {
  error: 'eBay not connected — visit /api/auth/ebay/login to authorize.',
};

describe('ListingForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the form with defaults pre-populated', () => {
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Test listing — do not buy');
    expect(screen.getByLabelText('Category ID')).toHaveValue('88433');
    expect(screen.getByLabelText('Price (USD)')).toHaveValue(9.99);
    expect(screen.getByLabelText('Quantity')).toHaveValue(1);
    expect(screen.getByLabelText('ZIP')).toHaveValue('95125');
    expect(screen.getByLabelText('Shipping cost (USD)')).toHaveValue(5);
    expect(screen.getByTestId('publish-button')).toBeEnabled();
  });

  it('submits a valid form and shows the success panel with ItemID + link', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => SUCCESS_BODY,
    });
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByTestId('publish-success')).toBeInTheDocument();
    });

    const link = screen.getByRole('link', { name: SUCCESS_BODY.itemId });
    expect(link).toHaveAttribute('href', SUCCESS_BODY.listingUrl);

    // Confirm the submitted body matches the defaults.
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/listings/publish',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.title).toBe('Test listing — do not buy');
    expect(body.startPrice).toEqual({ value: 9.99, currency: 'USD' });
    expect(body.returnAcceptedDays).toBe(30);
    expect(body.shippingService).toBe('USPSPriority');
  });

  it('shows a field error when title is cleared and submit is attempted', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByText('title is required')).toBeInTheDocument();
    });
    // fetch should not have been called
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('shows a field error when ZIP is malformed', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    const zip = screen.getByLabelText('ZIP');
    await user.clear(zip);
    await user.type(zip, '951');
    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByText(/5 or 9 digit US ZIP/)).toBeInTheDocument();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('renders the eBay failure panel on Ack=Failure response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => FAILURE_BODY,
    });
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByTestId('publish-ebay-failure')).toBeInTheDocument();
    });
    expect(screen.getByText(/\[87\] Invalid category\./)).toBeInTheDocument();
  });

  it('renders the server-error panel on a top-level {error} response', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => SERVER_ERROR_BODY,
    });
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByTestId('publish-server-error')).toBeInTheDocument();
    });
    expect(screen.getByTestId('publish-server-error').textContent).toMatch(/eBay not connected/);
  });

  it('renders a network-level error when fetch throws', async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('NetworkError when attempting to fetch resource.'),
    );
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    await user.click(screen.getByTestId('publish-button'));

    await waitFor(() => {
      expect(screen.getByTestId('publish-network-error')).toBeInTheDocument();
    });
  });

  // Coverage gap acknowledged: a unit test for "user clicks 60 radio → body
  // has number 60" would catch the radio-valueAsNumber regression that the
  // 2026-05-11 deploy hit, but jsdom + RTL + RHF don't reliably propagate
  // radio change events the way a real browser does. We caught it via
  // manual smoke test instead. If we revisit, the working pattern is
  // likely Playwright or a real-browser e2e harness.

  it('resets the form when "Reset to defaults" is clicked', async () => {
    const user = userEvent.setup();
    renderWithClient(
      <ListingForm activeDraft={null} onDraftSaved={() => {}} onClearActiveDraft={() => {}} />,
    );

    const title = screen.getByLabelText('Title');
    await user.clear(title);
    await user.type(title, 'Edited title');
    expect(title).toHaveValue('Edited title');

    await user.click(screen.getByText('Reset to defaults'));
    expect(screen.getByLabelText('Title')).toHaveValue('Test listing — do not buy');
  });
});
