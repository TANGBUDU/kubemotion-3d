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
const OLD_CONTAINER = 'container-status:shop:Pod:api-a-old:Container:api';
const NEW_POD = 'api-object:namespaced:shop:Pod:api-d-new';
const NEW_CONTAINER = 'container-status:shop:Pod:api-d-new:Container:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';
const API_SERVER = 'runtime-component:cluster:global:KubeAPIServer:kube-apiserver';
const CLUSTER_FOUNDATION = 'infrastructure:cluster:global:Cluster:demo-shop';
const ETCD = 'runtime-component:cluster:global:Etcd:etcd';
const KUBELET_A = 'runtime-component:node:worker-a:Kubelet:kubelet';
const KUBELET_B = 'runtime-component:node:worker-b:Kubelet:kubelet';
const CONTAINER_RUNTIMES = ['worker-a', 'worker-b', 'worker-c'].map(
  (nodeName) => `runtime-component:node:${nodeName}:ContainerRuntime:runtime`,
);
const CONTROLLER_MANAGER =
  'runtime-component:cluster:global:ControllerManager:kube-controller-manager';
const SCHEDULER = 'runtime-component:cluster:global:Scheduler:kube-scheduler';
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

const RESTART_STEP_ID = 'container-restarted';
const localRestartRoute: ActiveTeachingRoute = {
  id: 'route-local-container-restart',
  semantic: 'node-runtime',
  label: {
    en: 'restart locally',
    ja: 'ローカルで再起動',
    'zh-CN': '本地重启',
  },
  persistAfterAnimation: true,
  hops: [
    {
      fromEntityId: KUBELET_A,
      fromAnchor: 'control',
      toEntityId: OLD_CONTAINER,
      toAnchor: 'control',
    },
  ],
};

function lessonWithLocalRestartRoute(route: ActiveTeachingRoute): LessonV2 {
  return {
    ...lesson,
    steps: lesson.steps.map((candidate) => {
      if (candidate.id !== RESTART_STEP_ID) return candidate;
      const retainedCues = (candidate.transition?.cues ?? []).filter(
        (cue) =>
          cue.type !== 'reconcile-pulse' &&
          cue.type !== 'container-restart' &&
          cue.type !== 'node-runtime-restart',
      );
      return {
        ...candidate,
        viewPatch: { ...candidate.viewPatch, activeRoutes: [route] },
        transition: {
          cues: [
            {
              type: 'node-runtime-restart',
              routeId: route.id,
              entityId: OLD_CONTAINER,
              durationMs: 760,
            },
            ...retainedCues,
          ],
        },
      };
    }),
  };
}

