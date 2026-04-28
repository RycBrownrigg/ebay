import { XMLParser } from 'fast-xml-parser';
import { z } from 'zod';

// Trading API response parsing. eBay returns XML with an `Ack` element
// taking one of: Success, Warning, Failure, PartialFailure. Errors and
// warnings come in the `Errors` array — same shape for both, distinguished
// only by SeverityCode.

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  parseTagValue: true,
  // Force these elements to always be arrays even when there's only one,
  // so downstream code doesn't have to .Errors-vs-[Errors] dance.
  isArray: (name) => ['Errors'].includes(name),
});

const ErrorSchema = z.object({
  ShortMessage: z.string().optional(),
  LongMessage: z.string().optional(),
  ErrorCode: z.union([z.string(), z.number()]).optional(),
  SeverityCode: z.string().optional(),
});

const AddFixedPriceItemResponseEnvelope = z.object({
  AddFixedPriceItemResponse: z.object({
    Ack: z.string(),
    Errors: z.array(ErrorSchema).optional(),
    ItemID: z.union([z.string(), z.number()]).optional(),
    StartTime: z.string().optional(),
    EndTime: z.string().optional(),
    Timestamp: z.string().optional(),
    Version: z.union([z.string(), z.number()]).optional(),
  }),
});

export interface ParsedError {
  errorCode: string;
  severity: 'Error' | 'Warning' | 'Customized';
  shortMessage: string;
  longMessage?: string;
}

export interface AddItemSuccess {
  ack: 'Success' | 'Warning';
  itemId: string;
  startTime?: string;
  endTime?: string;
  warnings?: ParsedError[];
}

export interface AddItemFailure {
  ack: 'Failure' | 'PartialFailure';
  errors: ParsedError[];
}

export type AddItemResult = AddItemSuccess | AddItemFailure;

function mapErrors(raw: z.infer<typeof ErrorSchema>[] | undefined): ParsedError[] {
  return (raw ?? []).map((e) => ({
    errorCode: String(e.ErrorCode ?? 'unknown'),
    severity: (e.SeverityCode as ParsedError['severity']) ?? 'Error',
    shortMessage: e.ShortMessage ?? '',
    ...(e.LongMessage !== undefined ? { longMessage: e.LongMessage } : {}),
  }));
}

export function parseAddFixedPriceItemResponse(xml: string): AddItemResult {
  const json: unknown = parser.parse(xml);
  const validated = AddFixedPriceItemResponseEnvelope.parse(json);
  const r = validated.AddFixedPriceItemResponse;
  const errors = mapErrors(r.Errors);

  if (r.Ack === 'Success' || r.Ack === 'Warning') {
    if (r.ItemID === undefined) {
      throw new Error(`successful response missing ItemID: ${xml}`);
    }
    return {
      ack: r.Ack,
      itemId: String(r.ItemID),
      ...(r.StartTime !== undefined ? { startTime: r.StartTime } : {}),
      ...(r.EndTime !== undefined ? { endTime: r.EndTime } : {}),
      ...(errors.length > 0 ? { warnings: errors } : {}),
    };
  }

  if (r.Ack === 'Failure' || r.Ack === 'PartialFailure') {
    return { ack: r.Ack, errors };
  }

  throw new Error(`unrecognized Ack value: ${r.Ack}`);
}
