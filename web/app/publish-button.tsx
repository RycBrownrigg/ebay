'use client';

import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';

const ParsedErrorSchema = z.object({
  errorCode: z.string(),
  severity: z.string(),
  shortMessage: z.string(),
  longMessage: z.string().optional(),
});

const SuccessResponseSchema = z.object({
  ack: z.union([z.literal('Success'), z.literal('Warning')]),
  itemId: z.string(),
  listingUrl: z.string().url(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  warnings: z.array(ParsedErrorSchema).optional(),
  payload: z.object({ title: z.string() }),
});

const FailureResponseSchema = z.object({
  ack: z.union([z.literal('Failure'), z.literal('PartialFailure')]),
  errors: z.array(ParsedErrorSchema),
});

const ErrorResponseSchema = z.object({
  error: z.string(),
});

const PublishResponseSchema = z.union([
  SuccessResponseSchema,
  FailureResponseSchema,
  ErrorResponseSchema,
]);

type PublishResponse = z.infer<typeof PublishResponseSchema>;

async function publishListing(): Promise<PublishResponse> {
  const res = await fetch('/api/listings/publish', { method: 'POST' });
  const json: unknown = await res.json();
  const parsed = PublishResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`unexpected response shape: ${parsed.error.message}`);
  }
  return parsed.data;
}

function isSuccess(r: PublishResponse): r is z.infer<typeof SuccessResponseSchema> {
  return 'ack' in r && (r.ack === 'Success' || r.ack === 'Warning');
}

function isFailure(r: PublishResponse): r is z.infer<typeof FailureResponseSchema> {
  return 'ack' in r && (r.ack === 'Failure' || r.ack === 'PartialFailure');
}

export function PublishButton() {
  const mutation = useMutation({ mutationFn: publishListing });

  return (
    <div>
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-400"
        data-testid="publish-button"
      >
        {mutation.isPending ? 'Publishing…' : 'Publish dummy listing'}
      </button>

      {mutation.isError && (
        <p role="alert" className="mt-3 text-sm text-red-700" data-testid="publish-network-error">
          Network error: {mutation.error.message}
        </p>
      )}

      {mutation.data && isSuccess(mutation.data) && (
        <dl
          role="status"
          className="mt-3 rounded border border-green-200 bg-green-50 p-3 text-sm"
          data-testid="publish-success"
        >
          <dt className="font-medium text-green-900">Listing published</dt>
          <dd className="mt-1 text-green-900">
            ItemID:{' '}
            <a
              href={mutation.data.listingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {mutation.data.itemId}
            </a>
          </dd>
          <dd className="mt-1 text-green-900">Title: {mutation.data.payload.title}</dd>
          {mutation.data.warnings && mutation.data.warnings.length > 0 && (
            <dd className="mt-2 text-yellow-900">
              <span className="font-medium">Warnings:</span>
              <ul className="mt-1 list-disc pl-5">
                {mutation.data.warnings.map((w) => (
                  <li key={w.errorCode}>
                    [{w.errorCode}] {w.shortMessage}
                  </li>
                ))}
              </ul>
            </dd>
          )}
        </dl>
      )}

      {mutation.data && isFailure(mutation.data) && (
        <div
          role="alert"
          className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="publish-ebay-failure"
        >
          <p className="font-medium">eBay rejected the listing ({mutation.data.ack}):</p>
          <ul className="mt-1 list-disc pl-5">
            {mutation.data.errors.map((e) => (
              <li key={e.errorCode}>
                [{e.errorCode}] {e.shortMessage}
                {e.longMessage ? ` — ${e.longMessage}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {mutation.data && 'error' in mutation.data && (
        <p
          role="alert"
          className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="publish-server-error"
        >
          {mutation.data.error}
        </p>
      )}
    </div>
  );
}
