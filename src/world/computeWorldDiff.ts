import { isPlainRecord } from './dataGuards';
import { deepFreeze } from './deepFreeze';
import { cloneWorldValue } from './serialization';
import type {
  EntityUpdate,
  RelationUpdate,
  WorldDiff,
  WorldEntity,
  WorldEntityField,
  WorldRelation,
  WorldRelationField,
  WorldSnapshot,
} from './types';
import { validateWorldSnapshot } from './validation';

export class WorldDiffError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'WorldDiffError';
  }
}

const entityFields: readonly WorldEntityField[] = [
  'category',
  'kind',
  'name',
  'namespace',
  'labels',
  'status',
  'data',
  'title',
  'summary',
  'sourceIds',
  'visual',
];

const relationFields: readonly WorldRelationField[] = [
  'type',
  'from',
  'to',
  'directed',
  'semantic',
  'title',
  'sourceIds',
  'data',
];

const valuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }
    return left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) {
      return false;
    }
    const leftKeys = Object.keys(left).sort();
    const rightKeys = Object.keys(right).sort();
    if (
      leftKeys.length !== rightKeys.length ||
      leftKeys.some((key, index) => key !== rightKeys[index])
    ) {
      return false;
    }
    return leftKeys.every((key) => valuesEqual(left[key], right[key]));
  }
  return false;
};

const escapePointerSegment = (value: string): string =>
  value.replaceAll('~', '~0').replaceAll('/', '~1');

const collectChangedPaths = (
  before: unknown,
  after: unknown,
  path: string,
  output: string[],
): void => {
  if (valuesEqual(before, after)) {
    return;
  }

  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    before.forEach((value, index) => {
      collectChangedPaths(value, after[index], `${path}/${index}`, output);
    });
    return;
  }

  if (isPlainRecord(before) && isPlainRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      collectChangedPaths(before[key], after[key], `${path}/${escapePointerSegment(key)}`, output);
    }
    return;
  }

  output.push(path);
};

const fieldValue = (value: WorldEntity | WorldRelation, field: string): unknown =>
  (value as unknown as Readonly<Record<string, unknown>>)[field];

const createEntityUpdate = (before: WorldEntity, after: WorldEntity): EntityUpdate | undefined => {
  const changedFields = entityFields.filter(
    (field) => !valuesEqual(fieldValue(before, field), fieldValue(after, field)),
  );
  if (changedFields.length === 0) {
    return undefined;
  }

  const changedPaths: string[] = [];
  for (const field of changedFields) {
    collectChangedPaths(
      fieldValue(before, field),
      fieldValue(after, field),
      `/${escapePointerSegment(field)}`,
      changedPaths,
    );
  }

  return {
    id: before.id,
    before: cloneWorldValue(before),
    after: cloneWorldValue(after),
    changedFields,
    changedPaths: changedPaths.sort(),
  };
};

const createRelationUpdate = (
  before: WorldRelation,
  after: WorldRelation,
): RelationUpdate | undefined => {
  const changedFields = relationFields.filter(
    (field) => !valuesEqual(fieldValue(before, field), fieldValue(after, field)),
  );
  if (changedFields.length === 0) {
    return undefined;
  }

  const changedPaths: string[] = [];
  for (const field of changedFields) {
    collectChangedPaths(
      fieldValue(before, field),
      fieldValue(after, field),
      `/${escapePointerSegment(field)}`,
      changedPaths,
    );
  }

  return {
    id: before.id,
    before: cloneWorldValue(before),
    after: cloneWorldValue(after),
    changedFields,
    changedPaths: changedPaths.sort(),
  };
};

const sortedKeys = (record: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(record).sort();

/** Computes identity-based, stable-order changes without relying on display names. */
export const computeWorldDiff = (
  beforeValue: WorldSnapshot,
  afterValue: WorldSnapshot,
): WorldDiff => {
  const before = validateWorldSnapshot(beforeValue);
  const after = validateWorldSnapshot(afterValue);
  if (before.scenarioId !== after.scenarioId) {
    throw new WorldDiffError(
      `Cannot diff scenario "${before.scenarioId}" against "${after.scenarioId}".`,
    );
  }

  const beforeEntityIds = sortedKeys(before.entities);
  const afterEntityIds = sortedKeys(after.entities);
  const beforeRelationIds = sortedKeys(before.relations);
  const afterRelationIds = sortedKeys(after.relations);

  const addedEntities = afterEntityIds
    .filter((id) => before.entities[id] === undefined)
    .map((id) => cloneWorldValue(after.entities[id] as WorldEntity));
  const removedEntities = beforeEntityIds
    .filter((id) => after.entities[id] === undefined)
    .map((id) => cloneWorldValue(before.entities[id] as WorldEntity));
  const updatedEntities = beforeEntityIds
    .filter((id) => after.entities[id] !== undefined)
    .map((id) =>
      createEntityUpdate(before.entities[id] as WorldEntity, after.entities[id] as WorldEntity),
    )
    .filter((update): update is EntityUpdate => update !== undefined);

  const addedRelations = afterRelationIds
    .filter((id) => before.relations[id] === undefined)
    .map((id) => cloneWorldValue(after.relations[id] as WorldRelation));
  const removedRelations = beforeRelationIds
    .filter((id) => after.relations[id] === undefined)
    .map((id) => cloneWorldValue(before.relations[id] as WorldRelation));
  const updatedRelations = beforeRelationIds
    .filter((id) => after.relations[id] !== undefined)
    .map((id) =>
      createRelationUpdate(
        before.relations[id] as WorldRelation,
        after.relations[id] as WorldRelation,
      ),
    )
    .filter((update): update is RelationUpdate => update !== undefined);

  return deepFreeze({
    addedEntities,
    removedEntities,
    updatedEntities,
    addedRelations,
    removedRelations,
    updatedRelations,
  });
};
