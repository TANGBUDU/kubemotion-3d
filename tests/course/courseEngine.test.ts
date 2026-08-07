import { describe, expect, it } from 'vitest';
import { lessonById, scenario } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import type {
  ActiveTeachingRoute,
  CompiledStep,
  LessonV2,
  TransitionCue,
} from '../../src/course/types';
import { getContainerData, getPodData, getReplicaSetData } from '../../src/world';

const loadedLesson = lessonById.get('container-restart-vs-pod-replacement');
if (!loadedLesson) throw new Error('Golden lesson is missing');
const lesson: LessonV2 = loadedLesson;
const compiled = courseEngine.compileLesson(lesson, scenario);

const OLD_POD = 'api-object:namespaced:shop:Pod:api-a-old';
const OLD_CONTAINER = 'runtime-instance:shop:Pod:api-a-old:Container:api';
const NEW_POD = 'api-object:namespaced:shop:Pod:api-d-new';
const NEW_CONTAINER = 'runtime-instance:shop:Pod:api-d-new:Container:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';
const API_SERVER = 'runtime-component:cluster:global:KubeAPIServer:kube-apiserver';
const KUBECTL = 'external:external:global:Kubectl:kubectl';

const EXPECTED_STEPS = [
  'scene-orientation',
  'healthy-baseline',
  'container-exits',
  'container-restarted',
  'kubectl-delete-pod',
  'controller-creates-replacement',
  'replacement-pending',
  'scheduler-binds-worker-c',
  'kubelet-starts-container',
  'compare-identities',
] as const;

