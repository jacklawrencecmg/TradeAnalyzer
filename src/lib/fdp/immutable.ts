/**
 * FDP Immutability Enforcement
 *
 * Once an FDP value is retrieved, it becomes IMMUTABLE.
 * No modifications, recalculations, averaging, scaling, or transformations allowed.
 *
 * Violations:
 * - Dev mode: Throws error
 * - Prod mode: Logs warning
 *
 * This is the final protection layer ensuring FDP values cannot be tampered with.
 */

import type { FDPValueBundle } from './types';

/**
 * Deep freeze an object recursively
 * Makes the entire FDP bundle immutable
 */
export function deepFreeze<T extends object>(obj: T): Readonly<T> {
  // Get all property names including symbols
  const propNames = Object.getOwnPropertyNames(obj);
  const propSymbols = Object.getOwnPropertySymbols(obj);

  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = (obj as any)[name];

    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  for (const symbol of propSymbols) {
    const value = (obj as any)[symbol];

    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }

  return Object.freeze(obj);
}

/**
 * Create a checksum for tamper detection
 * Used to verify FDP bundle hasn't been modified
 */
export function createFDPChecksum(bundle: FDPValueBundle): string {
  const payload = [
    bundle.player_id,
    bundle.value,
    bundle.tier,
    bundle.overall_rank,
    bundle.pos_rank,
    bundle.value_epoch,
    bundle.updated_at,
  ].join('|');

  // Simple hash (crypto.subtle not available in all environments)
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return Math.abs(hash).toString(36);
}

/**
 * Attach checksum to FDP bundle for tamper detection
 */
export function attachChecksum(bundle: FDPValueBundle): FDPValueBundle & { __checksum: string } {
  const checksum = createFDPChecksum(bundle);

  return {
    ...bundle,
    __checksum: checksum,
  };
}

/**
 * Verify FDP bundle hasn't been tampered with
 */
export function verifyChecksum(
  bundle: FDPValueBundle & { __checksum?: string }
): {
  valid: boolean;
  expectedChecksum: string;
  actualChecksum?: string;
} {
  const expectedChecksum = createFDPChecksum(bundle);
  const actualChecksum = bundle.__checksum;

  if (!actualChecksum) {
    return {
      valid: false,
      expectedChecksum,
      actualChecksum: undefined,
    };
  }

  const valid = expectedChecksum === actualChecksum;

  if (!valid) {
    logTamperAttempt(bundle, expectedChecksum, actualChecksum);
  }

  return {
    valid,
    expectedChecksum,
    actualChecksum,
  };
}

/**
 * Log tamper attempt
 */
function logTamperAttempt(
  bundle: FDPValueBundle & { __checksum?: string },
  expected: string,
  actual: string
): void {
  const warning = {
    type: 'FDP_TAMPER_DETECTED',
    player_id: bundle.player_id,
    expected_checksum: expected,
    actual_checksum: actual,
    timestamp: new Date().toISOString(),
  };

  console.error('FDP_TAMPER_DETECTED:', warning);

  // In dev mode, throw
  if (import.meta.env.DEV) {
    throw new Error(
      `FDP value tampering detected for ${bundle.player_id}. ` +
        `Expected checksum ${expected}, got ${actual}. ` +
        `FDP values are immutable and cannot be modified.`
    );
  }
}

/**
 * Make FDP bundle immutable and attach checksum
 * This is called by getFDPValue() before returning
 */
export function makeImmutable(bundle: FDPValueBundle): Readonly<FDPValueBundle> {
  // Attach checksum for tamper detection
  const bundleWithChecksum = attachChecksum(bundle);

  // Deep freeze to prevent mutations
  const frozen = deepFreeze(bundleWithChecksum);

  return frozen;
}

/**
 * Detect mutation attempts (for development)
 */
export function detectMutationAttempt(bundle: FDPValueBundle, operation: string): void {
  const warning = {
    type: 'FDP_MUTATION_ATTEMPT',
    player_id: bundle.player_id,
    operation,
    timestamp: new Date().toISOString(),
  };

  console.error('FDP_MUTATION_ATTEMPT:', warning);

  if (import.meta.env.DEV) {
    throw new Error(
      `Attempted to mutate FDP value for ${bundle.player_id}. ` +
        `Operation: ${operation}. ` +
        `FDP values are immutable. Use formatFDPValue() for display.`
    );
  }
}

/**
 * Check if object is frozen (immutable)
 */
export function isImmutable(obj: any): boolean {
  return Object.isFrozen(obj);
}

/**
 * Validate FDP bundle integrity
 * Returns errors if bundle has been compromised
 */
export function validateIntegrity(bundle: FDPValueBundle & { __checksum?: string }): string[] {
  const errors: string[] = [];

  // Check if frozen
  if (!isImmutable(bundle)) {
    errors.push('FDP bundle is not frozen (mutable)');
  }

  // Check if checksum exists
  if (!bundle.__checksum) {
    errors.push('FDP bundle missing checksum');
  }

  // Verify checksum
  const { valid } = verifyChecksum(bundle);
  if (!valid) {
    errors.push('FDP bundle checksum mismatch (tampered)');
  }

  // Check required fields
  if (!bundle.player_id) errors.push('Missing player_id');
  if (typeof bundle.value !== 'number') errors.push('Invalid value type');
  if (!bundle.value_epoch) errors.push('Missing value_epoch');
  if (!bundle.updated_at) errors.push('Missing updated_at');

  return errors;
}
