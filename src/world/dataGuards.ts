import type { ContainerData, PodData, ReplicaSetData, WorldEntity } from './types';

export const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

const POD_PHASES: ReadonlySet<PodData['phase']> = new Set([
  'Pending',
  'Running',
  'Succeeded',
  'Failed',
  'Unknown',
]);

const RESTART_POLICIES: ReadonlySet<PodData['restartPolicy']> = new Set([
  'Always',
  'OnFailure',
  'Never',
]);

export const isPodData = (value: unknown): value is PodData => {
  if (!isPlainRecord(value)) {
    return false;
  }

  const nodeNameIsValid =
    !Object.hasOwn(value, 'nodeName') ||
    (typeof value.nodeName === 'string' && value.nodeName.length > 0);

  return (
    isNonEmptyString(value.uid) &&
    nodeNameIsValid &&
    typeof value.phase === 'string' &&
    POD_PHASES.has(value.phase as PodData['phase']) &&
    typeof value.restartPolicy === 'string' &&
    RESTART_POLICIES.has(value.restartPolicy as PodData['restartPolicy'])
  );
};

export const isContainerData = (value: unknown): value is ContainerData => {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.podId) &&
    isNonNegativeInteger(value.restartCount) &&
    isNonNegativeInteger(value.instanceGeneration) &&
    value.instanceGeneration >= 1 &&
    isNonEmptyString(value.image)
  );
};

export const isReplicaSetData = (value: unknown): value is ReplicaSetData => {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.desiredReplicas) &&
    isNonNegativeInteger(value.currentReplicas) &&
    isNonNegativeInteger(value.readyReplicas) &&
    value.readyReplicas <= value.currentReplicas
  );
};

export class WorldDataError extends Error {
  public readonly entityId: string;

  public constructor(
    entity: WorldEntity,
    expected: 'PodData' | 'ContainerData' | 'ReplicaSetData',
  ) {
    super(`Entity "${entity.id}" does not contain valid ${expected}.`);
    this.name = 'WorldDataError';
    this.entityId = entity.id;
  }
}

export const getPodData = (entity: WorldEntity): PodData => {
  if (entity.kind !== 'Pod' || !isPodData(entity.data)) {
    throw new WorldDataError(entity, 'PodData');
  }
  return entity.data;
};

export const getContainerData = (entity: WorldEntity): ContainerData => {
  if (
    entity.kind !== 'Container' ||
    entity.category !== 'runtime-instance' ||
    !isContainerData(entity.data)
  ) {
    throw new WorldDataError(entity, 'ContainerData');
  }
  return entity.data;
};

export const getReplicaSetData = (entity: WorldEntity): ReplicaSetData => {
  if (entity.kind !== 'ReplicaSet' || !isReplicaSetData(entity.data)) {
    throw new WorldDataError(entity, 'ReplicaSetData');
  }
  return entity.data;
};
