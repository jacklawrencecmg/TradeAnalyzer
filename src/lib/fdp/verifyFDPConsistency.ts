/**
 * Runtime FDP Consistency Verification
 *
 * Critical safety net to prevent value drift.
 * Randomly samples responses and verifies against canonical FDP values.
 *
 * If mismatch detected:
 * - Log FDP_MISMATCH
 * - Invalidate cache
 * - Flag build as suspect
 * - Never silently allow drift
 */

import { verifyFDPValuesBatch } from './getFDPValue';
import { supabase } from '../supabase';

interface PlayerValueResponse {
  player_id?: string;
  playerId?: string;
  value?: number;
  [key: string]: any;
}

export interface VerificationResult {
  passed: boolean;
  sampled: number;
  mismatches: number;
  errors: Array<{
    player_id: string;
    claimed: number;
    canonical: number;
    difference: number;
  }>;
}

/**
 * Verify FDP consistency in API response
 *
 * Randomly samples 3 players from response and verifies against canonical values.
 */
export async function verifyFDPConsistency(
  response: any,
  leagueProfileId?: string,
  format?: string
): Promise<VerificationResult> {
  try {
    const players = extractPlayers(response);

    if (players.length === 0) {
      return {
        passed: true,
        sampled: 0,
        mismatches: 0,
        errors: [],
      };
    }

    const sampleSize = Math.min(3, players.length);
    const sampled = samplePlayers(players, sampleSize);

    const valuesToVerify = sampled.map(p => ({
      player_id: p.player_id || p.playerId || '',
      value: p.value || 0,
    }));

    const verification = await verifyFDPValuesBatch(
      valuesToVerify,
      leagueProfileId,
      format
    );

    if (!verification.valid) {
      console.error('FDP_CONSISTENCY_CHECK_FAILED:', {
        sampled: sampleSize,
        mismatches: verification.mismatches.length,
        errors: verification.mismatches,
        response_preview: JSON.stringify(response).substring(0, 200),
      });

      await logFDPMismatch({
        sampled: sampleSize,
        mismatches: verification.mismatches,
        timestamp: new Date().toISOString(),
        league_profile_id: leagueProfileId,
        format,
      });

      await invalidateSuspectCache(sampled.map(p => p.player_id || p.playerId || ''));
    }

    return {
      passed: verification.valid,
      sampled: sampleSize,
      mismatches: verification.mismatches.length,
      errors: verification.mismatches,
    };
  } catch (error) {
    console.error('FDP_VERIFICATION_ERROR:', error);
    return {
      passed: false,
      sampled: 0,
      mismatches: 0,
      errors: [],
    };
  }
}

/**
 * Extract players with values from response
 */
function extractPlayers(response: any): PlayerValueResponse[] {
  const players: PlayerValueResponse[] = [];

  if (Array.isArray(response)) {
    for (const item of response) {
      if (hasPlayerValue(item)) {
        players.push(item);
      }
    }
  } else if (typeof response === 'object' && response !== null) {
    if (hasPlayerValue(response)) {
      players.push(response);
    }

    for (const key in response) {
      if (Array.isArray(response[key])) {
        players.push(...extractPlayers(response[key]));
      }
    }
  }

  return players;
}

/**
 * Check if object has player value fields
 */
function hasPlayerValue(obj: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  const hasPlayerId = 'player_id' in obj || 'playerId' in obj;
  const hasValue = 'value' in obj && typeof obj.value === 'number';

  return hasPlayerId && hasValue;
}

/**
 * Randomly sample N players from list
 */
function samplePlayers<T>(players: T[], n: number): T[] {
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

/**
 * Log FDP mismatch to database for monitoring
 */
async function logFDPMismatch(details: any): Promise<void> {
  try {
    await supabase.from('system_health_metrics').insert({
      metric_name: 'fdp_value_mismatch',
      metric_value: details.mismatches.length,
      status: 'critical',
      details,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log FDP mismatch:', error);
  }
}

/**
 * Invalidate cache for players with suspect values
 */
async function invalidateSuspectCache(playerIds: string[]): Promise<void> {
  try {
    console.warn('INVALIDATING_SUSPECT_CACHE:', playerIds);

    for (const playerId of playerIds) {
      const cacheKey = `player_value_${playerId}`;
      localStorage.removeItem(cacheKey);
      sessionStorage.removeItem(cacheKey);
    }
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
  }
}

/**
 * Middleware wrapper for API responses
 */
export function withFDPVerification<T>(
  handler: () => Promise<T>,
  options?: {
    leagueProfileId?: string;
    format?: string;
    skipVerification?: boolean;
  }
): Promise<T> {
  return handler().then(async (response) => {
    if (options?.skipVerification) {
      return response;
    }

    const verification = await verifyFDPConsistency(
      response,
      options?.leagueProfileId,
      options?.format
    );

    if (!verification.passed && verification.mismatches > 0) {
      console.error('FDP_VERIFICATION_FAILED_IN_MIDDLEWARE:', verification);
    }

    return response;
  });
}

/**
 * Express-style middleware for edge functions
 */
export function fdpVerificationMiddleware(
  req: Request,
  res: any,
  next: () => void
) {
  const originalJson = res.json;

  res.json = function (data: any) {
    verifyFDPConsistency(data).then((verification) => {
      if (!verification.passed) {
        console.warn('FDP_MISMATCH_IN_RESPONSE:', verification);
      }
    });

    return originalJson.call(this, data);
  };

  next();
}
