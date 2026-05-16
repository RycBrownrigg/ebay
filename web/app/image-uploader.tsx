'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

interface ImageRecord {
  id: string;
  draftId: string;
  storagePath: string;
  epsUrl: string | null;
  mimeType: string;
  sortOrder: number;
  url: string;
  createdAt: string;
}

interface ImageUploaderProps {
  draftId: string | null;
  onImagesChange: (urls: string[]) => void;
}

async function fetchImages(draftId: string): Promise<ImageRecord[]> {
  const res = await fetch(`/api/drafts/${draftId}/images`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { images: ImageRecord[] };
  return data.images;
}

async function uploadImage(draftId: string, file: File): Promise<ImageRecord> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`/api/drafts/${draftId}/images`, { method: 'POST', body: form });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  const data = (await res.json()) as { image: ImageRecord };
  return data.image;
}

async function deleteImage(draftId: string, imageId: string): Promise<void> {
  const res = await fetch(`/api/drafts/${draftId}/images/${imageId}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
}

async function swapImages(
  draftId: string,
  a: ImageRecord,
  b: ImageRecord,
): Promise<void> {
  await fetch(`/api/drafts/${draftId}/images/${a.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sortOrder: b.sortOrder }),
  });
  await fetch(`/api/drafts/${draftId}/images/${b.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sortOrder: a.sortOrder }),
  });
}

export function ImageUploader({ draftId, onImagesChange }: ImageUploaderProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryKey = ['draft-images', draftId];

  const { data: images = [] } = useQuery({
    queryKey,
    queryFn: () => fetchImages(draftId!),
    enabled: draftId !== null,
  });

  // Keep parent's pictureUrls in sync whenever the image list changes.
  useEffect(() => {
    onImagesChange(images.map((img) => img.url));
  }, [images, onImagesChange]);

  // When draft is cleared, report empty urls to parent.
  useEffect(() => {
    if (draftId === null) onImagesChange([]);
  }, [draftId, onImagesChange]);

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadImage(draftId!, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: string) => deleteImage(draftId!, imageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const swapMutation = useMutation({
    mutationFn: ({ a, b }: { a: ImageRecord; b: ImageRecord }) => swapImages(draftId!, a, b),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      const uploadSequentially = async () => {
        for (const file of files) {
          await uploadMutation.mutateAsync(file);
        }
      };
      uploadSequentially().catch(() => {});
      e.target.value = '';
    },
    [uploadMutation],
  );

  const move = (index: number, direction: 'left' | 'right') => {
    const swapIndex = direction === 'left' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= images.length) return;
    swapMutation.mutate({ a: images[index]!, b: images[swapIndex]! });
  };

  const isBusy =
    uploadMutation.isPending || deleteMutation.isPending || swapMutation.isPending;

  if (draftId === null) {
    return <p className="text-sm text-neutral-500">Save as draft first to add photos.</p>;
  }

  return (
    <div className="space-y-3">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="flex flex-col items-center gap-1">
              <img
                src={img.url}
                alt={`Photo ${i + 1}`}
                className="h-20 w-20 rounded border border-neutral-200 object-cover"
              />
              <div className="flex gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, 'left')}
                  disabled={i === 0 || isBusy}
                  className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-25"
                  aria-label="Move left"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(img.id)}
                  disabled={isBusy}
                  className="rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-25"
                  aria-label="Delete photo"
                >
                  ✕
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 'right')}
                  disabled={i === images.length - 1 || isBusy}
                  className="rounded px-1.5 py-0.5 text-xs text-neutral-500 hover:bg-neutral-100 disabled:opacity-25"
                  aria-label="Move right"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length < 12 && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            className="hidden"
            onChange={handleFileChange}
            data-testid="image-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isBusy}
            className="rounded border border-dashed border-neutral-300 px-4 py-2 text-sm text-neutral-600 hover:border-neutral-400 hover:bg-neutral-50 disabled:opacity-50"
          >
            {uploadMutation.isPending ? 'Uploading…' : '+ Add photos'}
          </button>
        </>
      )}

      {uploadMutation.isError && (
        <p className="text-xs text-red-600" role="alert" data-testid="upload-error">
          Upload failed: {uploadMutation.error.message}
        </p>
      )}
    </div>
  );
}
