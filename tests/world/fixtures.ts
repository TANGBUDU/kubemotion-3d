import {
  freezeWorldSnapshot,
  type LocalizedText,
  type WorldEntity,
  type WorldRelation,
  type WorldSnapshot,
} from '../../src/world';

export const IDS = {
  nodeA: 'infrastructure:Node:worker-a',
  nodeC: 'infrastructure:Node:worker-c',
  replicaSet: 'api-object:namespaced:shop:ReplicaSet:api-rs',
  oldPod: 'api-object:namespaced:shop:Pod:api-a-old',
  oldContainer: 'runtime-instance:shop:Pod:api-a-old:Container:api',
  newPod: 'api-object:namespaced:shop:Pod:api-d-new',
  newContainer: 'runtime-instance:shop:Pod:api-d-new:Container:api',
  ownsOld: 'owns-api-rs-api-a-old',
  schedulesOld: 'schedules-api-a-old-worker-a',
  containsOld: 'contains-api-a-old-container-api',
  ownsNew: 'owns-api-rs-api-d-new',
  schedulesNew: 'schedules-api-d-new-worker-c',
  containsNew: 'contains-api-d-new-container-api',
} as const;

const text = (value: string): LocalizedText => ({
  en: value,
  ja: value,
  'zh-CN': value,
});

const node = (id: string, name: string): WorldEntity => ({
  id,
  category: 'infrastructure',
  kind: 'Node',
  name,
  status: 'ready',
  data: {},
  title: text(name),
  summary: text(`${name} worker`),
  sourceIds: ['pod-lifecycle'],
  visual: { archetype: 'node', size: 'lg' },
});

export const oldPodEntity = (): WorldEntity => ({
  id: IDS.oldPod,
  category: 'api-object',
  kind: 'Pod',
  name: 'api-7f8d9-a',
  namespace: 'shop',
  labels: { app: 'api' },
  status: 'ready',
  data: {
    uid: 'synthetic-uid-old-a1',
    nodeName: 'worker-a',
    phase: 'Running',
    restartPolicy: 'Always',
  },
  title: text('api-a-old'),
  summary: text('Original API Pod'),
  sourceIds: ['pod-lifecycle'],
  visual: { archetype: 'pod', size: 'md', group: 'api' },
});

export const oldContainerEntity = (status: 'running' | 'terminated' = 'running'): WorldEntity => ({
  id: IDS.oldContainer,
  category: 'runtime-instance',
  kind: 'Container',
  name: 'api',
  namespace: 'shop',
  status,
  data: {
    podId: IDS.oldPod,
    image: 'ghcr.io/example/api:v1',
    restartCount: 0,
    instanceGeneration: 1,
  },
  title: text('api Container'),
  summary: text('Runtime instance inside api-a-old'),
  sourceIds: ['pod-lifecycle'],
  visual: { archetype: 'container', size: 'sm' },
});

export const replacementPodEntity = (): WorldEntity => ({
  id: IDS.newPod,
  category: 'api-object',
  kind: 'Pod',
  name: 'api-7f8d9-d',
  namespace: 'shop',
  labels: { app: 'api' },
  status: 'pending',
  data: {
    uid: 'synthetic-uid-new-d1',
    phase: 'Pending',
    restartPolicy: 'Always',
  },
  title: text('api-d-new'),
  summary: text('New replacement Pod'),
  sourceIds: ['pod-lifecycle'],
  visual: { archetype: 'pod', size: 'md', group: 'api' },
});

export const replacementContainerEntity = (): WorldEntity => ({
  id: IDS.newContainer,
  category: 'runtime-instance',
  kind: 'Container',
  name: 'api',
  namespace: 'shop',
  status: 'waiting',
  data: {
    podId: IDS.newPod,
    image: 'ghcr.io/example/api:v1',
    restartCount: 0,
    instanceGeneration: 1,
  },
  title: text('new api Container'),
  summary: text('Runtime instance inside api-d-new'),
  sourceIds: ['pod-lifecycle'],
  visual: { archetype: 'container', size: 'sm' },
});

export const relation = (
  id: string,
  type: WorldRelation['type'],
  from: string,
  to: string,
  semantic: WorldRelation['semantic'],
): WorldRelation => ({
  id,
  type,
  from,
  to,
  directed: true,
  semantic,
  title: text(id),
  sourceIds: ['pod-lifecycle'],
});

export const makeInitialWorld = (): WorldSnapshot => {
  const replicaSet: WorldEntity = {
    id: IDS.replicaSet,
    category: 'api-object',
    kind: 'ReplicaSet',
    name: 'api-rs',
    namespace: 'shop',
    status: 'ready',
    data: { desiredReplicas: 3, currentReplicas: 3, readyReplicas: 3 },
    title: text('api-rs'),
    summary: text('Keeps three API Pods running'),
    sourceIds: ['replicaset'],
    visual: { archetype: 'replicaset', size: 'md' },
  };

  const entities: Record<string, WorldEntity> = {
    [IDS.oldContainer]: oldContainerEntity(),
    [IDS.replicaSet]: replicaSet,
    [IDS.nodeC]: node(IDS.nodeC, 'worker-c'),
    [IDS.oldPod]: oldPodEntity(),
    [IDS.nodeA]: node(IDS.nodeA, 'worker-a'),
  };
  const relations: Record<string, WorldRelation> = {
    [IDS.schedulesOld]: relation(
      IDS.schedulesOld,
      'scheduled-on',
      IDS.oldPod,
      IDS.nodeA,
      'placement',
    ),
    [IDS.containsOld]: relation(
      IDS.containsOld,
      'contains-runtime',
      IDS.oldPod,
      IDS.oldContainer,
      'composition',
    ),
    [IDS.ownsOld]: relation(IDS.ownsOld, 'owns', IDS.replicaSet, IDS.oldPod, 'ownership'),
  };

  return freezeWorldSnapshot({
    schemaVersion: 2,
    scenarioId: 'container-restart-vs-pod-replacement',
    revision: 0,
    entities,
    relations,
  });
};
