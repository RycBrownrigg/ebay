import { callTradingApi } from './client.js';
import { parseAddFixedPriceItemResponse, type AddItemResult } from './parsers.js';
import { buildAddFixedPriceItemXml, type ListingPayload } from './xml.js';

// High-level wrapper: build the XML, POST it via the Trading client,
// parse the response. Used by the /api/listings/publish route in M1.4.

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
