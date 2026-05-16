/**
 * High-level AddFixedPriceItem Trading API operation.
 *
 * Composes the XML builder, the HTTP client, and the response parser into a
 * single call used by the /api/listings/publish route. Each concern lives in
 * its own module (xml.ts, client.ts, parsers.ts) so they can be tested and
 * swapped independently.
 *
 * Exports:
 * - `addFixedPriceItem` — Builds XML, posts to the Trading API, and returns a parsed result.
 */
import { callTradingApi } from './client.js';
import { parseAddFixedPriceItemResponse, type AddItemResult } from './parsers.js';
import { buildAddFixedPriceItemXml, type ListingPayload } from './xml.js';

// High-level wrapper: build the XML, POST it via the Trading client,
// parse the response. Used by the /api/listings/publish route in M1.4.

/** Publishes a fixed-price listing to eBay and returns the parsed success or failure result. */
export async function addFixedPriceItem(
  payload: ListingPayload,
  accessToken: string,
): Promise<AddItemResult> {
  const requestXml = buildAddFixedPriceItemXml(payload);
  const responseXml = await callTradingApi({
    callName: 'AddFixedPriceItem',
    accessToken,
    body: requestXml,
  });
  return parseAddFixedPriceItemResponse(responseXml);
}
