import { deepFreeze } from './deepFreeze';
import { isPlainRecord } from './dataGuards';
import type { WorldSnapshot } from './types';
import { validateWorldSnapshot } from './validation';

export class WorldSerializationError extends Error {
  public readonly causeValue: unknown;

  public constructor(message: string, causeValue: unknown) {
    super(message);
    this.name = 'WorldSerializationError';
    this.causeValue = causeValue;
  }
}

/** Clones without sharing caller-owned objects. Non-cloneable values are rejected. */
export const cloneWorldValue = <T>(value: T): T => {
  try {
    return structuredClone(value);
  } catch {
    throw new WorldSerializationError('World values must be structured-cloneable.', value);
  }
};

const canonicalizeValue = (value: unknown): unknown => {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }

  if (!isPlainRecord(value)) {
    throw new WorldSerializationError('World values may only contain plain objects.', value);
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalizeValue(value[key])]),
  );
};

/**
 * Validates, clones, key-canonicalizes, and recursively freezes a snapshot. The
 * input is never frozen, which keeps ownership boundaries explicit.
 */
export const freezeWorldSnapshot = (value: unknown): WorldSnapshot => {
  const validated = validateWorldSnapshot(value);
  const cloned = cloneWorldValue(validated);
  const canonical = canonicalizeValue(cloned);
  const revalidated = validateWorldSnapshot(canonical);
  return deepFreeze(revalidated);
};
