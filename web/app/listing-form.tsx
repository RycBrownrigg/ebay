'use client';

import { useMutation } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { ListingDraftSchema, type ListingDraft } from '@ebay/shared';
import { z } from 'zod';

// Response shape from POST /api/listings/publish. Same three-arm
// discriminated union the M1 PublishButton consumed; we revalidate
// here at the boundary so unexpected server changes throw loudly.

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
  issues: z
    .array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() }))
    .optional(),
});

const PublishResponseSchema = z.union([
  SuccessResponseSchema,
  FailureResponseSchema,
  ErrorResponseSchema,
]);

type PublishResponse = z.infer<typeof PublishResponseSchema>;
type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
type FailureResponse = z.infer<typeof FailureResponseSchema>;
type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

function isSuccess(r: PublishResponse): r is SuccessResponse {
  return 'ack' in r && (r.ack === 'Success' || r.ack === 'Warning');
}
function isFailure(r: PublishResponse): r is FailureResponse {
  return 'ack' in r && (r.ack === 'Failure' || r.ack === 'PartialFailure');
}
function isError(r: PublishResponse): r is ErrorResponse {
  return 'error' in r;
}

async function publishListing(draft: ListingDraft): Promise<PublishResponse> {
  const res = await fetch('/api/listings/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  const json: unknown = await res.json();
  const parsed = PublishResponseSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error(`unexpected response shape: ${parsed.error.message}`);
  }
  return parsed.data;
}

// Default values — mirror M1's hardcoded payload so the form starts
// in a known-good state. Click "Publish" without changing anything to
// reproduce M1 behavior; edit fields to customise.
const DEFAULT_VALUES: ListingDraft = {
  title: 'Test listing — do not buy',
  description:
    'Auto-generated test listing from the Brownrigg Ebay Listing Tool. This is not a real product.',
  categoryId: '88433',
  conditionId: 1000,
  startPrice: { value: 9.99, currency: 'USD' },
  postalCode: '95125',
  quantity: 1,
  shippingService: 'USPSPriority',
  shippingCost: { value: 5, currency: 'USD' },
  returnAcceptedDays: 30,
};

const CONDITION_OPTIONS: { value: number; label: string }[] = [
  { value: 1000, label: 'New' },
  { value: 1500, label: 'New Other' },
  { value: 2750, label: 'Like New / Open Box' },
  { value: 3000, label: 'Used' },
  { value: 7000, label: 'For parts or not working' },
];

const SHIPPING_OPTIONS: { value: ListingDraft['shippingService']; label: string }[] = [
  { value: 'USPSPriority', label: 'USPS Priority Mail' },
  { value: 'USPSPriorityFlatRateEnvelope', label: 'USPS Priority Mail Flat Rate Envelope' },
  { value: 'UPSGround', label: 'UPS Ground' },
  { value: 'ShippingMethodStandard', label: 'Generic standard shipping' },
];

