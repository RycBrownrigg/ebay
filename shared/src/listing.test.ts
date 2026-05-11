import { describe, expect, it } from 'vitest';
import { ListingDraftSchema, type ListingDraft } from './listing.js';

const VALID: ListingDraft = {
  title: 'Sample listing',
  description: 'A test description.',
  categoryId: '88433',
  conditionId: 1000,
  startPrice: { value: 9.99, currency: 'USD' },
  postalCode: '95125',
  quantity: 1,
  shippingService: 'USPSPriority',
  shippingCost: { value: 5, currency: 'USD' },
  returnAcceptedDays: 30,
};

describe('ListingDraftSchema', () => {
  it('parses a minimal valid draft unchanged', () => {
    const result = ListingDraftSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Sample listing');
      expect(result.data.description).toBe('A test description.');
    }
  });

  it('trims and collapses whitespace in title', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      title: '   Apple   iPhone 14  Pro   ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('Apple iPhone 14 Pro');
    }
  });

  it('trims description but preserves internal spacing', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      description: '  Two  spaces here.\n\nAnd a paragraph break.  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Trim removes leading/trailing only — internal "two  spaces"
      // and "\n\n" stay intact (prose semantics).
      expect(result.data.description).toBe('Two  spaces here.\n\nAnd a paragraph break.');
    }
  });

  it('rejects an empty title', () => {
    const result = ListingDraftSchema.safeParse({ ...VALID, title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a title over 80 chars', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      title: 'x'.repeat(81),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 5-digit ZIP', () => {
    const result = ListingDraftSchema.safeParse({ ...VALID, postalCode: '95125' });
    expect(result.success).toBe(true);
  });

  it('accepts a 5+4 ZIP and preserves the hyphen', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      postalCode: '95125-1234',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.postalCode).toBe('95125-1234');
    }
  });

  it('rejects a 4-digit or 6-digit ZIP', () => {
    expect(ListingDraftSchema.safeParse({ ...VALID, postalCode: '9512' }).success).toBe(false);
    expect(ListingDraftSchema.safeParse({ ...VALID, postalCode: '951255' }).success).toBe(false);
  });

  it('rejects a non-numeric categoryId', () => {
    expect(ListingDraftSchema.safeParse({ ...VALID, categoryId: 'abc' }).success).toBe(false);
    expect(ListingDraftSchema.safeParse({ ...VALID, categoryId: '88-433' }).success).toBe(false);
  });

  it('preserves categoryId verbatim (no zero-padding)', () => {
    const result = ListingDraftSchema.safeParse({ ...VALID, categoryId: '88433' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.categoryId).toBe('88433');
    }
  });

  it('rejects a non-USD currency', () => {
    expect(
      ListingDraftSchema.safeParse({
        ...VALID,
        startPrice: { value: 9.99, currency: 'EUR' },
      }).success,
    ).toBe(false);
  });

  it('rejects a price ≤ 0', () => {
    expect(
      ListingDraftSchema.safeParse({
        ...VALID,
        startPrice: { value: 0, currency: 'USD' },
      }).success,
    ).toBe(false);
    expect(
      ListingDraftSchema.safeParse({
        ...VALID,
        startPrice: { value: -1, currency: 'USD' },
      }).success,
    ).toBe(false);
  });

  it('accepts a shippingCost of zero (free shipping)', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      shippingCost: { value: 0, currency: 'USD' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects shippingService not in the allowed enum', () => {
    expect(
      ListingDraftSchema.safeParse({
        ...VALID,
        shippingService: 'CarrierPigeon',
      }).success,
    ).toBe(false);
  });

  it('rejects returnAcceptedDays other than 30 or 60', () => {
    expect(ListingDraftSchema.safeParse({ ...VALID, returnAcceptedDays: 90 }).success).toBe(false);
    expect(ListingDraftSchema.safeParse({ ...VALID, returnAcceptedDays: 14 }).success).toBe(false);
  });

  it('rejects quantity below 1 or above 1000', () => {
    expect(ListingDraftSchema.safeParse({ ...VALID, quantity: 0 }).success).toBe(false);
    expect(ListingDraftSchema.safeParse({ ...VALID, quantity: 1001 }).success).toBe(false);
  });

  it('accepts optional pictureUrls when provided', () => {
    const result = ListingDraftSchema.safeParse({
      ...VALID,
      pictureUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 24 pictureUrls', () => {
    const urls = Array.from({ length: 25 }, (_, i) => `https://example.com/${i}.jpg`);
    expect(ListingDraftSchema.safeParse({ ...VALID, pictureUrls: urls }).success).toBe(false);
  });

  it('rejects non-URL strings in pictureUrls', () => {
    expect(
      ListingDraftSchema.safeParse({
        ...VALID,
        pictureUrls: ['not-a-url'],
      }).success,
    ).toBe(false);
  });

  it('leaves pictureUrls undefined if omitted', () => {
    const result = ListingDraftSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pictureUrls).toBeUndefined();
    }
  });

  it('leaves listingDuration undefined if omitted (XML builder applies default)', () => {
    const result = ListingDraftSchema.safeParse(VALID);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.listingDuration).toBeUndefined();
    }
  });
});
