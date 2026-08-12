import { describe, expect, it } from 'vitest';
import {
  applyWorldPatch,
  computeWorldDiff,
  freezeWorldSnapshot,
  type LocalizedText,
  type WorldEntity,
  type WorldPatch,
  type WorldSnapshot,
} from '../../src/world';
import {
  IDS,
  makeInitialWorld,
  relation,
  replacementContainerEntity,
  replacementPodEntity,
} from './fixtures';

const deletionPatch: WorldPatch = {
  operations: [
    { op: 'remove-relation', relationId: IDS.ownsOld },
    { op: 'remove-relation', relationId: IDS.schedulesOld },
    { op: 'remove-relation', relationId: IDS.containsOld },
    { op: 'remove-entity', entityId: IDS.oldContainer },
    { op: 'remove-entity', entityId: IDS.oldPod },
    {
      op: 'patch-entity',
      entityId: IDS.replicaSet,
      patch: { data: { specReplicas: 3, statusReplicas: 2, readyReplicas: 2 } },
    },
  ],
};

const replacementCreationPatch: WorldPatch = {
  operations: [
    { op: 'add-entity', entity: replacementPodEntity() },
    { op: 'add-entity', entity: replacementContainerEntity() },
    {
      op: 'add-relation',
      relation: relation(IDS.ownsNew, 'owns', IDS.replicaSet, IDS.newPod, 'ownership'),
    },
    {
      op: 'add-relation',
      relation: relation(
        IDS.containsNew,
        'contains-runtime',
        IDS.newPod,
        IDS.newContainer,
        'composition',
      ),
    },
    {
      op: 'patch-entity',
      entityId: IDS.replicaSet,
      patch: { data: { specReplicas: 3, statusReplicas: 3, readyReplicas: 2 } },
    },
  ],
};

const schedulingPatch: WorldPatch = {
  operations: [
    {
      op: 'patch-entity',
      entityId: IDS.newPod,
      patch: {
        status: 'ready',
        data: {
          nodeName: 'worker-c',
          phase: 'Running',
          conditions: {
            podScheduled: true,
            initialized: true,
            containersReady: true,
            ready: true,
          },
        },
      },
    },
    {
      op: 'patch-entity',
      entityId: IDS.newContainer,
      patch: {
        status: 'running',
        data: {
          containerID: 'containerd://synthetic-api-d-new-01',
          ready: true,
          started: true,
          state: { kind: 'running', startedAt: '2026-08-08T00:00:30Z' },
        },
      },
    },
    {
      op: 'add-relation',
      relation: relation(IDS.schedulesNew, 'scheduled-on', IDS.newPod, IDS.nodeC, 'placement'),
    },
    {
      op: 'patch-entity',
      entityId: IDS.replicaSet,
      patch: { data: { specReplicas: 3, statusReplicas: 3, readyReplicas: 3 } },
    },
  ],
};

const deletedWorld = (initial: WorldSnapshot): WorldSnapshot =>
  applyWorldPatch(initial, deletionPatch);
const pendingWorld = (initial: WorldSnapshot): WorldSnapshot =>
  applyWorldPatch(deletedWorld(initial), replacementCreationPatch);

