// Hand-built XML for eBay Trading API AddFixedPriceItem requests.
// Per BUILD_PLAN.md §1: hand-written for writing (Trading API payloads
// are small and well-specified), fast-xml-parser for reading.
//
// Trading API references the eBLBaseComponents namespace and is
// case-sensitive. The element order matters in some cases, but the
// shape below follows eBay's recommended ordering for AddFixedPriceItem.

// ListingDuration values eBay accepts. Note: as of 2026, fixed-price
// listings only support `GTC` (Good 'Til Cancelled). The Days_N values
// are still accepted by the parser but eBay silently rewrites them to
// GTC and emits warning 21920214. Auctions (when M2 adds them) accept
// the Days_N values.
export type ListingDuration =
  | 'GTC'
  | 'Days_1'
  | 'Days_3'
  | 'Days_5'
  | 'Days_7'
  | 'Days_10'
  | 'Days_30';

export interface ListingPayload {
  title: string;
  description: string;
  categoryId: string;
  conditionId: number;
  startPrice: { value: number; currency: string };
  postalCode: string;
  quantity: number;
  pictureUrls?: string[];
  shippingService: string;
  shippingCost: { value: number; currency: string };
  returnAcceptedDays: 30 | 60;
  dispatchTimeMaxDays?: 1 | 2 | 3;
  listingDuration?: ListingDuration;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function picturesXml(urls: string[]): string {
  return [
    '<PictureDetails>',
    ...urls.map((u) => `<PictureURL>${escapeXml(u)}</PictureURL>`),
    '</PictureDetails>',
  ].join('');
}

export function buildAddFixedPriceItemXml(payload: ListingPayload): string {
  const dispatchDays = payload.dispatchTimeMaxDays ?? 3;
  const duration = payload.listingDuration ?? 'GTC';
  const pictures =
    payload.pictureUrls && payload.pictureUrls.length > 0 ? picturesXml(payload.pictureUrls) : '';

  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">',
    '<Item>',
    `<Title>${escapeXml(payload.title)}</Title>`,
    `<Description>${escapeXml(payload.description)}</Description>`,
    '<PrimaryCategory>',
    `<CategoryID>${escapeXml(payload.categoryId)}</CategoryID>`,
    '</PrimaryCategory>',
    `<StartPrice currencyID="${escapeXml(payload.startPrice.currency)}">${payload.startPrice.value.toFixed(2)}</StartPrice>`,
    '<CategoryMappingAllowed>true</CategoryMappingAllowed>',
    '<Country>US</Country>',
    `<Currency>${escapeXml(payload.startPrice.currency)}</Currency>`,
    `<ConditionID>${payload.conditionId}</ConditionID>`,
    `<DispatchTimeMax>${dispatchDays}</DispatchTimeMax>`,
    `<ListingDuration>${duration}</ListingDuration>`,
    '<ListingType>FixedPriceItem</ListingType>',
    pictures,
    `<PostalCode>${escapeXml(payload.postalCode)}</PostalCode>`,
    `<Quantity>${payload.quantity}</Quantity>`,
    '<ReturnPolicy>',
    '<ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>',
    '<RefundOption>MoneyBack</RefundOption>',
    `<ReturnsWithinOption>Days_${payload.returnAcceptedDays}</ReturnsWithinOption>`,
    '<ShippingCostPaidByOption>Buyer</ShippingCostPaidByOption>',
    '</ReturnPolicy>',
    '<ShippingDetails>',
    '<ShippingType>Flat</ShippingType>',
    '<ShippingServiceOptions>',
    '<ShippingServicePriority>1</ShippingServicePriority>',
    `<ShippingService>${escapeXml(payload.shippingService)}</ShippingService>`,
    `<ShippingServiceCost currencyID="${escapeXml(payload.shippingCost.currency)}">${payload.shippingCost.value.toFixed(2)}</ShippingServiceCost>`,
    '</ShippingServiceOptions>',
    '</ShippingDetails>',
    '<Site>US</Site>',
    '</Item>',
    '</AddFixedPriceItemRequest>',
  ].join('');
}
