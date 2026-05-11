import { z } from 'zod';

// Canonical listing-draft contract shared between web (form), backend
// (POST /api/listings/publish body), and (eventually) iOS — anywhere a
// listing is created or edited. Backend's Trading-API payload type
// (`ListingPayload` in backend/src/ebay/trading/xml.ts) is currently
// structurally identical to this; if they diverge later (e.g., to
// carry policy IDs or compute eBay-specific fields), the divergence
// happens at the boundary in the route handler — keep this schema
// the source of truth for "what a user can enter."

// Transforms intentionally kept minimal:
// - title: trim + collapse multi-space (titles are keyword-soup, no
//   prose; leading/trailing whitespace + double spaces are universally
//   typos when submitting).
// - description: trim only (multi-line prose; double-spaces between
//   sentences are stylistically valid).
// Other normalisations live elsewhere:
// - listingDuration default ('GTC' for fixed-price): applied in the
//   XML builder, which knows the listing type. Adding a default here
//   would duplicate the rule and break for auctions in M2.4.
// - postalCode and categoryId are passed through verbatim because
//   eBay rejects normalised forms (stripped hyphens, zero-padded IDs).

export const ListingDraftSchema = z.object({
  title: z
    .string()
    .min(1, 'title is required')
    .max(80, 'eBay caps titles at 80 characters')
    .transform((s) => s.trim().replace(/\s+/g, ' ')),

  description: z
    .string()
    .min(1, 'description is required')
    .max(500_000, 'description exceeds eBay limit')
    .transform((s) => s.trim()),

  categoryId: z.string().regex(/^\d+$/, 'numeric eBay category ID'),

  conditionId: z.number().int().positive(),

  startPrice: z.object({
    value: z.number().positive().max(999_999),
    currency: z.literal('USD'),
  }),

  postalCode: z.string().regex(/^\d{5}(-\d{4})?$/, '5 or 9 digit US ZIP'),

  quantity: z.number().int().min(1).max(1000),

  shippingService: z.enum([
    'USPSPriority',
    'USPSPriorityFlatRateEnvelope',
    'UPSGround',
    'ShippingMethodStandard',
  ]),

  shippingCost: z.object({
    value: z.number().nonnegative().max(9_999),
    currency: z.literal('USD'),
  }),

  returnAcceptedDays: z.union([z.literal(30), z.literal(60)]),

  pictureUrls: z.array(z.string().url()).max(24).optional(),

  dispatchTimeMaxDays: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),

  listingDuration: z
    .enum(['GTC', 'Days_1', 'Days_3', 'Days_5', 'Days_7', 'Days_10', 'Days_30'])
    .optional(),
});

export type ListingDraft = z.infer<typeof ListingDraftSchema>;
