import { describe, expect, it } from 'vitest';
import { buildAddFixedPriceItemXml, type ListingPayload } from './xml.js';

const MINIMAL: ListingPayload = {
  title: 'Test Item',
  description: 'A test description.',
  categoryId: '11116',
  conditionId: 1000,
  startPrice: { value: 9.99, currency: 'USD' },
  postalCode: '95125',
  quantity: 1,
  shippingService: 'USPSPriority',
  shippingCost: { value: 5, currency: 'USD' },
  returnAcceptedDays: 30,
};

describe('buildAddFixedPriceItemXml', () => {
  it('emits the eBLBaseComponents namespace and AddFixedPriceItemRequest root', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).toContain('<?xml version="1.0" encoding="utf-8"?>');
    expect(xml).toContain('<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">');
    expect(xml).toContain('</AddFixedPriceItemRequest>');
  });

  it('emits required Item fields', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).toContain('<Title>Test Item</Title>');
    expect(xml).toContain('<Description>A test description.</Description>');
    expect(xml).toContain('<CategoryID>11116</CategoryID>');
    expect(xml).toContain('<ConditionID>1000</ConditionID>');
    expect(xml).toContain('<Quantity>1</Quantity>');
    expect(xml).toContain('<PostalCode>95125</PostalCode>');
    expect(xml).toContain('<ListingType>FixedPriceItem</ListingType>');
  });

  it('emits StartPrice with currencyID attribute and 2-decimal value', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).toContain('<StartPrice currencyID="USD">9.99</StartPrice>');
  });

  it('emits ShippingServiceCost with currencyID attribute and 2-decimal value', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).toContain('<ShippingServiceCost currencyID="USD">5.00</ShippingServiceCost>');
  });

  it('defaults dispatch days to 3 and listing duration to GTC', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).toContain('<DispatchTimeMax>3</DispatchTimeMax>');
    // GTC is the only duration eBay accepts for fixed-price listings as
    // of 2026; defaulting to it avoids a silent rewrite + warning.
    expect(xml).toContain('<ListingDuration>GTC</ListingDuration>');
  });

  it('respects override of dispatch days and listing duration', () => {
    const xml = buildAddFixedPriceItemXml({
      ...MINIMAL,
      dispatchTimeMaxDays: 1,
      listingDuration: 'Days_30',
    });
    expect(xml).toContain('<DispatchTimeMax>1</DispatchTimeMax>');
    expect(xml).toContain('<ListingDuration>Days_30</ListingDuration>');
  });

  it('emits Days_30 / Days_60 ReturnsWithinOption matching returnAcceptedDays', () => {
    const xml30 = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml30).toContain('<ReturnsWithinOption>Days_30</ReturnsWithinOption>');
    const xml60 = buildAddFixedPriceItemXml({ ...MINIMAL, returnAcceptedDays: 60 });
    expect(xml60).toContain('<ReturnsWithinOption>Days_60</ReturnsWithinOption>');
  });

  it('omits PictureDetails when no pictureUrls are provided', () => {
    const xml = buildAddFixedPriceItemXml(MINIMAL);
    expect(xml).not.toContain('<PictureDetails>');
  });

  it('emits one PictureURL per provided url, in order', () => {
    const xml = buildAddFixedPriceItemXml({
      ...MINIMAL,
      pictureUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
    });
    expect(xml).toContain(
      '<PictureDetails><PictureURL>https://example.com/a.jpg</PictureURL><PictureURL>https://example.com/b.jpg</PictureURL></PictureDetails>',
    );
  });

  it('XML-escapes special characters in user content', () => {
    const xml = buildAddFixedPriceItemXml({
      ...MINIMAL,
      title: 'Coke & Pepsi <50% off> "rare"',
      description: "Smith's collection — A & B",
    });
    expect(xml).toContain('<Title>Coke &amp; Pepsi &lt;50% off&gt; &quot;rare&quot;</Title>');
    expect(xml).toContain('<Description>Smith&apos;s collection — A &amp; B</Description>');
  });
});