describe('CourseEngine v2 factual timeline', () => {
  it('loads foundation and Node runtime context without exposing it in the original lesson base view', () => {
    expect(scenario.entities[CLUSTER_FOUNDATION]).toMatchObject({
      kind: 'Cluster',
      visual: { archetype: 'cluster' },
    });
    expect(scenario.entities[ETCD]).toMatchObject({
      kind: 'Etcd',
      data: { role: 'kubernetes-api-data-store', basicModelClient: 'kube-apiserver' },
    });
    expect(scenario.relations['api-stores-etcd']).toMatchObject({
      type: 'stores-in',
      from: API_SERVER,
      to: ETCD,
      semantic: 'control-observation',
    });

    const orientation = step('scene-orientation');
    expect(orientation.view.entityStates[CLUSTER_FOUNDATION]).toMatchObject({
      visible: false,
      emphasis: 'hidden',
    });
    expect(orientation.view.entityStates[ETCD]).toMatchObject({
      visible: false,
      emphasis: 'hidden',
    });
    expect(orientation.view.relationStates['api-stores-etcd']).toMatchObject({ visible: false });

    for (const [index, runtimeId] of CONTAINER_RUNTIMES.entries()) {
      const nodeName = `worker-${String.fromCharCode(97 + index)}`;
      expect(scenario.entities[runtimeId]).toMatchObject({
        kind: 'ContainerRuntime',
        data: { nodeName, role: 'container-execution', interface: 'CRI' },
      });
      expect(orientation.view.entityStates[runtimeId]).toMatchObject({
        visible: false,
        emphasis: 'hidden',
      });
      expect(
        orientation.view.relationStates[`kubelet-${nodeName.at(-1)}-uses-container-runtime`],
      ).toMatchObject({ visible: false });
    }
  });

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

  it('uses exact multilingual copy for the local restart and Container status slot', () => {
    expect(lesson.summary).toEqual({
      en: 'Watch kubelet restart a runtime Container locally inside one Pod, then follow an intentional Pod deletion and API-mediated replacement.',
      ja: 'kubelet が同じ Pod 内でランタイム Container をローカル再起動する流れと、その後に意図的な Pod 削除から API を介して置換される流れを追います。',
      'zh-CN':
        '先观察 kubelet 在同一 Pod 内本地重启运行时容器，再跟随一次主动 Pod 删除及其经由 API 完成的替换流程。',
    });

    const created = step('controller-creates-replacement').world;
    expect(created.entities[NEW_CONTAINER]?.summary).toEqual({
      en: 'Container status slot waiting for kubelet to create a runtime Container.',
      ja: 'kubelet がランタイム Container を作成するのを待っている Container 状態スロットです。',
      'zh-CN': '等待 kubelet 创建运行时容器的容器状态槽。',
    });

    const expectedContainmentTitle = {
      en: 'contains Container status',
      ja: 'Container 状態を含む',
      'zh-CN': '包含容器状态',
    };
    const replacementContainment = created.relations['contains-api-d-new-container-api']!;
    expect(replacementContainment).toBeDefined();
    const containmentRelations = [
      ...Object.values(scenario.relations).filter(
        (relation) => relation.type === 'contains-runtime',
      ),
      replacementContainment,
    ];
    expect(containmentRelations).toHaveLength(4);
    for (const relation of containmentRelations) {
      expect(relation.title).toEqual(expectedContainmentTitle);
    }
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
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: true,
        ready: true,
      },
    });
    expect(getContainerData(baseline.entities[OLD_CONTAINER]!)).toMatchObject({
      name: 'api',
      containerID: 'containerd://synthetic-api-a-old-01',
      restartCount: 0,
      ready: true,
      started: true,
      state: { kind: 'running', startedAt: '2026-08-08T00:00:00Z' },
    });
    expect(baseline.entities[OLD_CONTAINER]?.status).toBe('running');
    expect(getReplicaSetData(baseline.entities[REPLICA_SET]!)).toEqual({
      specReplicas: 3,
      statusReplicas: 3,
      readyReplicas: 3,
    });
  });

  it('keeps the Pod Running but NotReady when the runtime Container exits', () => {
    const crashed = step('container-exits');
    expect(getPodData(crashed.world.entities[OLD_POD]!)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
      phase: 'Running',
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: false,
        ready: false,
      },
    });
    expect(crashed.world.entities[OLD_CONTAINER]?.status).toBe('terminated');
    expect(getContainerData(crashed.world.entities[OLD_CONTAINER]!)).toMatchObject({
      containerID: 'containerd://synthetic-api-a-old-01',
      restartCount: 0,
      ready: false,
      started: false,
      state: {
        kind: 'terminated',
        reason: 'Error',
        exitCode: 1,
        finishedAt: '2026-08-08T00:00:10Z',
        containerID: 'containerd://synthetic-api-a-old-01',
      },
    });
    expect(getReplicaSetData(crashed.world.entities[REPLICA_SET]!)).toEqual({
      specReplicas: 3,
      statusReplicas: 3,
      readyReplicas: 2,
    });
    expect(crashed.world.entities[NEW_POD]).toBeUndefined();
    expect(crashed.worldDiff.addedEntities).toHaveLength(0);
    expect(crashed.worldDiff.removedEntities).toHaveLength(0);
  });

  it('starts a replacement runtime Container inside the same Pod status slot', () => {
    const restarted = step('container-restarted');
    expect(getPodData(restarted.world.entities[OLD_POD]!)).toMatchObject({
      uid: 'synthetic-uid-old-a1',
      nodeName: 'worker-a',
      phase: 'Running',
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: true,
        ready: true,
      },
    });
    expect(restarted.world.entities[OLD_CONTAINER]?.status).toBe('running');
    expect(getContainerData(restarted.world.entities[OLD_CONTAINER]!)).toMatchObject({
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
    });
    expect(getReplicaSetData(restarted.world.entities[REPLICA_SET]!)).toEqual({
      specReplicas: 3,
      statusReplicas: 3,
      readyReplicas: 3,
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
      specReplicas: 3,
      statusReplicas: 2,
      readyReplicas: 2,
    });

    const route = deleted.view.activeRoutes.find(
      (candidate) => candidate.id === 'route-kubectl-delete',
    );
    expect(route?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [KUBECTL, API_SERVER],
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
      conditions: {
        podScheduled: false,
        initialized: true,
        containersReady: false,
        ready: false,
      },
    });
    expect(getPodData(created.world.entities[NEW_POD]!).nodeName).toBeUndefined();
    expect(created.world.entities[NEW_CONTAINER]?.status).toBe('waiting');
    expect(getContainerData(created.world.entities[NEW_CONTAINER]!)).toMatchObject({
      restartCount: 0,
      ready: false,
      started: false,
      state: { kind: 'waiting', reason: 'Pending' },
    });
    expect(getContainerData(created.world.entities[NEW_CONTAINER]!).containerID).toBeUndefined();
    expect(created.world.relations['owns-api-d-new']).toBeDefined();
    expect(created.world.relations['scheduled-api-d-new']).toBeUndefined();
    expect(created.worldDiff.addedEntities.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([NEW_POD, NEW_CONTAINER]),
    );
    expect(getReplicaSetData(created.world.entities[REPLICA_SET]!)).toEqual({
      specReplicas: 3,
      statusReplicas: 3,
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
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: false,
        ready: false,
      },
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
      conditions: {
        podScheduled: true,
        initialized: true,
        containersReady: true,
        ready: true,
      },
    });
    expect(started.world.entities[NEW_CONTAINER]?.status).toBe('running');
    expect(getContainerData(started.world.entities[NEW_CONTAINER]!)).toMatchObject({
      containerID: 'containerd://synthetic-api-d-new-01',
      restartCount: 0,
      ready: true,
      started: true,
      state: { kind: 'running', startedAt: '2026-08-08T00:00:30Z' },
    });
    expect(getReplicaSetData(started.world.entities[REPLICA_SET]!)).toEqual({
      specReplicas: 3,
      statusReplicas: 3,
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
    const restartTransition = step('container-restarted').transition;
    const restartCause = restartTransition.cues.find((cue) => cue.type === 'node-runtime-restart');
    const restartCount = restartTransition.cues.find(
      (cue) =>
        cue.type === 'counter-change' &&
        cue.entityId === OLD_CONTAINER &&
        cue.field === 'data.restartCount',
    );
    expect(restartCause).toBeDefined();
    expect(restartCount).toBeDefined();
    expect(restartCount?.delayMs ?? 0).toBeGreaterThan(restartCause?.delayMs ?? 0);
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
        if (!/^\/data\/(specReplicas|statusReplicas|readyReplicas)$/.test(path)) continue;
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

  it('resolves routed cues against their authored semantic cause', () => {
    for (const candidate of compiled.steps) {
      const routes = new Map(candidate.view.activeRoutes.map((route) => [route.id, route]));
      for (const cue of candidate.transition.cues) {
        if (!('routeId' in cue)) continue;
        expect(routes.has(cue.routeId)).toBe(true);
        const route = routes.get(cue.routeId);
        if (cue.type === 'node-runtime-restart') {
          expect(route?.semantic).toBe('node-runtime');
          expect(route?.hops[0]?.fromEntityId).toBe(KUBELET_A);
          expect(route?.hops.at(-1)?.toEntityId).toBe(cue.entityId);
          expect(route?.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(
            API_SERVER,
          );
        } else {
          expect(
            route?.hops.some(
              (hop) => hop.fromEntityId === API_SERVER || hop.toEntityId === API_SERVER,
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('accepts only a node-local kubelet causal route for same-Pod restart', () => {
    const local = courseEngine.compileLesson(
      lessonWithLocalRestartRoute(localRestartRoute),
      scenario,
    );
    const restarted = local.steps.find((candidate) => candidate.stepId === RESTART_STEP_ID);
    const route = restarted?.view.activeRoutes[0];
    expect(route?.semantic).toBe('node-runtime');
    expect(route?.hops[0]?.fromEntityId).toBe(KUBELET_A);
    expect(route?.hops.at(-1)?.toEntityId).toBe(OLD_CONTAINER);
    expect(restarted?.transition.cues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'node-runtime-restart',
          routeId: localRestartRoute.id,
          entityId: OLD_CONTAINER,
        }),
      ]),
    );
  });

  it('rejects API/control-plane participation and cross-Node hops in the local restart route', () => {
    const withIntermediate = (entityId: string): ActiveTeachingRoute => ({
      ...localRestartRoute,
      hops: [
        {
          fromEntityId: KUBELET_A,
          fromAnchor: 'control',
          toEntityId: entityId,
          toAnchor: 'control',
        },
        {
          fromEntityId: entityId,
          fromAnchor: 'control',
          toEntityId: OLD_CONTAINER,
          toAnchor: 'control',
        },
      ],
    });

    expect(() =>
      courseEngine.compileLesson(
        lessonWithLocalRestartRoute({
          ...localRestartRoute,
          hops: [
            {
              fromEntityId: API_SERVER,
              fromAnchor: 'control',
              toEntityId: OLD_CONTAINER,
              toAnchor: 'control',
            },
          ],
        }),
        scenario,
      ),
    ).toThrow('must start at the kubelet');

    for (const forbidden of [API_SERVER, SCHEDULER, CONTROLLER_MANAGER, REPLICA_SET, KUBELET_B]) {
      expect(() =>
        courseEngine.compileLesson(
          lessonWithLocalRestartRoute(withIntermediate(forbidden)),
          scenario,
        ),
      ).toThrow('must stay on worker-a');
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

    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([
          {
            ...authoredSchedulerRoute,
            hops: [
              {
                ...firstHop,
                toEntityId: firstHop.fromEntityId,
                toAnchor: firstHop.fromAnchor,
              },
              ...remainingHops,
            ],
          },
        ]),
        scenario,
      ),
    ).toThrow('has coincident anchors');

    expect(() =>
      courseEngine.compileLesson(
        lessonWithSchedulerRoutes([
          {
            ...authoredSchedulerRoute,
            persistAfterAnimation: false,
          } as unknown as ActiveTeachingRoute,
        ]),
        scenario,
      ),
    ).toThrow(/must remain persistent|must remain visible/);
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
    expect(step('container-exits').evidence.map((row) => row.path)).toEqual(
      expect.arrayContaining([
        '/data/state/kind',
        '/data/conditions/containersReady',
        '/data/conditions/ready',
        '/data/replicas',
        '/data/uid',
        '/data/nodeName',
        '/data/phase',
      ]),
    );
    expect(step('container-restarted').evidence.map((row) => row.path)).toEqual(
      expect.arrayContaining([
        '/data/containerID',
        '/data/restartCount',
        '/data/lastState/reason',
        '/data/lastState/exitCode',
        '/data/conditions/ready',
        '/data/replicas',
        '/data/uid',
        '/data/nodeName',
      ]),
    );
    expect(step('kubectl-delete-pod').evidence).toEqual(
      expect.arrayContaining([expect.objectContaining({ entityId: OLD_POD, change: 'removed' })]),
    );
  });

  it('builds the comparison from compiled snapshots', () => {
    const comparison = step('compare-identities').view.comparison;
    expect(comparison?.rows.map((row) => row.property.en)).toEqual([
      'Pod name',
      'Pod UID',
      'Node',
      'Container ID',
      'Container restart count',
      'Pod object',
    ]);
    const restartCount = comparison?.rows.find(
      (row) => row.property.en === 'Container restart count',
    );
    const containerId = comparison?.rows.find((row) => row.property.en === 'Container ID');
    const podName = comparison?.rows.find((row) => row.property.en === 'Pod name');
    expect(restartCount?.containerRestart.en).toContain('0');
    expect(restartCount?.containerRestart.en).toContain('1');
    expect(containerId?.containerRestart.en).toContain('synthetic-api-a-old-01');
    expect(containerId?.containerRestart.en).toContain('synthetic-api-a-old-02');
    expect(containerId?.podReplacement.en).toContain('synthetic-api-d-new-01');
    expect(podName?.containerRestart.en).toContain('api-7f8d9-a');
    expect(podName?.containerRestart.en).not.toContain('api-object:');
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
