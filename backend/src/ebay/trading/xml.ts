// Hand-built XML for eBay Trading API AddFixedPriceItem requests.
// Per BUILD_PLAN.md §1: hand-written for writing (Trading API payloads
// are small and well-specified), fast-xml-parser for reading.
//
// Trading API references the eBLBaseComponents namespace and is
// case-sensitive. The element order matters in some cases, but the
// shape below follows eBay's recommended ordering for AddFixedPriceItem.

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
  listingDurationDays?: 1 | 3 | 5 | 7 | 10 | 30;
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
  const durationDays = payload.listingDurationDays ?? 7;
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
    `<ListingDuration>Days_${durationDays}</ListingDuration>`,
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
