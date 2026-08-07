import { describe, expect, it } from 'vitest';
import { lessonById, scenario } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { humanizeWorldDiff } from '../../src/course/diff/humanizeWorldDiff';

const lesson = lessonById.get('container-restart-vs-pod-replacement');
if (!lesson) throw new Error('Golden lesson is missing');
const compiled = courseEngine.compileLesson(lesson, scenario);

const OLD_POD = 'api-object:namespaced:shop:Pod:api-a-old';
const OLD_CONTAINER = 'container-status:shop:Pod:api-a-old:Container:api';
const NEW_POD = 'api-object:namespaced:shop:Pod:api-d-new';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';

function step(id: string) {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing compiled step ${id}`);
  return value;
}

describe('humanizeWorldDiff', () => {
  it('derives compact snapshot rows from typed entity data', () => {
    const baseline = step('healthy-baseline');
    const rows = humanizeWorldDiff(baseline.beforeWorld, baseline.world, baseline.worldDiff, {
      mode: 'snapshot',
      entityIds: [OLD_POD, OLD_CONTAINER],
    });

    expect(rows.map((row) => [row.entityId, row.path, row.after?.en])).toEqual([
      [OLD_POD, '/data/uid', 'synthetic-uid-old-a1'],
      [OLD_POD, '/data/nodeName', 'worker-a'],
      [OLD_POD, '/data/phase', 'Running'],
      [OLD_POD, '/data/conditions/containersReady', 'true'],
      [OLD_POD, '/data/conditions/ready', 'true'],
      [OLD_CONTAINER, '/data/containerID', 'containerd://synthetic-api-a-old-01'],
      [OLD_CONTAINER, '/data/restartCount', '0'],
      [OLD_CONTAINER, '/data/state/kind', 'running'],
    ]);
    expect(rows.every((row) => row.before === undefined && row.change === 'unchanged')).toBe(true);
  });

  it('generates before/after changes from WorldDiff and filters by selected entities', () => {
    const restarted = step('container-restarted');
    const rows = humanizeWorldDiff(restarted.beforeWorld, restarted.world, restarted.worldDiff, {
      mode: 'diff',
      entityIds: [OLD_CONTAINER],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/data/restartCount',
          change: 'changed',
          before: expect.objectContaining({ en: '0' }),
          after: expect.objectContaining({ en: '1' }),
        }),
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/data/containerID',
          change: 'changed',
          before: expect.objectContaining({ en: 'containerd://synthetic-api-a-old-01' }),
          after: expect.objectContaining({ en: 'containerd://synthetic-api-a-old-02' }),
        }),
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/data/lastState/reason',
          after: expect.objectContaining({ en: 'Error' }),
        }),
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/data/lastState/exitCode',
          after: expect.objectContaining({ en: '1' }),
        }),
      ]),
    );
    expect(rows.every((row) => row.entityId === OLD_CONTAINER)).toBe(true);
  });

  it('keeps renderer status changes out of learner evidence while preserving Pod facts', () => {
    const exited = step('container-exits');
    const podUpdate = exited.worldDiff.updatedEntities.find((update) => update.id === OLD_POD);
    expect(podUpdate?.changedPaths).toContain('/status');

    const rows = humanizeWorldDiff(exited.beforeWorld, exited.world, exited.worldDiff, {
      mode: 'diff-with-context',
      entityIds: [OLD_POD],
    });

    expect(rows.some((row) => row.path === '/status')).toBe(false);
    expect(rows.some((row) => row.label.en === 'Pod status')).toBe(false);
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/data/conditions/containersReady',
          before: expect.objectContaining({ en: 'true' }),
          after: expect.objectContaining({ en: 'false' }),
        }),
        expect.objectContaining({
          path: '/data/conditions/ready',
          before: expect.objectContaining({ en: 'true' }),
          after: expect.objectContaining({ en: 'false' }),
        }),
        expect.objectContaining({
          path: '/data/phase',
          change: 'unchanged',
          after: expect.objectContaining({ en: 'Running' }),
        }),
      ]),
    );
  });

  it('uses identity rows for removals and a single combined ReplicaSet row', () => {
    const deleted = step('kubectl-delete-pod');
    const rows = humanizeWorldDiff(deleted.beforeWorld, deleted.world, deleted.worldDiff, {
      mode: 'diff',
      entityIds: [OLD_POD, OLD_CONTAINER, REPLICA_SET],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ entityId: OLD_POD, path: '/identity', change: 'removed' }),
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/identity',
          change: 'removed',
        }),
        expect.objectContaining({
          entityId: REPLICA_SET,
          path: '/data/replicas',
          change: 'changed',
          before: expect.objectContaining({ en: 'SPEC 3 · OBSERVED 3 · READY 3' }),
          after: expect.objectContaining({ en: 'SPEC 3 · OBSERVED 2 · READY 2' }),
        }),
      ]),
    );
    expect(rows.filter((row) => row.entityId === REPLICA_SET)).toHaveLength(1);
    expect(rows.slice(0, 3).map((row) => row.path)).toEqual([
      '/identity',
      '/identity',
      '/data/replicas',
    ]);
  });

  it('keeps changed rows ahead of context and removes duplicate fields', () => {
    const scheduled = step('scheduler-binds-worker-c');
    const rows = humanizeWorldDiff(scheduled.beforeWorld, scheduled.world, scheduled.worldDiff, {
      mode: 'diff-with-context',
      entityIds: [NEW_POD, REPLICA_SET],
    });
    const nodeRows = rows.filter(
      (row) => row.entityId === NEW_POD && row.path === '/data/nodeName',
    );

    expect(nodeRows).toEqual([
      expect.objectContaining({
        change: 'changed',
        before: expect.objectContaining({ en: 'Unscheduled' }),
        after: expect.objectContaining({ en: 'worker-c' }),
      }),
    ]);
    expect(rows.length).toBeLessThanOrEqual(8);
  });

  it('prioritizes runtime replacement, termination history, readiness, and Pod identity', () => {
    const restarted = step('container-restarted');
    expect(restarted.evidence.map((row) => row.path)).toEqual([
      '/data/containerID',
      '/data/restartCount',
      '/data/lastState/reason',
      '/data/lastState/exitCode',
      '/data/conditions/ready',
      '/data/replicas',
      '/data/uid',
      '/data/nodeName',
    ]);
  });

  it('puts readiness and runtime-state changes ahead of unchanged identity context', () => {
    const ready = step('kubelet-starts-container');
    expect(ready.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/data/containerID', change: 'changed' }),
        expect.objectContaining({ path: '/data/conditions/ready', change: 'changed' }),
        expect.objectContaining({ path: '/data/replicas', change: 'changed' }),
      ]),
    );
  });

  it('validates requests and returns deeply frozen rows', () => {
    const baseline = step('healthy-baseline');
    expect(() =>
      humanizeWorldDiff(baseline.beforeWorld, baseline.world, baseline.worldDiff, {
        mode: 'snapshot',
        entityIds: [OLD_POD, OLD_POD],
      }),
    ).toThrow('Evidence request contains duplicate entity IDs');
    expect(() =>
      humanizeWorldDiff(baseline.beforeWorld, baseline.world, baseline.worldDiff, {
        mode: 'snapshot',
        entityIds: ['api-object:namespaced:shop:Pod:missing'],
      }),
    ).toThrow('Evidence request references missing entity');

    const rows = humanizeWorldDiff(baseline.beforeWorld, baseline.world, baseline.worldDiff, {
      mode: 'snapshot',
      entityIds: [OLD_POD],
    });
    expect(Object.isFrozen(rows)).toBe(true);
    expect(Object.isFrozen(rows[0])).toBe(true);
    expect(Object.isFrozen(rows[0]?.after)).toBe(true);
  });
});
