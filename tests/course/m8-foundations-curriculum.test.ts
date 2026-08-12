import { describe, expect, it } from 'vitest';
import {
  course,
  glossaryById,
  lessonById,
  lessons,
  scenarioById,
  sources,
} from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import type { CompiledLesson, CompiledStep } from '../../src/course/types';
import {
  getContainerData,
  getPodData,
  getReplicaSetData,
  type LocalizedText,
  type WorldEntity,
  type WorldSnapshot,
} from '../../src/world';

const AVAILABLE_IDS = [
  'why-kubernetes-exists',
  'cluster-overview',
  'pod-and-container',
  'pod-and-placement',
  'deployment-replicaset-and-pods',
  'manifest-to-running-pod',
  'pending-and-scheduling',
  'container-restart-vs-pod-replacement',
  'labels-and-selectors',
  'service-routes-to-pods',
  'dns-and-service-discovery',
  'probes-and-rolling-update',
  'full-external-request',
  'hpa',
] as const;

const AVAILABLE_CHAPTER_IDS = [
  'foundations',
  'foundations',
  'foundations',
  'foundations',
  'workloads-self-healing',
  'workloads-self-healing',
  'workloads-self-healing',
  'workloads-self-healing',
  'networking-resilience',
  'networking-resilience',
  'networking-resilience',
  'resources-scaling',
  'external-traffic',
  'resources-scaling',
] as const;

const PLANNED_IDS = [
  'pod-network-and-cni',
  'service-types',
  'ingress-and-gateway',
  'configmap-and-secret',
  'pvc-pv-storageclass',
  'statefulset',
  'requests-and-limits',
  'final-503-challenge',
] as const;

const DNS_CLIENT = 'api-object:namespaced:shop:Pod:dns-client';
const KUBE_DNS_SERVICE = 'api-object:namespaced:kube-system:Service:kube-dns';
const COREDNS_POD = 'api-object:namespaced:kube-system:Pod:coredns-a';
const API_SERVICE = 'api-object:namespaced:shop:Service:api';
const API_SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const API_POD = 'api-object:namespaced:shop:Pod:api-a';

const V2_POD = 'api-object:namespaced:shop:Pod:api-v2-a';
const V2_CONTAINER = 'container-status:shop:Pod:api-v2-a:Container:api';
const V1_REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-v1';
const V2_REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-v2';
const ROLLOUT_SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';

const compiledCache = new Map<string, CompiledLesson>();

function compiledLesson(id: string): CompiledLesson {
  const cached = compiledCache.get(id);
  if (cached) return cached;
  const lesson = lessonById.get(id);
  if (!lesson) throw new Error(`Missing available lesson ${id}`);
  const scenario = scenarioById.get(lesson.scenarioId);
  if (!scenario) throw new Error(`Missing scenario ${lesson.scenarioId} for ${id}`);
  const compiled = courseEngine.compileLesson(lesson, scenario);
  compiledCache.set(id, compiled);
  return compiled;
}