function step(id: (typeof EXPECTED_STEPS)[number]): CompiledStep {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing compiled step ${id}`);
  return value;
}

const SCHEDULER_STEP_ID = 'scheduler-binds-worker-c';
const authoredSchedulerStep = lesson.steps.find((candidate) => candidate.id === SCHEDULER_STEP_ID);
const authoredSchedulerRoute = authoredSchedulerStep?.viewPatch.activeRoutes?.[0];
if (!authoredSchedulerStep || !authoredSchedulerRoute) {
  throw new Error('Golden scheduler teaching route is missing');
}

function lessonWithSchedulerRoutes(routes: readonly ActiveTeachingRoute[]): LessonV2 {
  return {
    ...lesson,
    steps: lesson.steps.map((candidate) =>
      candidate.id === SCHEDULER_STEP_ID
        ? { ...candidate, viewPatch: { ...candidate.viewPatch, activeRoutes: routes } }
        : candidate,
    ),
  };
}

describe('CourseEngine v2 factual timeline', () => {
  it('compiles the required ten-step lesson sequence', () => {
    expect(compiled.steps.map((candidate) => candidate.stepId)).toEqual(EXPECTED_STEPS);
    expect(lesson.steps.every((candidate) => candidate.teaching.whatChanged.en.length > 0)).toBe(
      true,
    );
    expect(lesson.steps.every((candidate) => candidate.teaching.whyItHappened.ja.length > 0)).toBe(
      true,
    );
    expect(lesson.steps.every((candidate) => candidate.teaching.takeaway['zh-CN'].length > 0)).toBe(
      true,
    );
  });

  it('models API Server mediation and the kubectl actor in the scenario', () => {
    expect(scenario.entities[API_SERVER]?.kind).toBe('KubeAPIServer');
    expect(scenario.entities[KUBECTL]?.kind).toBe('Kubectl');
    expect(scenario.relations['kubectl-requests-api-server']).toMatchObject({
      from: KUBECTL,
      to: API_SERVER,
      semantic: 'control-observation',
    });
  });

  it('starts with the old Pod and no replacement identity', () => {
    const baseline = step('healthy-baseline').world;
    expect(baseline.entities[NEW_POD]).toBeUndefined();
    expect(getPodData(baseline.entities[OLD_POD]!)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
      phase: 'Running',
    });
    expect(getContainerData(baseline.entities[OLD_CONTAINER]!)).toMatchObject({
      restartCount: 0,
      instanceGeneration: 1,
    });
    expect(baseline.entities[OLD_CONTAINER]?.status).toBe('running');
    expect(getReplicaSetData(baseline.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 3,
    });
  });

  it('terminates only the child Container', () => {
    const crashed = step('container-exits');
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
    expect(getPodData(restarted.world.entities[OLD_POD]!)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
    });
    expect(restarted.world.entities[OLD_CONTAINER]?.status).toBe('running');
    expect(getContainerData(restarted.world.entities[OLD_CONTAINER]!)).toMatchObject({
      restartCount: 1,
      instanceGeneration: 2,
    });
    expect(restarted.worldDiff.addedEntities).toHaveLength(0);
    expect(restarted.worldDiff.removedEntities).toHaveLength(0);
    expect(restarted.worldDiff.addedRelations).toHaveLength(0);
    expect(restarted.worldDiff.removedRelations).toHaveLength(0);
  });

  it('shows explicit kubectl deletion before controller replacement', () => {
    const deleted = step('kubectl-delete-pod');
    expect(deleted.world.entities[OLD_POD]).toBeUndefined();
    expect(deleted.world.entities[OLD_CONTAINER]).toBeUndefined();
    expect(deleted.world.entities[NEW_POD]).toBeUndefined();
    expect(deleted.world.relations['owns-api-a-old']).toBeUndefined();
    expect(deleted.world.relations['scheduled-api-a-old']).toBeUndefined();
    expect(getReplicaSetData(deleted.world.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 2,
      readyReplicas: 2,
    });

    const route = deleted.view.activeRoutes.find(
      (candidate) => candidate.id === 'route-kubectl-delete',
    );
    expect(route?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [KUBECTL, API_SERVER],
      [API_SERVER, OLD_POD],
    ]);
    expect(deleted.transition.cues).toContainEqual(
      expect.objectContaining({ type: 'api-request', routeId: 'route-kubectl-delete' }),
    );
  });

  it('lets the controller create a distinct Pending, unscheduled Pod', () => {
    const created = step('controller-creates-replacement');
    expect(created.world.entities[OLD_POD]).toBeUndefined();
    expect(getPodData(created.world.entities[NEW_POD]!)).toMatchObject({
      uid: 'synthetic-uid-new-d1',
      phase: 'Pending',
    });
    expect(getPodData(created.world.entities[NEW_POD]!).nodeName).toBeUndefined();
    expect(created.world.entities[NEW_CONTAINER]?.status).toBe('waiting');
    expect(created.world.relations['owns-api-d-new']).toBeDefined();
    expect(created.world.relations['scheduled-api-d-new']).toBeUndefined();
    expect(created.worldDiff.addedEntities.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([NEW_POD, NEW_CONTAINER]),
    );
    expect(getReplicaSetData(created.world.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 2,
    });
  });

  it('keeps the explicit Pending teaching beat mutation-free', () => {
    const pending = step('replacement-pending');
    expect(pending.worldDiff.addedEntities).toHaveLength(0);
    expect(pending.worldDiff.removedEntities).toHaveLength(0);
    expect(pending.worldDiff.updatedEntities).toHaveLength(0);
    expect(getPodData(pending.world.entities[NEW_POD]!).nodeName).toBeUndefined();
    expect(pending.world.entities[NEW_CONTAINER]?.status).toBe('waiting');
  });

  it('separates Scheduler binding from Container startup', () => {
    const scheduled = step('scheduler-binds-worker-c');
    expect(getPodData(scheduled.world.entities[NEW_POD]!)).toMatchObject({
      uid: 'synthetic-uid-new-d1',
      nodeName: 'worker-c',
      phase: 'Pending',
    });
    expect(scheduled.world.relations['scheduled-api-d-new']).toBeDefined();
    expect(scheduled.world.entities[NEW_CONTAINER]?.status).toBe('waiting');
    expect(getReplicaSetData(scheduled.world.entities[REPLICA_SET]!).readyReplicas).toBe(2);
    expect(scheduled.transition.cues).toContainEqual(
      expect.objectContaining({
        type: 'scheduler-assignment',
        routeId: 'route-scheduler-bind-worker-c',
      }),
    );
  });

  it('attributes Container startup and restored readiness to kubelet', () => {
    const started = step('kubelet-starts-container');
    expect(getPodData(started.world.entities[NEW_POD]!)).toMatchObject({
      uid: 'synthetic-uid-new-d1',
      nodeName: 'worker-c',
      phase: 'Running',
    });
    expect(started.world.entities[NEW_CONTAINER]?.status).toBe('running');
    expect(getContainerData(started.world.entities[NEW_CONTAINER]!).restartCount).toBe(0);
    expect(getReplicaSetData(started.world.entities[REPLICA_SET]!)).toEqual({
      desiredReplicas: 3,
      currentReplicas: 3,
      readyReplicas: 3,
    });
    expect(started.transition.cues).toContainEqual(
      expect.objectContaining({ type: 'container-start', entityId: NEW_CONTAINER }),
    );
    expect(started.transition.cues).not.toContainEqual(
      expect.objectContaining({ type: 'container-restart', entityId: NEW_CONTAINER }),
    );
  });

  it('authors visible causal offsets instead of completing every visual simultaneously', () => {
    const causalPairs = [
      ['container-restarted', 'reconcile-pulse', 'container-restart'],
      ['kubectl-delete-pod', 'api-request', 'entity-exit'],
      ['controller-creates-replacement', 'reconcile-pulse', 'entity-enter'],
      ['scheduler-binds-worker-c', 'scheduler-assignment', 'layout-transition'],
      ['kubelet-starts-container', 'reconcile-pulse', 'container-start'],
    ] as const;
    for (const [stepId, causeType, effectType] of causalPairs) {
      const transition = step(stepId).transition;
      const cause = transition.cues.find((cue) => cue.type === causeType);
      const effect = transition.cues.find((cue) => cue.type === effectType);
      expect(cause).toBeDefined();
      expect(effect).toBeDefined();
      expect(effect?.delayMs ?? 0).toBeGreaterThan(cause?.delayMs ?? 0);
    }
    expect(
      step('scheduler-binds-worker-c').transition.cues.find(
        (cue) => cue.type === 'layout-transition',
      ),
    ).toMatchObject({ entityIds: [NEW_POD] });
  });

  it('covers each factual ReplicaSet count mutation with an exact counter cue', () => {
    for (const candidate of compiled.steps) {
      const replicaSetUpdate = candidate.worldDiff.updatedEntities.find(
        (update) => update.id === REPLICA_SET,
      );
      for (const path of replicaSetUpdate?.changedPaths ?? []) {
        if (!/^\/data\/(desiredReplicas|currentReplicas|readyReplicas)$/.test(path)) continue;
        const field = path.slice(1).replace('/', '.');
        expect(candidate.transition.cues).toContainEqual(
          expect.objectContaining({ type: 'counter-change', entityId: REPLICA_SET, field }),
        );
      }
    }
  });

  it('rejects a first-start cue that is not a waiting-to-running Container transition', () => {
    const invalid: LessonV2 = {
      ...lesson,
      steps: lesson.steps.map((candidate) =>
        candidate.id === 'kubelet-starts-container'
          ? {
              ...candidate,
              transition: {
                cues: (candidate.transition?.cues ?? []).map((cue) =>
                  cue.type === 'container-start' ? { ...cue, entityId: OLD_CONTAINER } : cue,
                ),
              },
            }
          : candidate,
      ),
    };
    expect(() => courseEngine.compileLesson(invalid, scenario)).toThrow(
      'container-start target must be one Container present in both worlds',
    );
  });

  it('rejects missing causal offsets and missing ReplicaSet counter choreography', () => {
    const withoutDelay: LessonV2 = {
      ...lesson,
      steps: lesson.steps.map((candidate) => {
        if (candidate.id !== 'kubectl-delete-pod') return candidate;
        return {
          ...candidate,
          transition: {
            cues: (candidate.transition?.cues ?? []).map((cue) => {
              if (cue.type !== 'entity-exit') return cue;
              const undelayed: { delayMs?: number } & Omit<typeof cue, 'delayMs'> = { ...cue };
              delete undelayed.delayMs;
              return undelayed as TransitionCue;
            }),
          },
        };
      }),
    };
    expect(() => courseEngine.compileLesson(withoutDelay, scenario)).toThrow(
      'entity-exit must start after api-request',
    );

    const withoutReadyCounter: LessonV2 = {
      ...lesson,
      steps: lesson.steps.map((candidate) =>
        candidate.id === 'kubelet-starts-container'
          ? {
              ...candidate,
              transition: {
                cues: (candidate.transition?.cues ?? []).filter(
                  (cue) => cue.type !== 'counter-change',
                ),
              },
            }
          : candidate,
      ),
    };
    expect(() => courseEngine.compileLesson(withoutReadyCounter, scenario)).toThrow(
      'change to data.readyReplicas needs counter-change cue',
    );
  });

  it('resolves every routed cue against an authored API-mediated route', () => {
    for (const candidate of compiled.steps) {
      const routes = new Map(candidate.view.activeRoutes.map((route) => [route.id, route]));
      for (const cue of candidate.transition.cues) {
        if (!('routeId' in cue)) continue;
        expect(routes.has(cue.routeId)).toBe(true);
        expect(
          routes
            .get(cue.routeId)
            ?.hops.some((hop) => hop.fromEntityId === API_SERVER || hop.toEntityId === API_SERVER),
        ).toBe(true);
      }
    }
  });

  it('rejects missing, duplicate, and empty active routes', () => {
    expect(() => courseEngine.compileLesson(lessonWithSchedulerRoutes([]), scenario)).toThrow(
      'references missing active route',
    );
    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([authoredSchedulerRoute, authoredSchedulerRoute]),
        scenario,
      ),
    ).toThrow('Duplicate active route ID');
    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([{ ...authoredSchedulerRoute, hops: [] }]),
        scenario,
      ),
    ).toThrow('has no hops');
  });

  it('rejects route endpoint and semantic contradictions', () => {
    const [firstHop, ...remainingHops] = authoredSchedulerRoute.hops;
    if (!firstHop) throw new Error('Scheduler route has no first hop');
    const secondHop = remainingHops[0];
    if (!secondHop) throw new Error('Scheduler route has no second hop');
    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([
          {
            ...authoredSchedulerRoute,
            hops: [firstHop, { ...secondHop, fromEntityId: firstHop.fromEntityId }],
          },
        ]),
        scenario,
      ),
    ).toThrow('is discontinuous');
    const missingEntity = 'runtime-component:cluster:global:Missing:missing';
    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([
          {
            ...authoredSchedulerRoute,
            hops: [
              {
                ...firstHop,
                toEntityId: missingEntity,
              },
              { ...secondHop, fromEntityId: missingEntity },
              ...remainingHops.slice(1),
            ],
          },
        ]),
        scenario,
      ),
    ).toThrow('references missing entity');
    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([{ ...authoredSchedulerRoute, semantic: 'control' }]),
        scenario,
      ),
    ).toThrow('requires a scheduling route');
  });

  it('rejects concurrent cue ownership of the same teaching route', () => {
    const routedCue = authoredSchedulerStep.transition?.cues.find((cue) => 'routeId' in cue);
    if (!routedCue) throw new Error('Scheduler step has no routed cue');
    const duplicateCueLesson: LessonV2 = {
      ...lesson,
      steps: lesson.steps.map((candidate) =>
        candidate.id === SCHEDULER_STEP_ID
          ? {
              ...candidate,
              transition: {
                cues: [...(candidate.transition?.cues ?? []), routedCue],
              },
            }
          : candidate,
      ),
    };
    expect(() => courseEngine.compileLesson(duplicateCueLesson, scenario)).toThrow(
      'cannot animate the same active route more than once',
    );
  });

  it('generates evidence from snapshots and diffs instead of authored prose', () => {
    expect(step('scene-orientation').evidence).toEqual([]);
    expect(step('healthy-baseline').evidence.length).toBeGreaterThan(0);
    expect(step('container-restarted').evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: OLD_CONTAINER,
          path: '/data/restartCount',
          change: 'changed',
          before: expect.objectContaining({ en: '0' }),
          after: expect.objectContaining({ en: '1' }),
        }),
      ]),
    );
    expect(step('kubectl-delete-pod').evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: OLD_POD, change: 'removed' })]),
    );
  });

  it('builds the comparison from compiled snapshots', () => {
    const comparison = step('compare-identities').view.comparison;
    const restartCount = comparison?.rows.find(
      (row) => row.property.en === 'Container restart count',
    );
    expect(restartCount?.containerRestart.en).toContain('0');
    expect(restartCount?.containerRestart.en).toContain('1');
    expect(comparison?.rows.map((row) => row.podReplacement.en).join(' ')).toContain(
      'synthetic-uid-new-d1',
    );
  });

  it('makes direct compilation equal sequential compilation', () => {
    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
  });

  it('deep-freezes factual, evidence, and view outputs', () => {
    const baseline = step('healthy-baseline');
    expect(Object.isFrozen(baseline)).toBe(true);
    expect(Object.isFrozen(baseline.world)).toBe(true);
    expect(Object.isFrozen(baseline.world.entities[OLD_POD])).toBe(true);
    expect(Object.isFrozen(baseline.evidence)).toBe(true);
    expect(Object.isFrozen(baseline.evidence[0])).toBe(true);
    expect(Object.isFrozen(baseline.view.entityStates)).toBe(true);
  });
});
