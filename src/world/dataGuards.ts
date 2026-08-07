import type {
  ContainerData,
  ContainerState,
  PodConditions,
  PodData,
  ReplicaSetData,
  TerminatedContainerState,
  WorldEntity,
} from './types';

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

const isPodConditions = (value: unknown): value is PodConditions =>
  isPlainRecord(value) &&
  typeof value.podScheduled === 'boolean' &&
  typeof value.initialized === 'boolean' &&
  typeof value.containersReady === 'boolean' &&
  typeof value.ready === 'boolean';

const isTerminatedContainerState = (value: unknown): value is TerminatedContainerState =>
  isPlainRecord(value) &&
  value.kind === 'terminated' &&
  isNonEmptyString(value.reason) &&
  isNonNegativeInteger(value.exitCode) &&
  isNonEmptyString(value.finishedAt) &&
  isNonEmptyString(value.containerID);

const isContainerState = (value: unknown): value is ContainerState => {
  if (!isPlainRecord(value)) return false;

  switch (value.kind) {
    case 'running':
      return isNonEmptyString(value.startedAt);
    case 'terminated':
      return isTerminatedContainerState(value);
    case 'waiting':
      return isNonEmptyString(value.reason);
    default:
      return false;
  }
};

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
    RESTART_POLICIES.has(value.restartPolicy as PodData['restartPolicy']) &&
    isPodConditions(value.conditions)
  );
};

export const isContainerData = (value: unknown): value is ContainerData => {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.podId) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.image) &&
    (!Object.hasOwn(value, 'containerID') ||
      value.containerID === '' ||
      isNonEmptyString(value.containerID)) &&
    isNonNegativeInteger(value.restartCount) &&
    typeof value.ready === 'boolean' &&
    typeof value.started === 'boolean' &&
    isContainerState(value.state) &&
    (!Object.hasOwn(value, 'lastState') ||
      (isTerminatedContainerState(value.lastState) &&
        value.lastState.containerID !== value.containerID)) &&
    (value.state.kind === 'waiting'
      ? !value.containerID && !value.ready && !value.started
      : isNonEmptyString(value.containerID)) &&
    (value.state.kind === 'terminated'
      ? value.containerID === value.state.containerID && !value.ready && !value.started
      : true)
  );
};

export const isReplicaSetData = (value: unknown): value is ReplicaSetData => {
  if (!isPlainRecord(value)) {
    return false;
  }

  return (
    isNonNegativeInteger(value.specReplicas) &&
    isNonNegativeInteger(value.statusReplicas) &&
    isNonNegativeInteger(value.readyReplicas) &&
    value.readyReplicas <= value.statusReplicas
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
    entity.category !== 'runtime-status' ||
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