function step(compiled: CompiledLesson, id: string): CompiledStep {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing ${compiled.lesson.id}/${id}`);
  return value;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function expectLocalized(value: LocalizedText, context: string): void {
  for (const locale of ['en', 'ja', 'zh-CN'] as const) {
    expect(value[locale].trim(), `${context}.${locale}`).not.toBe('');
  }
}

function expectKnownSources(sourceIds: readonly string[], context: string): void {
  expect(sourceIds.length, `${context} source count`).toBeGreaterThan(0);
  for (const sourceId of sourceIds) {
    const source = sources.get(sourceId);
    expect(source, `${context} source ${sourceId}`).toBeDefined();
    if (!source) continue;
    expect(source.type, `${context} source type ${sourceId}`).toBe('official-documentation');
    expect(new URL(source.url).protocol, `${context} source protocol ${sourceId}`).toBe('https:');
    expect(source.authority.trim(), `${context} source authority ${sourceId}`).not.toBe('');
    expect(source.verifiedAt.trim(), `${context} source verifiedAt ${sourceId}`).not.toBe('');
  }
}

function endpointRows(
  entity: WorldEntity,
  context: string,
): readonly Readonly<Record<string, unknown>>[] {
  const rows = entity.data.endpoints;
  expect(Array.isArray(rows), `${context} endpoints`).toBe(true);
  if (!Array.isArray(rows)) return [];
  expect(rows.length, `${context} endpoint count`).toBeGreaterThan(0);
  return rows.map((row, index) => {
    expect(isRecord(row), `${context} endpoint ${String(index)}`).toBe(true);
    if (!isRecord(row)) throw new Error(`${context}: endpoint ${String(index)} is not an object`);
    return row;
  });
}

function assertWorldDataAndSources(world: WorldSnapshot, context: string): void {
  for (const entity of Object.values(world.entities)) {
    expectLocalized(entity.title, `${context}/${entity.id}/title`);
    expectLocalized(entity.summary, `${context}/${entity.id}/summary`);
    expectKnownSources(entity.sourceIds, `${context}/${entity.id}`);
    expect(isRecord(entity.data), `${context}/${entity.id}/data`).toBe(true);

    if (entity.kind === 'Pod') {
      const data = getPodData(entity);
      if (data.conditions.ready) {
        expect(data.conditions.containersReady, `${context}/${entity.id} containersReady`).toBe(
          true,
        );
      }
      if (!data.nodeName) {
        expect(data.conditions.podScheduled, `${context}/${entity.id} scheduled without node`).toBe(
          false,
        );
      }
    }

    if (entity.kind === 'Container') {
      const data = getContainerData(entity);
      expect(world.entities[data.podId], `${context}/${entity.id} parent Pod`).toBeDefined();
      expect(world.entities[data.podId]?.kind).toBe('Pod');
      if (data.ready) expect(data.state.kind).toBe('running');
    }

    if (entity.kind === 'ReplicaSet') {
      const data = getReplicaSetData(entity);
      expect(data.readyReplicas).toBeLessThanOrEqual(data.statusReplicas);
    }

    if (entity.kind === 'Service') {
      expect(typeof entity.data.clusterIP, `${context}/${entity.id} clusterIP`).toBe('string');
      expect((entity.data.clusterIP as string).trim()).not.toBe('');
      expect(Array.isArray(entity.data.ports), `${context}/${entity.id} ports`).toBe(true);
      expect((entity.data.ports as readonly unknown[]).length).toBeGreaterThan(0);
    }

    if (entity.kind === 'EndpointSlice') {
      for (const [index, endpoint] of endpointRows(entity, `${context}/${entity.id}`).entries()) {
        expect(typeof endpoint.address, `endpoint ${String(index)} address`).toBe('string');
        expect(typeof endpoint.targetRef, `endpoint ${String(index)} targetRef`).toBe('string');
        if (typeof endpoint.targetRef === 'string') {
          expect(
            world.entities[endpoint.targetRef],
            `${context}/${entity.id} target ${endpoint.targetRef}`,
          ).toBeDefined();
        }
        expect(endpoint.conditions, `${context}/${entity.id} endpoint conditions`).toEqual({
          ready: expect.any(Boolean),
          serving: expect.any(Boolean),
          terminating: expect.any(Boolean),
        });
      }
    }

    if (entity.kind === 'Node') {
      expect(entity.data.podSlotCount, `${context}/${entity.id} podSlotCount`).toEqual(
        expect.any(Number),
      );
      expect(entity.data.podSlotCount as number).toBeGreaterThan(0);
    }
  }

  for (const relation of Object.values(world.relations)) {
    expect(world.entities[relation.from], `${context}/${relation.id} from`).toBeDefined();
    expect(world.entities[relation.to], `${context}/${relation.id} to`).toBeDefined();
    expectLocalized(relation.title, `${context}/${relation.id}/title`);
    expectKnownSources(relation.sourceIds, `${context}/${relation.id}`);
  }
}

describe('M8 foundations curriculum with M9 flow-story expansion', () => {
  it('retains the twelve-lesson core and publishes two additional flow-story lessons', () => {
    const availableEntries = course.lessons.filter((entry) => entry.status === 'available');
    const available = availableEntries.map((entry) => entry.id);
    const planned = course.lessons
      .filter((entry) => entry.status === 'planned')
      .map((entry) => entry.id);

    expect(available).toEqual(AVAILABLE_IDS);
    expect(planned).toEqual(PLANNED_IDS);
    expect(course.lessons).toHaveLength(22);
    expect(course.lessonOrder).toEqual([...AVAILABLE_IDS, ...PLANNED_IDS]);
    expect(lessons.map((lesson) => lesson.id)).toEqual(AVAILABLE_IDS);
    expect(availableEntries.map((entry) => entry.chapterId)).toEqual(AVAILABLE_CHAPTER_IDS);
    expect(
      Object.fromEntries(
        [...new Set(AVAILABLE_CHAPTER_IDS)].map((chapterId) => [
          chapterId,
          availableEntries.filter((entry) => entry.chapterId === chapterId).length,
        ]),
      ),
    ).toEqual({
      foundations: 4,
      'workloads-self-healing': 4,
      'networking-resilience': 3,
      'resources-scaling': 2,
      'external-traffic': 1,
    });

    for (const entry of availableEntries) {
      const lesson = lessonById.get(entry.id);
      expect(lesson, `loaded lesson ${entry.id}`).toBeDefined();
      expect(lesson?.chapterId, `${entry.id} lesson chapter`).toBe(entry.chapterId);
    }

    for (const [index, id] of course.lessonOrder.entries()) {
      const entry = course.lessons.find((candidate) => candidate.id === id);
      expect(entry, `manifest entry ${id}`).toBeDefined();
      const expectedPrerequisites = index === 0 ? [] : [course.lessonOrder[index - 1]];
      expect(entry?.prerequisites, `${id} manifest prerequisites`).toEqual(expectedPrerequisites);
      const lesson = lessonById.get(id);
      if (lesson) {
        expect(lesson.prerequisites, `${id} lesson prerequisites`).toEqual(expectedPrerequisites);
      }
    }
  });

  it('gives every available lesson 4–10 compiled, trilingual, evidence-backed focused steps', () => {
    for (const id of AVAILABLE_IDS) {
      const compiled = compiledLesson(id);
      const { lesson } = compiled;
      const manifest = course.lessons.find((entry) => entry.id === id);
      if (!manifest) throw new Error(`Missing course entry ${id}`);

      expect(lesson.steps.length, `${id} step count`).toBeGreaterThanOrEqual(4);
      expect(lesson.steps.length, `${id} step count`).toBeLessThanOrEqual(10);
      expect(compiled.steps).toHaveLength(lesson.steps.length);
      expectLocalized(manifest.title, `${id}/manifest/title`);
      expectLocalized(manifest.learningOutcome, `${id}/manifest/learningOutcome`);
      expectLocalized(lesson.title, `${id}/title`);
      expectLocalized(lesson.summary, `${id}/summary`);
      expectLocalized(lesson.learningOutcome, `${id}/learningOutcome`);
      expectKnownSources(lesson.sourceIds, id);

      const introduced = new Set<string>();
      for (const [index, authored] of lesson.steps.entries()) {
        const compiledStep = compiled.steps[index];
        if (!compiledStep) throw new Error(`Missing compiled ${id}/${authored.id}`);

        expect(courseEngine.compileDirect(lesson, compiled.initialWorld, index)).toEqual(
          compiledStep,
        );
        expectLocalized(authored.title, `${id}/${authored.id}/title`);
        expectLocalized(authored.learningOutcome, `${id}/${authored.id}/learningOutcome`);
        expectLocalized(authored.narration, `${id}/${authored.id}/narration`);
        expectLocalized(authored.teaching.whatChanged, `${id}/${authored.id}/whatChanged`);
        expectLocalized(authored.teaching.whyItHappened, `${id}/${authored.id}/whyItHappened`);
        expectLocalized(authored.teaching.takeaway, `${id}/${authored.id}/takeaway`);
        expectKnownSources(authored.sourceIds, `${id}/${authored.id}`);

        expect(authored.evidence.mode, `${id}/${authored.id} evidence mode`).not.toBe('none');
        expect(
          authored.evidence.entityIds.length,
          `${id}/${authored.id} evidence entities`,
        ).toBeGreaterThan(0);
        expect(
          compiledStep.evidence.length,
          `${id}/${authored.id} compiled evidence`,
        ).toBeGreaterThan(0);
        for (const entityId of authored.evidence.entityIds) {
          expect(
            compiledStep.world.entities[entityId] ?? compiledStep.beforeWorld.entities[entityId],
            `${id}/${authored.id} evidence ${entityId}`,
          ).toBeDefined();
        }

        const focused = Object.values(compiledStep.view.entityStates).filter(
          (state) => state.visible && state.emphasis === 'focused',
        );
        expect(focused, `${id}/${authored.id} primary focus`).toHaveLength(1);

        expect(authored.introducesTerms.length).toBeLessThanOrEqual(3);
        for (const termId of authored.introducesTerms) {
          expect(glossaryById.has(termId), `${id}/${authored.id} term ${termId}`).toBe(true);
          expect(introduced.has(termId), `${id}/${authored.id} duplicate term ${termId}`).toBe(
            false,
          );
          introduced.add(termId);
        }
        for (const termId of authored.usesTerms) {
          expect(glossaryById.has(termId), `${id}/${authored.id} used term ${termId}`).toBe(true);
          expect(introduced.has(termId), `${id}/${authored.id} term order ${termId}`).toBe(true);
        }
      }
      if (lesson.steps.length <= 6)
        expect(introduced.size, `${id} term budget`).toBeLessThanOrEqual(8);
    }
  }, 15_000);

  it('opens with the operational problem before introducing Kubernetes object names', () => {
    const compiled = compiledLesson('why-kubernetes-exists');
    const authored = lessonById.get('why-kubernetes-exists');
    if (!authored) throw new Error('Missing why-kubernetes-exists lesson');

    expect(authored.learningOutcome.en).toContain('Kubernetes becomes useful');
    expect(authored.learningOutcome.en).toContain('desired state');
    expect(authored.sourceIds).toEqual(
      expect.arrayContaining(['k8s-container-images', 'k8s-objects', 'k8s-deployments']),
    );
    expect(authored.steps.map((candidate) => candidate.id)).toEqual([
      'image-packages-the-app',
      'declare-three-replicas',
      'three-replaceable-pods',
      'one-pod-is-lost',
      'controller-restores-count',
      'scheduler-records-worker-c',
      'binding-places-pod-on-worker-c',
      'kubelet-starts-replacement',
      'replacement-becomes-ready',
    ]);

    const startSimple = step(compiled, 'image-packages-the-app');
    const authoredStart = authored.steps.find(
      (candidate) => candidate.id === 'image-packages-the-app',
    );
    if (!authoredStart) throw new Error('Missing image-packages-the-app step');
    expect(authoredStart.title.en).toContain('one container');
    expect(authoredStart.narration.en).toContain('container runtime can be enough');
    expect(authoredStart.teaching.takeaway.en).toContain('without Kubernetes');
    expect(authoredStart.introducesTerms).toEqual(['container-image', 'container']);

    const containerId = 'container-status:shop:Pod:api-a-old:Container:api';
    expect(startSimple.world.entities[containerId]).toMatchObject({ kind: 'Container' });
    expect(startSimple.evidence.map((item) => item.entityId)).toContain(containerId);

    const threeCopies = authored.steps.find(
      (candidate) => candidate.id === 'declare-three-replicas',
    );
    if (!threeCopies) throw new Error('Missing declare-three-replicas step');
    expect(threeCopies.evidence.entityIds).toEqual(
      expect.arrayContaining([
        'api-object:namespaced:shop:Pod:api-a-old',
        'api-object:namespaced:shop:Pod:api-b',
        'api-object:namespaced:shop:Pod:api-c',
      ]),
    );

    const desiredState = authored.steps.find(
      (candidate) => candidate.id === 'three-replaceable-pods',
    );
    if (!desiredState) throw new Error('Missing three-replaceable-pods step');
    expect(desiredState.narration.en).toContain('desired state');
    expect(desiredState.introducesTerms).toEqual(['desired-state', 'deployment', 'replicaset']);

    const lost = step(compiled, 'one-pod-is-lost');
    const scheduled = step(compiled, 'scheduler-records-worker-c');
    const placed = step(compiled, 'binding-places-pod-on-worker-c');
    const started = step(compiled, 'kubelet-starts-replacement');
    const recovered = step(compiled, 'replacement-becomes-ready');
    const replicaSetId = 'api-object:namespaced:shop:ReplicaSet:api-rs';
    const replacementId = 'api-object:namespaced:shop:Pod:api-d-new';
    const replacementContainerId = 'container-status:shop:Pod:api-d-new:Container:api';
    expect(lost.world.entities[replicaSetId]?.data).toMatchObject({ readyReplicas: 2 });
    expect(scheduled.world.entities[replacementId]?.data).toMatchObject({
      nodeName: 'worker-c',
      phase: 'Pending',
      conditions: expect.objectContaining({ podScheduled: true, ready: false }),
    });
    expect(placed.world.entities[replacementId]?.data).toMatchObject({
      nodeName: 'worker-c',
      phase: 'Pending',
    });
    expect(started.world.entities[replacementContainerId]?.data).toMatchObject({
      started: true,
      ready: false,
    });
    expect(recovered.world.entities[replicaSetId]?.data).toMatchObject({ readyReplicas: 3 });
  });

  it('separates DNS resolution from the later application route', () => {
    const compiled = compiledLesson('dns-and-service-discovery');
    const scenario = scenarioById.get('internal-request-and-dns');
    if (!scenario) throw new Error('Missing internal-request-and-dns scenario');

    expect(scenario.entities[DNS_CLIENT]).toMatchObject({ kind: 'Pod', name: 'dns-client' });
    expect(scenario.entities[KUBE_DNS_SERVICE]).toMatchObject({
      kind: 'Service',
      name: 'kube-dns',
    });
    expect(scenario.entities[COREDNS_POD]).toMatchObject({ kind: 'Pod', name: 'coredns-a' });

    const dnsStep = step(compiled, 'dns-query-and-response');
    const dnsRoute = dnsStep.view.activeRoutes.find(
      (route) => route.id === 'dns-client-kube-dns-coredns',
    );
    expect(dnsRoute).toMatchObject({ semantic: 'dns', persistAfterAnimation: true });
    expect(dnsRoute?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [DNS_CLIENT, KUBE_DNS_SERVICE],
      [KUBE_DNS_SERVICE, COREDNS_POD],
    ]);
    expect(dnsStep.transition.cues).toEqual([
      expect.objectContaining({
        type: 'dns-query',
        routeId: dnsRoute?.id,
        flowPhase: 'request',
        direction: 'forward',
      }),
      expect.objectContaining({
        type: 'dns-query',
        routeId: dnsRoute?.id,
        flowPhase: 'response',
        direction: 'reverse',
      }),
    ]);

    const applicationStep = step(compiled, 'application-request-after-dns');
    const applicationRoute = applicationStep.view.activeRoutes.find(
      (route) => route.id === 'application-client-api-service-api-a',
    );
    expect(applicationRoute).toMatchObject({
      semantic: 'data-flow',
      persistAfterAnimation: true,
      support: {
        endpointSliceId: API_SLICE,
        serviceId: API_SERVICE,
        selectedEndpointTargetId: API_POD,
      },
    });
    expect(applicationRoute?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [DNS_CLIENT, API_SERVICE],
      [API_SERVICE, API_POD],
    ]);
    expect(applicationRoute?.id).not.toBe(dnsRoute?.id);
    expect(applicationRoute?.requestId).not.toBe(dnsRoute?.requestId);
    expect(applicationStep.view.activeRoutes.some((route) => route.semantic === 'dns')).toBe(false);

    for (const compiledStep of compiled.steps) {
      for (const route of compiledStep.view.activeRoutes) {
        for (const entityId of route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])) {
          expect(compiledStep.world.entities[entityId]?.kind).not.toBe('EndpointSlice');
        }
      }
    }
  });

  it('gates rollout progress on startup and readiness before shrinking the old ReplicaSet', () => {
    const compiled = compiledLesson('probes-and-rolling-update');

    const startup = step(compiled, 'startup-probe-passes');
    const startupPod = startup.world.entities[V2_POD];
    const startupContainer = startup.world.entities[V2_CONTAINER];
    if (!startupPod || !startupContainer) throw new Error('Missing v2 startup state');
    expect(getPodData(startupPod)).toMatchObject({
      uid: 'synthetic-api-v2-a-01',
      phase: 'Running',
      conditions: { initialized: true, containersReady: false, ready: false },
    });
    expect(getContainerData(startupContainer)).toMatchObject({
      ready: false,
      started: true,
      probes: {
        startup: { configured: true, succeeded: true },
        readiness: { configured: true, succeeded: false },
      },
    });
    expect(
      endpointRows(startup.world.entities[ROLLOUT_SLICE]!, 'startup EndpointSlice'),
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ targetRef: V2_POD })]));
    expect(getReplicaSetData(startup.world.entities[V1_REPLICA_SET]!)).toMatchObject({
      specReplicas: 2,
      statusReplicas: 2,
      readyReplicas: 2,
    });

    const notReady = step(compiled, 'readiness-keeps-v2-out');
    expect(getContainerData(notReady.world.entities[V2_CONTAINER]!)).toMatchObject({
      ready: false,
      probes: { readiness: { result: 'Failure', succeeded: false } },
    });
    expect(
      endpointRows(notReady.world.entities[ROLLOUT_SLICE]!, 'NotReady EndpointSlice'),
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ targetRef: V2_POD })]));

    const ready = step(compiled, 'readiness-adds-v2-endpoint');
    expect(getPodData(ready.world.entities[V2_POD]!)).toMatchObject({
      uid: 'synthetic-api-v2-a-01',
      conditions: { containersReady: true, ready: true },
    });
    expect(getContainerData(ready.world.entities[V2_CONTAINER]!)).toMatchObject({
      ready: true,
      probes: { readiness: { result: 'Success', succeeded: true } },
    });
    expect(endpointRows(ready.world.entities[ROLLOUT_SLICE]!, 'Ready EndpointSlice')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetRef: V2_POD,
          conditions: { ready: true, serving: true, terminating: false },
        }),
      ]),
    );
    expect(getReplicaSetData(ready.world.entities[V2_REPLICA_SET]!)).toMatchObject({
      specReplicas: 1,
      statusReplicas: 1,
      readyReplicas: 1,
    });
    expect(getReplicaSetData(ready.world.entities[V1_REPLICA_SET]!)).toMatchObject({
      specReplicas: 2,
      statusReplicas: 2,
      readyReplicas: 2,
    });

    const firstOldScaleDown = compiled.steps.findIndex((candidate) => {
      const entity = candidate.world.entities[V1_REPLICA_SET];
      return entity ? getReplicaSetData(entity).specReplicas < 2 : false;
    });
    const readinessIndex = compiled.steps.findIndex(
      (candidate) => candidate.stepId === 'readiness-adds-v2-endpoint',
    );
    expect(firstOldScaleDown).toBeGreaterThan(readinessIndex);
    expect(compiled.steps[firstOldScaleDown]?.stepId).toBe('old-replicaset-scales-down');
    expect(
      getReplicaSetData(compiled.steps[firstOldScaleDown]!.world.entities[V1_REPLICA_SET]!),
    ).toMatchObject({ specReplicas: 1, statusReplicas: 1, readyReplicas: 1 });
  });

  it('models a liveness restart as a Container identity change inside the same Pod UID', () => {
    const compiled = compiledLesson('probes-and-rolling-update');
    const restarted = step(compiled, 'liveness-restarts-container');
    const podBefore = restarted.beforeWorld.entities[V2_POD];
    const podAfter = restarted.world.entities[V2_POD];
    const containerBefore = restarted.beforeWorld.entities[V2_CONTAINER];
    const containerAfter = restarted.world.entities[V2_CONTAINER];
    if (!podBefore || !podAfter || !containerBefore || !containerAfter) {
      throw new Error('Missing liveness restart evidence');
    }

    expect(podAfter).toEqual(podBefore);
    expect(getPodData(podAfter).uid).toBe('synthetic-api-v2-a-01');
    const beforeData = getContainerData(containerBefore);
    const afterData = getContainerData(containerAfter);
    expect(afterData.containerID).not.toBe(beforeData.containerID);
    expect(afterData.restartCount).toBe(beforeData.restartCount + 1);
    expect(afterData.lastState).toMatchObject({
      reason: 'LivenessProbeFailed',
      containerID: beforeData.containerID,
    });
    expect(restarted.worldDiff.addedEntities).toEqual([]);
    expect(restarted.worldDiff.removedEntities).toEqual([]);
    expect(restarted.view.activeRoutes[0]).toMatchObject({
      semantic: 'node-runtime',
      hops: [
        {
          fromEntityId: 'runtime-component:node:worker-rollout:Kubelet:kubelet',
          toEntityId: V2_CONTAINER,
        },
      ],
    });
  });

  it('keeps deep entity data, routes, relations, and official sources valid in all compiled worlds', () => {
    for (const id of AVAILABLE_IDS) {
      const compiled = compiledLesson(id);
      assertWorldDataAndSources(compiled.initialWorld, `${id}/initial`);

      for (const compiledStep of compiled.steps) {
        const context = `${id}/${compiledStep.stepId}`;
        assertWorldDataAndSources(compiledStep.world, context);

        for (const route of compiledStep.view.activeRoutes) {
          expect(route.persistAfterAnimation, `${context}/${route.id} persistent`).toBe(true);
          expect(route.hops.length, `${context}/${route.id} hops`).toBeGreaterThan(0);
          for (const hop of route.hops) {
            for (const entityId of [hop.fromEntityId, hop.toEntityId]) {
              expect(
                compiledStep.world.entities[entityId] ??
                  compiledStep.beforeWorld.entities[entityId],
                `${context}/${route.id} hop ${entityId}`,
              ).toBeDefined();
            }
          }

          if (route.support) {
            const endpointSlice = compiledStep.world.entities[route.support.endpointSliceId];
            const service = compiledStep.world.entities[route.support.serviceId];
            expect(endpointSlice?.kind, `${context}/${route.id} support EndpointSlice`).toBe(
              'EndpointSlice',
            );
            expect(service?.kind, `${context}/${route.id} support Service`).toBe('Service');
            expect(route.hops.at(-1)?.toEntityId).toBe(route.support.selectedEndpointTargetId);
            if (endpointSlice) {
              expect(endpointRows(endpointSlice, `${context}/${route.id} support`)).toEqual(
                expect.arrayContaining([
                  expect.objectContaining({ targetRef: route.support.selectedEndpointTargetId }),
                ]),
              );
            }
          }
        }
      }
    }
  });
});