describe('computeWorldDiff (directive 12.3)', () => {
  it('reports a restart as only Container status/data updates', () => {
    const initial = makeInitialWorld();
    const crashed = applyWorldPatch(initial, {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldContainer,
          patch: {
            status: 'terminated',
            data: {
              ready: false,
              started: false,
              state: {
                kind: 'terminated',
                reason: 'Error',
                exitCode: 1,
                finishedAt: '2026-08-08T00:00:10Z',
                containerID: 'containerd://synthetic-api-a-old-01',
              },
            },
          },
        },
      ],
    });
    const restarted = applyWorldPatch(crashed, {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldContainer,
          patch: {
            status: 'running',
            data: {
              containerID: 'containerd://synthetic-api-a-old-02',
              restartCount: 1,
              ready: true,
              started: true,
              state: { kind: 'running', startedAt: '2026-08-08T00:00:12Z' },
              lastState: {
                kind: 'terminated',
                reason: 'Error',
                exitCode: 1,
                finishedAt: '2026-08-08T00:00:10Z',
                containerID: 'containerd://synthetic-api-a-old-01',
              },
            },
          },
        },
      ],
    });

    const diff = computeWorldDiff(crashed, restarted);
    expect(diff.addedEntities).toHaveLength(0);
    expect(diff.removedEntities).toHaveLength(0);
    expect(diff.addedRelations).toHaveLength(0);
    expect(diff.removedRelations).toHaveLength(0);
    expect(diff.updatedRelations).toHaveLength(0);
    expect(diff.updatedEntities).toHaveLength(1);
    expect(diff.updatedEntities[0]).toMatchObject({
      id: IDS.oldContainer,
      changedFields: ['status', 'data'],
      changedPaths: [
        '/data/containerID',
        '/data/lastState',
        '/data/ready',
        '/data/restartCount',
        '/data/started',
        '/data/state/containerID',
        '/data/state/exitCode',
        '/data/state/finishedAt',
        '/data/state/kind',
        '/data/state/reason',
        '/data/state/startedAt',
        '/status',
      ],
    });
  });

  it('reports deletion of the Pod, Container, and all attached relations', () => {
    const initial = makeInitialWorld();
    const deleted = deletedWorld(initial);
    const diff = computeWorldDiff(initial, deleted);

    expect(diff.removedEntities.map((entity) => entity.id)).toEqual(
      [IDS.oldPod, IDS.oldContainer].sort(),
    );
    expect(diff.removedRelations.map((item) => item.id)).toEqual(
      [IDS.ownsOld, IDS.schedulesOld, IDS.containsOld].sort(),
    );
    expect(diff.updatedEntities.map((item) => item.id)).toEqual([IDS.replicaSet]);
    expect(diff.updatedEntities[0]?.changedPaths).toEqual([
      '/data/readyReplicas',
      '/data/statusReplicas',
    ]);
  });

  it('reports replacement creation as new identities and relations', () => {
    const deleted = deletedWorld(makeInitialWorld());
    const pending = applyWorldPatch(deleted, replacementCreationPatch);
    const diff = computeWorldDiff(deleted, pending);

    expect(diff.addedEntities.map((entity) => entity.id)).toEqual(
      [IDS.newPod, IDS.newContainer].sort(),
    );
    expect(diff.addedRelations.map((item) => item.id)).toEqual(
      [IDS.ownsNew, IDS.containsNew].sort(),
    );
    expect(diff.removedEntities).toHaveLength(0);
    expect(diff.updatedEntities.map((item) => item.id)).toEqual([IDS.replicaSet]);
  });

  it('reports scheduling as Pod/Container/count updates plus one placement relation', () => {
    const pending = pendingWorld(makeInitialWorld());
    const running = applyWorldPatch(pending, schedulingPatch);
    const diff = computeWorldDiff(pending, running);

    expect(diff.addedRelations.map((item) => item.id)).toEqual([IDS.schedulesNew]);
    expect(diff.updatedEntities.map((item) => item.id)).toEqual(
      [IDS.newPod, IDS.newContainer, IDS.replicaSet].sort(),
    );
    const podUpdate = diff.updatedEntities.find((item) => item.id === IDS.newPod);
    expect(podUpdate?.changedPaths).toEqual([
      '/data/conditions/containersReady',
      '/data/conditions/podScheduled',
      '/data/conditions/ready',
      '/data/nodeName',
      '/data/phase',
      '/status',
    ]);
    expect(diff.addedEntities).toHaveLength(0);
    expect(diff.removedEntities).toHaveLength(0);
  });

  it('sorts every diff collection by exact identity regardless of operation order', () => {
    const world = makeInitialWorld();
    const label = (value: string): LocalizedText => ({
      en: value,
      ja: value,
      'zh-CN': value,
    });
    const generic = (id: string): WorldEntity => ({
      id,
      category: 'external',
      kind: 'Actor',
      name: id,
      status: 'healthy',
      data: {},
      title: label(id),
      summary: label(id),
      sourceIds: [],
      visual: { archetype: 'external' },
    });

    const after = applyWorldPatch(world, {
      operations: [
        { op: 'add-entity', entity: generic('z-entity') },
        { op: 'add-entity', entity: generic('a-entity') },
        {
          op: 'add-relation',
          relation: relation('z-relation', 'references', 'z-entity', IDS.nodeA, 'configuration'),
        },
        {
          op: 'add-relation',
          relation: relation('a-relation', 'references', 'a-entity', IDS.nodeA, 'configuration'),
        },
      ],
    });

    const first = computeWorldDiff(world, after);
    const second = computeWorldDiff(world, after);
    expect(first).toEqual(second);
    expect(first.addedEntities.map((entity) => entity.id)).toEqual(['a-entity', 'z-entity']);
    expect(first.addedRelations.map((item) => item.id)).toEqual(['a-relation', 'z-relation']);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.addedEntities)).toBe(true);
  });

  it('does not report updates for equivalent records with different key insertion order', () => {
    const before = makeInitialWorld();
    const replicaSet = before.entities[IDS.replicaSet];
    expect(replicaSet).toBeDefined();
    if (replicaSet === undefined) {
      throw new Error('Fixture is incomplete.');
    }
    const after = freezeWorldSnapshot({
      ...before,
      entities: {
        ...before.entities,
        [IDS.replicaSet]: {
          ...replicaSet,
          data: { readyReplicas: 3, statusReplicas: 3, specReplicas: 3 },
        },
      },
    });

    expect(computeWorldDiff(before, after).updatedEntities).toHaveLength(0);
  });
});
