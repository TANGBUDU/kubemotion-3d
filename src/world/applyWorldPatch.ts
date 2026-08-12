import { isPlainRecord } from './dataGuards';
import { cloneWorldValue, freezeWorldSnapshot, WorldSerializationError } from './serialization';
import type {
  WorldEntity,
  WorldEntityPatch,
  WorldPatch,
  WorldRelation,
  WorldRelationPatch,
  WorldSnapshot,
} from './types';
import { validateWorldSnapshot, WorldValidationError } from './validation';

export type WorldPatchErrorCode =
  | 'invalid-patch'
  | 'duplicate-entity'
  | 'missing-entity'
  | 'duplicate-relation'
  | 'missing-relation'
  | 'identity-change'
  | 'revision-overflow'
  | 'invalid-result';

export class WorldPatchError extends Error {
  public readonly code: WorldPatchErrorCode;
  public readonly operationIndex: number | undefined;
  public readonly causeValue: unknown;

  public constructor(
    code: WorldPatchErrorCode,
    message: string,
    operationIndex?: number,
    causeValue?: unknown,
  ) {
    super(operationIndex === undefined ? message : `Operation ${operationIndex}: ${message}`);
    this.name = 'WorldPatchError';
    this.code = code;
    this.operationIndex = operationIndex;
    this.causeValue = causeValue;
  }
}

const patchKeys = new Set(['operations']);
const entityPatchKeys = new Set([
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
]);
const relationPatchKeys = new Set([
  'type',
  'from',
  'to',
  'directed',
  'semantic',
  'title',
  'sourceIds',
  'data',
]);

const ensureExactKeys = (
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  label: string,
  operationIndex?: number,
): void => {
  const unexpected = Object.keys(record).filter((key) => !allowed.has(key));
  if (unexpected.length > 0) {
    throw new WorldPatchError(
      unexpected.includes('id') ? 'identity-change' : 'invalid-patch',
      `${label} contains forbidden field(s): ${unexpected.sort().join(', ')}.`,
      operationIndex,
      record,
    );
  }
};

const requireNonEmptyString = (value: unknown, label: string, operationIndex: number): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorldPatchError(
      'invalid-patch',
      `${label} must be a non-empty string.`,
      operationIndex,
      value,
    );
  }
  return value;
};

const mergeLabels = (current: WorldEntity['labels'], patchValue: unknown): unknown => {
  if (patchValue === null) {
    return undefined;
  }
  if (!isPlainRecord(patchValue)) {
    return patchValue;
  }

  const merged: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(patchValue)) {
    if (value === null) {
      delete merged[key];
    } else {
      merged[key] = value;
    }
  }
  return Object.keys(merged).length === 0 ? undefined : merged;
};

const applyEntityPatch = (
  entity: WorldEntity,
  patchValue: unknown,
  operationIndex: number,
): WorldEntity => {
  if (!isPlainRecord(patchValue)) {
    throw new WorldPatchError(
      'invalid-patch',
      'Entity patch must be a plain object.',
      operationIndex,
      patchValue,
    );
  }
  ensureExactKeys(patchValue, entityPatchKeys, 'Entity patch', operationIndex);

  const next: Record<string, unknown> = { ...entity };
  for (const key of [
    'category',
    'kind',
    'name',
    'status',
    'title',
    'summary',
    'sourceIds',
  ] as const) {
    if (Object.hasOwn(patchValue, key)) {
      next[key] = patchValue[key];
    }
  }

  if (Object.hasOwn(patchValue, 'namespace')) {
    if (patchValue.namespace === null) {
      delete next.namespace;
    } else {
      next.namespace = patchValue.namespace;
    }
  }

  if (Object.hasOwn(patchValue, 'labels')) {
    const labels = mergeLabels(entity.labels, patchValue.labels);
    if (labels === undefined) {
      delete next.labels;
    } else {
      next.labels = labels;
    }
  }

  if (Object.hasOwn(patchValue, 'data')) {
    next.data = isPlainRecord(patchValue.data)
      ? { ...entity.data, ...patchValue.data }
      : patchValue.data;
  }

  if (Object.hasOwn(patchValue, 'visual')) {
    if (isPlainRecord(patchValue.visual)) {
      const visual: Record<string, unknown> = { ...entity.visual, ...patchValue.visual };
      if (patchValue.visual.size === null) {
        delete visual.size;
      }
      if (patchValue.visual.group === null) {
        delete visual.group;
      }
      next.visual = visual;
    } else {
      next.visual = patchValue.visual;
    }
  }

  return next as unknown as WorldEntity;
};

