/**
 * Health-check response schema and type, shared across packages.
 *
 * Used by the backend route to type its response body and by the web
 * HealthCard to validate the parsed JSON before rendering it.
 *
 * Exports:
 * - `HealthResponseSchema` — Zod schema for the /api/health JSON response.
 * - `HealthResponse`       — TypeScript type inferred from HealthResponseSchema.
 */
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('ebay-api'),
  version: z.string().min(1),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
