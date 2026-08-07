import { describe, expect, it } from 'vitest';
import {
  applyWorldPatch,
  getContainerData,
  getPodData,
  getReplicaSetData,
  getWorldSnapshotValidationIssues,
  isContainerData,
  isPodData,
  isReplicaSetData,
  validateWorldSnapshot,
  WorldPatchError,
  WorldValidationError,
  type WorldPatch,
  type WorldSnapshot,
} from '../../src/world';
import { IDS, makeInitialWorld, relation } from './fixtures';

const expectPatchCode = (action: () => unknown, code: WorldPatchError['code']): void => {
  try {
    action();
    throw new Error('Expected patch application to fail.');
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(WorldPatchError);
    if (error instanceof WorldPatchError) {
      expect(error.code).toBe(code);
    }
  }
};

describe('world data guards and snapshot validation', () => {
  it('narrows the Kubernetes data required by the golden lesson', () => {
    const world = makeInitialWorld();
    const pod = world.entities[IDS.oldPod];
    const container = world.entities[IDS.oldContainer];
    const replicaSet = world.entities[IDS.replicaSet];
    expect(pod).toBeDefined();
    expect(container).toBeDefined();
    expect(replicaSet).toBeDefined();
    if (pod === undefined || container === undefined || replicaSet === undefined) {
      throw new Error('Fixture is incomplete.');
    }

    expect(isPodData(pod.data)).toBe(true);
    expect(getPodData(pod)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
      phase: 'Running',
    });
    expect(isContainerData(container.data)).toBe(true);
    expect(getContainerData(container)).toMatchObject({ restartCount: 0, instanceGeneration: 1 });
    expect(isReplicaSetData(replicaSet.data)).toBe(true);
    expect(getReplicaSetData(replicaSet)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 3,
    });

    expect(isPodData({ uid: 'x', phase: 'running', restartPolicy: 'Always' })).toBe(false);
    expect(
      isContainerData({ podId: 'p', restartCount: -1, instanceGeneration: 0, image: 'x' }),
    ).toBe(false);
    expect(isReplicaSetData({ desiredReplicas: 3, currentReplicas: 2, readyReplicas: 3 })).toBe(
      false,
    );
  });

  it('rejects non-serializable data, record-key mismatches, and dangling endpoints', () => {
    const invalid = structuredClone(makeInitialWorld()) as unknown as Record<string, unknown>;
    const entities = invalid.entities as Record<string, Record<string, unknown>>;
    const oldPod = entities[IDS.oldPod];
    expect(oldPod).toBeDefined();
    if (oldPod !== undefined) {
      oldPod.data = { createdAt: new Date() };
    }
    const relations = invalid.relations as Record<string, Record<string, unknown>>;
    const scheduled = relations[IDS.schedulesOld];
    expect(scheduled).toBeDefined();
    if (scheduled !== undefined) {
      scheduled.to = 'missing-node';
    }
    if (oldPod !== undefined) {
      oldPod.id = 'different-record-key';
    }

    const issues = getWorldSnapshotValidationIssues(invalid);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['non-serializable', 'record-key-mismatch', 'dangling-relation']),
    );
    expect(() => validateWorldSnapshot(invalid)).toThrow(WorldValidationError);
  });
});

