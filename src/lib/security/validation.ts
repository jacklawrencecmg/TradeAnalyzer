/**
 * Input Validation Schemas
 *
 * Zod schemas for all API inputs.
 * Reject invalid input with 400 - no silent coercion.
 *
 * Usage:
 * ```typescript
 * import { RankingsQuerySchema } from './validation';
 *
 * const params = RankingsQuerySchema.parse(queryParams);
 * // Throws if invalid, returns typed object if valid
 * ```
 */

import { z } from 'zod';

/**
 * Base types
 */
export const UUIDSchema = z.string().uuid();

export const FormatSchema = z.enum(['dynasty', 'redraft']);

export const PositionSchema = z.enum(['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K']);

export const PositionOrAllSchema = z.enum(['QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB', 'K', 'all']);

/**
 * Pagination schema
 */
export const PaginationSchema = z.object({
  limit: z.number().int().min(1).max(200).default(50),
  offset: z.number().int().min(0).default(0),
});

/**
 * Rankings query schema
 */
export const RankingsQuerySchema = z.object({
  leagueProfileId: UUIDSchema.optional().nullable(),
  format: FormatSchema,
  position: PositionOrAllSchema.optional().default('all'),
  limit: z.number().int().min(1).max(200).default(100),
  offset: z.number().int().min(0).default(0),
  minValue: z.number().min(0).optional(),
});

/**
 * Player detail query schema
 */
export const PlayerDetailQuerySchema = z.object({
  playerId: UUIDSchema,
  format: FormatSchema.optional(),
  includeHistory: z.boolean().optional().default(false),
});

/**
 * Trade evaluation schema
 */
export const TradeEvalSchema = z.object({
  side1: z.array(UUIDSchema).min(1).max(20),
  side2: z.array(UUIDSchema).min(1).max(20),
  format: FormatSchema,
  leagueProfileId: UUIDSchema.optional().nullable(),
  includePicks: z.boolean().optional().default(false),
});

/**
 * Search query schema
 */
export const SearchQuerySchema = z.object({
  query: z.string().min(2).max(100),
  position: PositionOrAllSchema.optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/**
 * Export query schema
 */
export const ExportQuerySchema = z.object({
  format: FormatSchema,
  leagueProfileId: UUIDSchema.optional().nullable(),
  position: PositionOrAllSchema.optional(),
  limit: z.number().int().min(1).max(1500).default(1000),
  fileFormat: z.enum(['csv', 'json']).default('csv'),
});

/**
 * League profile create schema
 */
export const LeagueProfileCreateSchema = z.object({
  profileName: z.string().min(1).max(100),
  format: FormatSchema,
  scoringPreset: z.string().optional(),
  multipliers: z.record(z.number()).optional(),
});

/**
 * League profile update schema
 */
export const LeagueProfileUpdateSchema = z.object({
  profileId: UUIDSchema,
  profileName: z.string().min(1).max(100).optional(),
  scoringPreset: z.string().optional(),
  multipliers: z.record(z.number()).optional(),
});

/**
 * Watchlist add schema
 */
export const WatchlistAddSchema = z.object({
  playerId: UUIDSchema,
  notes: z.string().max(500).optional(),
});

/**
 * Alert create schema
 */
export const AlertCreateSchema = z.object({
  playerId: UUIDSchema,
  alertType: z.enum(['value_change', 'trade_opportunity', 'injury', 'news']),
  threshold: z.number().optional(),
  enabled: z.boolean().default(true),
});

/**
 * Rookie pick value query schema
 */
export const RookiePickQuerySchema = z.object({
  draftYear: z.number().int().min(2020).max(2030),
  round: z.number().int().min(1).max(5),
  pickNumber: z.number().int().min(1).max(32).optional(),
  format: FormatSchema,
});

/**
 * Admin rebuild schema
 */
export const AdminRebuildSchema = z.object({
  format: FormatSchema,
  dryRun: z.boolean().optional().default(false),
  skipBackup: z.boolean().optional().default(false),
});

/**
 * Admin sync schema
 */
export const AdminSyncSchema = z.object({
  source: z.enum(['ktc', 'fantasypros', 'sleeper', 'all']),
  format: FormatSchema.optional(),
  position: PositionSchema.optional(),
});

/**
 * Doctor audit schema
 */
export const DoctorAuditSchema = z.object({
  checkType: z.enum(['missing_values', 'stale_data', 'integrity', 'all']).default('all'),
  autoFix: z.boolean().optional().default(false),
});

/**
 * Validation helper
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  input: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return { success: false, error: errorMessage };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Validate and parse request body
 */
export async function validateRequestBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const body = await request.json();
    return validateInput(schema, body);
  } catch (error) {
    return { success: false, error: 'Invalid JSON body' };
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams<T>(
  url: URL,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string } {
  const params = Object.fromEntries(url.searchParams);

  // Convert string numbers to actual numbers
  const converted: Record<string, any> = {};
  for (const [key, value] of Object.entries(params)) {
    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num)) {
      converted[key] = num;
    } else if (value === 'true') {
      converted[key] = true;
    } else if (value === 'false') {
      converted[key] = false;
    } else {
      converted[key] = value;
    }
  }

  return validateInput(schema, converted);
}

/**
 * Sanitize user input (prevent XSS)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove HTML brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Validate pagination parameters
 */
export function validatePagination(params: {
  limit?: number;
  offset?: number;
}): { limit: number; offset: number } {
  const limit = Math.min(Math.max(params.limit || 50, 1), 200);
  const offset = Math.max(params.offset || 0, 0);

  return { limit, offset };
}

/**
 * Validate sort parameters
 */
export const SortSchema = z.object({
  sortBy: z.enum(['value', 'rank', 'name', 'position', 'age']).default('rank'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * Validate date range
 */
export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

/**
 * Validate IDP scoring preset
 */
export const IDPPresetSchema = z.enum([
  'standard',
  'premium',
  'dl-premium',
  'lb-premium',
  'db-premium',
  'balanced',
]);

/**
 * Validate player context update
 */
export const PlayerContextUpdateSchema = z.object({
  playerId: UUIDSchema,
  rbContext: z
    .object({
      workloadTier: z.enum(['bellcow', 'committee', 'backup', 'handcuff']).optional(),
      depthRole: z.enum(['starter', 'backup', 'third-string']).optional(),
      injuryRisk: z.enum(['low', 'medium', 'high']).optional(),
    })
    .optional(),
});

/**
 * Safe error response
 */
export function createErrorResponse(
  error: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({ error: sanitizeString(error) }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Safe success response
 */
export function createSuccessResponse<T>(data: T, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
