import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ImageUploader } from './image-uploader';

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('ImageUploader', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows save-as-draft prompt when draftId is null', () => {
    render(<ImageUploader draftId={null} onImagesChange={vi.fn()} />, { wrapper: Wrapper });
    expect(screen.getByText(/save as draft first/i)).toBeInTheDocument();
  });

  it('renders the file input when a draft id is provided', () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ images: [] }),
    });
    render(<ImageUploader draftId="some-draft-id" onImagesChange={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(screen.getByTestId('image-file-input')).toBeInTheDocument();
  });

  it('calls onImagesChange with empty array when draftId is null', () => {
    const onImagesChange = vi.fn();
    render(<ImageUploader draftId={null} onImagesChange={onImagesChange} />, {
      wrapper: Wrapper,
    });
    expect(onImagesChange).toHaveBeenCalledWith([]);
  });
});