describe('applyWorldPatch transaction validation (directive 12.2)', () => {
  it('rejects a duplicate entity ID', () => {
    const world = makeInitialWorld();
    const entity = world.entities[IDS.nodeA];
    expect(entity).toBeDefined();
    if (entity === undefined) {
      throw new Error('Fixture is incomplete.');
    }

    expectPatchCode(
      () => applyWorldPatch(world, { operations: [{ op: 'add-entity', entity }] }),
      'duplicate-entity',
    );

    expectPatchCode(
      () =>
        applyWorldPatch(world, {
          operations: [
            { op: 'remove-entity', entityId: IDS.nodeC },
            { op: 'add-entity', entity: world.entities[IDS.nodeC] as typeof entity },
          ],
        }),
      'duplicate-entity',
    );
  });

  it('rejects removing a missing entity unless allowMissing is explicit', () => {
    const world = makeInitialWorld();
    expectPatchCode(
      () =>
        applyWorldPatch(world, {
          operations: [{ op: 'remove-entity', entityId: 'missing' }],
        }),
      'missing-entity',
    );

    const next = applyWorldPatch(world, {
      operations: [{ op: 'remove-entity', entityId: 'missing', allowMissing: true }],
    });
    expect(next.revision).toBe(world.revision + 1);
    expect(next.entities).toEqual(world.entities);
  });

  it('rejects an entity removal that leaves relations or runtime children dangling', () => {
    const world = makeInitialWorld();
    expectPatchCode(
      () =>
        applyWorldPatch(world, {
          operations: [{ op: 'remove-entity', entityId: IDS.oldPod }],
        }),
      'invalid-result',
    );
  });

  it('allows relation cleanup in the same atomic patch independent of operation order', () => {
    const world = makeInitialWorld();
    const next = applyWorldPatch(world, {
      operations: [
        { op: 'remove-entity', entityId: IDS.oldPod },
        { op: 'remove-relation', relationId: IDS.schedulesOld },
        { op: 'remove-entity', entityId: IDS.oldContainer },
        { op: 'remove-relation', relationId: IDS.containsOld },
        { op: 'remove-relation', relationId: IDS.ownsOld },
      ],
    });

    expect(next.entities[IDS.oldPod]).toBeUndefined();
    expect(next.entities[IDS.oldContainer]).toBeUndefined();
    expect(Object.values(next.relations).some((item) => item.from === IDS.oldPod)).toBe(false);
  });

  it('rejects adding a relation with a missing endpoint', () => {
    const world = makeInitialWorld();
    expectPatchCode(
      () =>
        applyWorldPatch(world, {
          operations: [
            {
              op: 'add-relation',
              relation: relation(
                'owns-missing',
                'owns',
                IDS.replicaSet,
                'missing-pod',
                'ownership',
              ),
            },
          ],
        }),
      'invalid-result',
    );
  });

  it('forbids changing entity or relation identity through a patch', () => {
    const world = makeInitialWorld();
    const invalidEntityPatch = {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldPod,
          patch: { id: 'silently-replaced' },
        },
      ],
    } as unknown as WorldPatch;
    expectPatchCode(() => applyWorldPatch(world, invalidEntityPatch), 'identity-change');

    const invalidRelationPatch = {
      operations: [
        {
          op: 'patch-relation',
          relationId: IDS.ownsOld,
          patch: { id: 'changed-relation' },
        },
      ],
    } as unknown as WorldPatch;
    expectPatchCode(() => applyWorldPatch(world, invalidRelationPatch), 'identity-change');
  });

  it('does not pollute the input when a later operation fails', () => {
    const world = makeInitialWorld();
    const before = structuredClone(world);
    const node = world.entities[IDS.nodeA];
    expect(node).toBeDefined();
    if (node === undefined) {
      throw new Error('Fixture is incomplete.');
    }

    expectPatchCode(
      () =>
        applyWorldPatch(world, {
          operations: [
            {
              op: 'patch-entity',
              entityId: IDS.oldContainer,
              patch: { data: { restartCount: 99 } },
            },
            { op: 'add-entity', entity: node },
          ],
        }),
      'duplicate-entity',
    );

    expect(world).toEqual(before);
    const container = world.entities[IDS.oldContainer];
    expect(container).toBeDefined();
    if (container !== undefined) {
      expect(getContainerData(container).restartCount).toBe(0);
    }
  });

  it('patches relation endpoints and canonical Pod placement in one transaction', () => {
    const world = makeInitialWorld();
    const next = applyWorldPatch(world, {
      operations: [
        {
          op: 'patch-relation',
          relationId: IDS.schedulesOld,
          patch: { to: IDS.nodeC },
        },
        {
          op: 'patch-entity',
          entityId: IDS.oldPod,
          patch: { data: { nodeName: 'worker-c' } },
        },
      ],
    });

    expect(next.relations[IDS.schedulesOld]?.to).toBe(IDS.nodeC);
    const pod = next.entities[IDS.oldPod];
    expect(pod).toBeDefined();
    if (pod !== undefined) {
      expect(getPodData(pod).nodeName).toBe('worker-c');
    }
  });

  it('returns a detached deeply frozen canonical snapshot', () => {
    const world = makeInitialWorld();
    const next = applyWorldPatch(world, {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldPod,
          patch: { labels: { tier: 'backend' }, data: { phase: 'Running' } },
        },
      ],
    });

    expect(Object.isFrozen(next)).toBe(true);
    expect(Object.isFrozen(next.entities)).toBe(true);
    expect(Object.isFrozen(next.entities[IDS.oldPod]?.data)).toBe(true);
    expect(next.entities[IDS.oldPod]?.labels).toEqual({ app: 'api', tier: 'backend' });
    expect(next).not.toBe(world);
  });

  it('replaying the same operation sequence from the same snapshot is deterministic', () => {
    const world = makeInitialWorld();
    const crash: WorldPatch = {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldContainer,
          patch: { status: 'terminated' },
        },
      ],
    };
    const restart: WorldPatch = {
      operations: [
        {
          op: 'patch-entity',
          entityId: IDS.oldContainer,
          patch: {
            status: 'running',
            data: { restartCount: 1, instanceGeneration: 2 },
          },
        },
      ],
    };

    const compile = (initial: WorldSnapshot): WorldSnapshot =>
      applyWorldPatch(applyWorldPatch(initial, crash), restart);
    expect(compile(world)).toEqual(compile(world));
  });
});
