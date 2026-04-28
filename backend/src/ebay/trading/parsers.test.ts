import { describe, expect, it } from 'vitest';
import { parseAddFixedPriceItemResponse } from './parsers.js';

const SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2026-04-28T17:00:00.000Z</Timestamp>
  <Ack>Success</Ack>
  <Version>1227</Version>
  <ItemID>110123456789</ItemID>
  <StartTime>2026-04-28T17:00:00.000Z</StartTime>
  <EndTime>2026-05-05T17:00:00.000Z</EndTime>
</AddFixedPriceItemResponse>`;

const FAILURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Timestamp>2026-04-28T17:00:00.000Z</Timestamp>
  <Ack>Failure</Ack>
  <Errors>
    <ShortMessage>Bad Postal Code Format</ShortMessage>
    <LongMessage>The postal code provided is invalid.</LongMessage>
    <ErrorCode>166</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
  <Version>1227</Version>
</AddFixedPriceItemResponse>`;

const MULTI_ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Failure</Ack>
  <Errors>
    <ShortMessage>First problem</ShortMessage>
    <ErrorCode>10</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
  <Errors>
    <ShortMessage>Second problem</ShortMessage>
    <ErrorCode>20</ErrorCode>
    <SeverityCode>Error</SeverityCode>
  </Errors>
</AddFixedPriceItemResponse>`;

const WARNING_XML = `<?xml version="1.0" encoding="UTF-8"?>
<AddFixedPriceItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
  <Ack>Warning</Ack>
  <ItemID>110987654321</ItemID>
  <StartTime>2026-04-28T17:00:00.000Z</StartTime>
  <EndTime>2026-05-05T17:00:00.000Z</EndTime>
  <Errors>
    <ShortMessage>Small issue</ShortMessage>
    <ErrorCode>9999</ErrorCode>
    <SeverityCode>Warning</SeverityCode>
  </Errors>
</AddFixedPriceItemResponse>`;

describe('parseAddFixedPriceItemResponse', () => {
  it('parses a Success response', () => {
    const result = parseAddFixedPriceItemResponse(SUCCESS_XML);
    expect(result.ack).toBe('Success');
    if (result.ack !== 'Success' && result.ack !== 'Warning') {
      throw new Error('expected success/warning');
    }
    expect(result.itemId).toBe('110123456789');
    expect(result.startTime).toBe('2026-04-28T17:00:00.000Z');
    expect(result.endTime).toBe('2026-05-05T17:00:00.000Z');
    expect(result.warnings).toBeUndefined();
  });

  it('parses a Failure response with one error', () => {
    const result = parseAddFixedPriceItemResponse(FAILURE_XML);
    expect(result.ack).toBe('Failure');
    if (result.ack !== 'Failure' && result.ack !== 'PartialFailure') {
      throw new Error('expected failure');
    }
    expect(result.errors).toHaveLength(1);
    const error = result.errors[0]!;
    expect(error.errorCode).toBe('166');
    expect(error.shortMessage).toBe('Bad Postal Code Format');
    expect(error.longMessage).toBe('The postal code provided is invalid.');
    expect(error.severity).toBe('Error');
  });

  it('parses a Failure response with multiple Errors entries (preserved as array)', () => {
    const result = parseAddFixedPriceItemResponse(MULTI_ERROR_XML);
    if (result.ack !== 'Failure' && result.ack !== 'PartialFailure') {
      throw new Error('expected failure');
    }
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]!.errorCode).toBe('10');
    expect(result.errors[1]!.errorCode).toBe('20');
  });

  it('parses a Warning response (treated as success with attached warnings)', () => {
    const result = parseAddFixedPriceItemResponse(WARNING_XML);
    expect(result.ack).toBe('Warning');
    if (result.ack !== 'Success' && result.ack !== 'Warning') {
      throw new Error('expected success/warning');
    }
    expect(result.itemId).toBe('110987654321');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings![0]!.severity).toBe('Warning');
  });

  it('throws on a Success response missing ItemID', () => {
    const broken = SUCCESS_XML.replace('<ItemID>110123456789</ItemID>', '');
    expect(() => parseAddFixedPriceItemResponse(broken)).toThrow(/missing ItemID/);
  });
});
