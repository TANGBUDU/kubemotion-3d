import { describe, expect, it } from 'vitest';
import { lessonById, scenario } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { getContainerData, getPodData, getReplicaSetData } from '../../src/world';
import type { CompiledStep } from '../../src/course/types';

const lesson = lessonById.get('container-restart-vs-pod-replacement');
if (!lesson) throw new Error('Golden lesson is missing');
const compiled = courseEngine.compileLesson(lesson, scenario);

const OLD_POD = 'api-object:namespaced:shop:Pod:api-a-old';
const OLD_CONTAINER = 'runtime-instance:shop:Pod:api-a-old:Container:api';
const NEW_POD = 'api-object:namespaced:shop:Pod:api-d-new';
const NEW_CONTAINER = 'runtime-instance:shop:Pod:api-d-new:Container:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';

function step(id: string): CompiledStep {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing compiled step ${id}`);
  return value;
}

describe('CourseEngine v2 factual timeline', () => {
  it('starts with the old Pod and no replacement identity', () => {
    const healthy = step('healthy-pod').world;
    expect(healthy.entities[NEW_POD]).toBeUndefined();
    const pod = healthy.entities[OLD_POD];
    const container = healthy.entities[OLD_CONTAINER];
    const replicaSet = healthy.entities[REPLICA_SET];
    expect(pod && getPodData(pod)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
      phase: 'Running',
    });
    expect(container && getContainerData(container)).toMatchObject({
      restartCount: 0,
      instanceGeneration: 1,
    });
    expect(container?.status).toBe('running');
    expect(replicaSet && getReplicaSetData(replicaSet)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 3,
    });
  });

  it('terminates only the child Container', () => {
    const crashed = step('container-exits');
    expect(crashed.world.entities[OLD_POD]).toBeDefined();
    expect(getPodData(crashed.world.entities[OLD_POD]!)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
    });
    expect(crashed.world.entities[OLD_CONTAINER]?.status).toBe('terminated');
    expect(crashed.world.entities[NEW_POD]).toBeUndefined();
    expect(crashed.worldDiff.addedEntities).toHaveLength(0);
    expect(crashed.worldDiff.removedEntities).toHaveLength(0);
  });

  it('restarts a new Container generation inside the same Pod', () => {
    const restarted = step('container-restarted');
    const pod = restarted.world.entities[OLD_POD]!;
    const container = restarted.world.entities[OLD_CONTAINER]!;
    expect(getPodData(pod)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
    });
    expect(container.status).toBe('running');
    expect(getContainerData(container)).toMatchObject({ restartCount: 1, instanceGeneration: 2 });
    expect(restarted.worldDiff.addedEntities).toHaveLength(0);
    expect(restarted.worldDiff.removedEntities).toHaveLength(0);
    expect(restarted.worldDiff.addedRelations).toHaveLength(0);
    expect(restarted.worldDiff.removedRelations).toHaveLength(0);
  });

  it('atomically removes the old Pod identity and drops ReplicaSet counts', () => {
    const deleted = step('pod-deleted').world;
    expect(deleted.entities[OLD_POD]).toBeUndefined();
    expect(deleted.entities[OLD_CONTAINER]).toBeUndefined();
    expect(deleted.relations['owns-api-a-old']).toBeUndefined();
    expect(deleted.relations['scheduled-api-a-old']).toBeUndefined();
    expect(deleted.entities[NEW_POD]).toBeUndefined();
    expect(getReplicaSetData(deleted.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 2,
      readyReplicas: 2,
    });
  });

  it('creates a distinct Pending Pod before scheduling it', () => {
    const pending = step('replacement-pending').world;
    expect(pending.entities[OLD_POD]).toBeUndefined();
    const pod = pending.entities[NEW_POD]!;
    const data = getPodData(pod);
    expect(data.uid).toBe('synthetic-uid-new-d1');
    expect(data.uid).not.toBe('synthetic-uid-old-a1');
    expect(data.nodeName).toBeUndefined();
    expect(data.phase).toBe('Pending');
    expect(pending.relations['owns-api-d-new']).toBeDefined();
    expect(pending.relations['scheduled-api-d-new']).toBeUndefined();
    expect(pending.entities[NEW_CONTAINER]?.status).toBe('waiting');
    expect(getReplicaSetData(pending.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 2,
    });
  });

  it('schedules the new Pod on worker-c and restores readiness', () => {
    const running = step('replacement-running').world;
    expect(running.entities[OLD_POD]).toBeUndefined();
    expect(getPodData(running.entities[NEW_POD]!)).toMatchObject({
      uid: 'synthetic-uid-new-d1',
      nodeName: 'worker-c',
      phase: 'Running',
    });
    expect(running.relations['scheduled-api-d-new']).toBeDefined();
    expect(running.entities[NEW_CONTAINER]?.status).toBe('running');
    expect(getContainerData(running.entities[NEW_CONTAINER]!).restartCount).toBe(0);
    expect(getReplicaSetData(running.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 3,
    });
  });

  it('builds the comparison from compiled snapshots', () => {
    const comparison = step('compare-identities').view.comparison;
    expect(comparison?.rows.map((row) => row.containerRestart)).toContain('0 → 1');
    expect(comparison?.rows.map((row) => row.podReplacement).join(' ')).toContain(
      'synthetic-uid-new-d1',
    );
  });

  it('makes direct compilation equal sequential compilation', () => {
    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
  });

  it('deep-freezes factual and view outputs', () => {
    const healthy = step('healthy-pod');
    expect(Object.isFrozen(healthy)).toBe(true);
    expect(Object.isFrozen(healthy.world)).toBe(true);
    expect(Object.isFrozen(healthy.world.entities[OLD_POD])).toBe(true);
    expect(Object.isFrozen(healthy.view.entityStates)).toBe(true);
  });
});
