export type DeepReadonly<T> = T extends (...arguments_: readonly unknown[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

const freezeRecursively = (value: unknown, visited: WeakSet<object>): void => {
  if ((typeof value !== 'object' && typeof value !== 'function') || value === null) {
    return;
  }

  const objectValue = value as object;
  if (visited.has(objectValue)) {
    return;
  }
  visited.add(objectValue);

  for (const key of Reflect.ownKeys(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor !== undefined && 'value' in descriptor) {
      freezeRecursively(descriptor.value, visited);
    }
  }

  Object.freeze(objectValue);
};

/**
 * Recursively freezes own data properties without invoking accessors. Cycles are
 * tolerated here so this utility is safe in isolation; world validation rejects
 * cycles before a value can become a snapshot.
 */
export const deepFreeze = <T>(value: T): DeepReadonly<T> => {
  freezeRecursively(value, new WeakSet<object>());
  return value as DeepReadonly<T>;
};