const applyRelationPatch = (
  relation: WorldRelation,
  patchValue: unknown,
  operationIndex: number,
): WorldRelation => {
  if (!isPlainRecord(patchValue)) {
    throw new WorldPatchError(
      'invalid-patch',
      'Relation patch must be a plain object.',
      operationIndex,
      patchValue,
    );
  }
  ensureExactKeys(patchValue, relationPatchKeys, 'Relation patch', operationIndex);

  const next: Record<string, unknown> = { ...relation };
  for (const key of ['type', 'from', 'to', 'directed', 'semantic', 'title', 'sourceIds'] as const) {
    if (Object.hasOwn(patchValue, key)) {
      next[key] = patchValue[key];
    }
  }

  if (Object.hasOwn(patchValue, 'data')) {
    if (patchValue.data === null) {
      delete next.data;
    } else {
      next.data =
        isPlainRecord(patchValue.data) && relation.data !== undefined
          ? { ...relation.data, ...patchValue.data }
          : patchValue.data;
    }
  }

  return next as unknown as WorldRelation;
};

const clonePatch = (patch: WorldPatch): WorldPatch => {
  try {
    return cloneWorldValue(patch);
  } catch (error: unknown) {
    if (error instanceof WorldSerializationError) {
      throw new WorldPatchError('invalid-patch', error.message, undefined, error.causeValue);
    }
    throw error;
  }
};

/**
 * Applies an ordered operation transaction to a detached clone. Cross-reference
 * checks happen against the final transaction state, so relations can be removed
 * in the same patch as their endpoint regardless of operation order.
 */