export function ListingForm() {
  const form = useForm<ListingDraft>({
    resolver: zodResolver(ListingDraftSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onBlur',
  });

  const mutation = useMutation({ mutationFn: publishListing });

  const onSubmit: SubmitHandler<ListingDraft> = (data) => {
    mutation.mutate(data);
  };

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Title" htmlFor="title" error={errors.title?.message}>
        <input
          id="title"
          type="text"
          maxLength={80}
          {...form.register('title')}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </Field>

      <Field label="Description" htmlFor="description" error={errors.description?.message}>
        <textarea
          id="description"
          rows={4}
          {...form.register('description')}
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Category ID"
          htmlFor="categoryId"
          error={errors.categoryId?.message}
          hint="eBay leaf category. 88433 = Specialty Services > Other."
        >
          <input
            id="categoryId"
            type="text"
            inputMode="numeric"
            {...form.register('categoryId')}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="Condition" htmlFor="conditionId" error={errors.conditionId?.message}>
          <select
            id="conditionId"
            {...form.register('conditionId', { valueAsNumber: true })}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {CONDITION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Price (USD)" htmlFor="price" error={errors.startPrice?.value?.message}>
          <input
            id="price"
            type="number"
            step="0.01"
            min="0.01"
            {...form.register('startPrice.value', { valueAsNumber: true })}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="Quantity" htmlFor="quantity" error={errors.quantity?.message}>
          <input
            id="quantity"
            type="number"
            min="1"
            max="1000"
            {...form.register('quantity', { valueAsNumber: true })}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>

        <Field label="ZIP" htmlFor="postalCode" error={errors.postalCode?.message}>
          <input
            id="postalCode"
            type="text"
            {...form.register('postalCode')}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field
          label="Shipping service"
          htmlFor="shippingService"
          error={errors.shippingService?.message}
        >
          <select
            id="shippingService"
            {...form.register('shippingService')}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {SHIPPING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Shipping cost (USD)"
          htmlFor="shippingCost"
          error={errors.shippingCost?.value?.message}
        >
          <input
            id="shippingCost"
            type="number"
            step="0.01"
            min="0"
            {...form.register('shippingCost.value', { valueAsNumber: true })}
            className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-neutral-700">Return window</legend>
        <div className="mt-1 flex gap-4 text-sm">
          {(() => {
            // Register the radio group ONCE outside the map. Calling
            // form.register() inside the .map (once per radio) would
            // re-register on every render and leave RHF in an
            // inconsistent state where the second register call
            // overwrites the first's setValueAs binding. The two
            // radios share name="returnAcceptedDays" via the same
            // registration; the {...reg} spread is identical on both.
            //
            // setValueAs (not valueAsNumber) because RHF's
            // valueAsNumber reads input.valueAsNumber natively, which
            // is NaN for radio inputs — they have no numeric value
            // type. Number() on the DOM string value works for any
            // numeric radio group.
            const reg = form.register('returnAcceptedDays', { setValueAs: (v) => Number(v) });
            return [30, 60].map((days) => (
              <label key={days} className="flex items-center gap-1.5">
                <input type="radio" value={days} {...reg} />
                {days} days
              </label>
            ));
          })()}
        </div>
        {errors.returnAcceptedDays?.message && (
          <p className="mt-1 text-xs text-red-600">{errors.returnAcceptedDays.message}</p>
        )}
      </fieldset>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:bg-neutral-400"
          data-testid="publish-button"
        >
          {mutation.isPending ? 'Publishing…' : 'Publish listing'}
        </button>
        <button
          type="button"
          onClick={() => form.reset(DEFAULT_VALUES)}
          disabled={mutation.isPending}
          className="text-sm text-neutral-600 underline disabled:opacity-50"
        >
          Reset to defaults
        </button>
      </div>

      {mutation.isError && (
        <p
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="publish-network-error"
        >
          Network error: {mutation.error.message}
        </p>
      )}

      {mutation.data && isSuccess(mutation.data) && (
        <dl
          role="status"
          className="rounded border border-green-200 bg-green-50 p-3 text-sm"
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
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
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

      {mutation.data && isError(mutation.data) && (
        <div
          role="alert"
          className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid="publish-server-error"
        >
          <p>{mutation.data.error}</p>
          {mutation.data.issues && mutation.data.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {mutation.data.issues.map((iss, i) => (
                <li key={`${iss.path.join('.')}-${i}`}>
                  <code>{iss.path.join('.')}</code>: {iss.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}

interface FieldProps {
  label: string;
  htmlFor: string;
  // The `| undefined` is required by our tsconfig's exactOptionalPropertyTypes:
  // RHF's `errors.field?.message` is `string | undefined`, and TS won't widen
  // an optional `string` to accept it without the explicit union.
  error?: string | undefined;
  hint?: string | undefined;
  children: React.ReactNode;
}

function Field({ label, htmlFor, error, hint, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-neutral-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