export const applyWorldPatch = (world: WorldSnapshot, patch: WorldPatch): WorldSnapshot => {
  const base = validateWorldSnapshot(world);
  const clonedPatch = clonePatch(patch);

  if (!isPlainRecord(clonedPatch)) {
    throw new WorldPatchError('invalid-patch', 'World patch must be a plain object.');
  }
  ensureExactKeys(clonedPatch, patchKeys, 'World patch');
  if (!Array.isArray(clonedPatch.operations)) {
    throw new WorldPatchError('invalid-patch', 'World patch operations must be an array.');
  }
  if (base.revision >= Number.MAX_SAFE_INTEGER) {
    throw new WorldPatchError('revision-overflow', 'World revision cannot be incremented safely.');
  }

  const entities: Record<string, WorldEntity> = { ...cloneWorldValue(base.entities) };
  const relations: Record<string, WorldRelation> = { ...cloneWorldValue(base.relations) };
  // IDs are transaction identities, not reusable slots. Removing and then
  // re-adding the same ID would disguise replacement as an in-place mutation.
  const claimedEntityIds = new Set(Object.keys(entities));
  const claimedRelationIds = new Set(Object.keys(relations));

  clonedPatch.operations.forEach((operationValue: unknown, operationIndex: number) => {
    if (!isPlainRecord(operationValue) || typeof operationValue.op !== 'string') {
      throw new WorldPatchError(
        'invalid-patch',
        'Every operation must be an object with an op discriminator.',
        operationIndex,
        operationValue,
      );
    }

    switch (operationValue.op) {
      case 'add-entity': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'entity']),
          'add-entity operation',
          operationIndex,
        );
        if (!isPlainRecord(operationValue.entity)) {
          throw new WorldPatchError(
            'invalid-patch',
            'add-entity requires an entity object.',
            operationIndex,
            operationValue.entity,
          );
        }
        const entityId = requireNonEmptyString(
          operationValue.entity.id,
          'Entity ID',
          operationIndex,
        );
        if (claimedEntityIds.has(entityId)) {
          throw new WorldPatchError(
            'duplicate-entity',
            `Entity "${entityId}" already exists.`,
            operationIndex,
          );
        }
        entities[entityId] = operationValue.entity as unknown as WorldEntity;
        claimedEntityIds.add(entityId);
        break;
      }
      case 'remove-entity': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'entityId', 'allowMissing']),
          'remove-entity operation',
          operationIndex,
        );
        const entityId = requireNonEmptyString(
          operationValue.entityId,
          'Entity ID',
          operationIndex,
        );
        if (entities[entityId] === undefined) {
          if (operationValue.allowMissing === true) {
            break;
          }
          throw new WorldPatchError(
            'missing-entity',
            `Entity "${entityId}" does not exist.`,
            operationIndex,
          );
        }
        delete entities[entityId];
        break;
      }
      case 'patch-entity': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'entityId', 'patch']),
          'patch-entity operation',
          operationIndex,
        );
        const entityId = requireNonEmptyString(
          operationValue.entityId,
          'Entity ID',
          operationIndex,
        );
        const entity = entities[entityId];
        if (entity === undefined) {
          throw new WorldPatchError(
            'missing-entity',
            `Entity "${entityId}" does not exist.`,
            operationIndex,
          );
        }
        entities[entityId] = applyEntityPatch(entity, operationValue.patch, operationIndex);
        break;
      }
      case 'add-relation': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'relation']),
          'add-relation operation',
          operationIndex,
        );
        if (!isPlainRecord(operationValue.relation)) {
          throw new WorldPatchError(
            'invalid-patch',
            'add-relation requires a relation object.',
            operationIndex,
            operationValue.relation,
          );
        }
        const relationId = requireNonEmptyString(
          operationValue.relation.id,
          'Relation ID',
          operationIndex,
        );
        if (claimedRelationIds.has(relationId)) {
          throw new WorldPatchError(
            'duplicate-relation',
            `Relation "${relationId}" already exists.`,
            operationIndex,
          );
        }
        relations[relationId] = operationValue.relation as unknown as WorldRelation;
        claimedRelationIds.add(relationId);
        break;
      }
      case 'remove-relation': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'relationId', 'allowMissing']),
          'remove-relation operation',
          operationIndex,
        );
        const relationId = requireNonEmptyString(
          operationValue.relationId,
          'Relation ID',
          operationIndex,
        );
        if (relations[relationId] === undefined) {
          if (operationValue.allowMissing === true) {
            break;
          }
          throw new WorldPatchError(
            'missing-relation',
            `Relation "${relationId}" does not exist.`,
            operationIndex,
          );
        }
        delete relations[relationId];
        break;
      }
      case 'patch-relation': {
        ensureExactKeys(
          operationValue,
          new Set(['op', 'relationId', 'patch']),
          'patch-relation operation',
          operationIndex,
        );
        const relationId = requireNonEmptyString(
          operationValue.relationId,
          'Relation ID',
          operationIndex,
        );
        const relation = relations[relationId];
        if (relation === undefined) {
          throw new WorldPatchError(
            'missing-relation',
            `Relation "${relationId}" does not exist.`,
            operationIndex,
          );
        }
        relations[relationId] = applyRelationPatch(relation, operationValue.patch, operationIndex);
        break;
      }
      default:
        throw new WorldPatchError(
          'invalid-patch',
          `Unknown operation "${operationValue.op}".`,
          operationIndex,
          operationValue,
        );
    }
  });

  const candidate: WorldSnapshot = {
    schemaVersion: 2,
    scenarioId: base.scenarioId,
    revision: base.revision + 1,
    entities,
    relations,
  };

  try {
    return freezeWorldSnapshot(candidate);
  } catch (error: unknown) {
    if (error instanceof WorldValidationError || error instanceof WorldSerializationError) {
      throw new WorldPatchError('invalid-result', error.message, undefined, error);
    }
    throw error;
  }
};

export type { WorldEntityPatch, WorldRelationPatch };
