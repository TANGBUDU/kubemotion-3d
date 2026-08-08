import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import lessonRaw from '../../content/courses/kubernetes-foundations/lessons/hpa.yaml?raw';
import scenarioRaw from '../../content/scenarios/hpa-scale-out.yaml?raw';
import sourcesRaw from '../../content/sources.yaml?raw';
import { lessonV2Schema, scenarioV2AuthorSchema, sourcesSchema } from '../../src/content/schemas';
import { courseEngine } from '../../src/course/CourseEngine';
import type { EntityViewState, LessonV2, TransitionCue } from '../../src/course/types';
import { HorizontalPodAutoscalerVisualHandle } from '../../src/renderer/visuals/HorizontalPodAutoscalerVisual';
import { MetricSourceVisualHandle } from '../../src/renderer/visuals/MetricSourceVisual';
import { getContainerData, getPodData, getReplicaSetData } from '../../src/world/dataGuards';
import type { LocalizedText, WorldEntity } from '../../src/world/types';
import { validateWorldSnapshot } from '../../src/world/validation';

const METRICS = 'runtime-component:cluster:global:MetricSource:resource-metrics';
const HPA = 'api-object:namespaced:shop:HorizontalPodAutoscaler:api';
const API = 'runtime-component:cluster:global:KubeAPIServer:kube-apiserver';
const SCHEDULER = 'runtime-component:cluster:global:Scheduler:kube-scheduler';
const KUBELET = 'runtime-component:node:worker-scale:Kubelet:kubelet';
const RUNTIME = 'runtime-component:node:worker-scale:ContainerRuntime:containerd';
const NODE = 'infrastructure:cluster:global:Node:worker-scale';
const DEPLOYMENT = 'api-object:namespaced:shop:Deployment:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';
const POD_C = 'api-object:namespaced:shop:Pod:api-c';
const CONTAINER_C = 'container-status:shop:Pod:api-c:Container:api';
const SERVICE = 'api-object:namespaced:shop:Service:api';
const SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const CLIENT = 'api-object:namespaced:shop:Pod:load-client';

const lesson = lessonV2Schema.parse(parse(lessonRaw)) as unknown as LessonV2;
const authoredScenario = scenarioV2AuthorSchema.parse(parse(scenarioRaw));
const sources = sourcesSchema.parse(parse(sourcesRaw)).sources;
const scenario = validateWorldSnapshot({
  schemaVersion: 2,
  scenarioId: authoredScenario.scenarioId,
  revision: authoredScenario.revision,
  entities: Object.fromEntries(authoredScenario.entities.map((entity) => [entity.id, entity])),
  relations: Object.fromEntries(
    authoredScenario.relations.map((relation) => [relation.id, relation]),
  ),
});
const compiled = courseEngine.compileLesson(lesson, scenario);

const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };

function step(id: string) {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing HPA lesson step ${id}`);
  return value;
}

function endpointRows(entity: WorldEntity): readonly Readonly<Record<string, unknown>>[] {
  const endpoints = entity.data.endpoints;
  if (!Array.isArray(endpoints)) throw new Error(`${entity.id} has no endpoint rows`);
  return endpoints as readonly Readonly<Record<string, unknown>>[];
}

function expectLocalized(value: LocalizedText): void {
  for (const locale of ['en', 'ja', 'zh-CN'] as const) {
    expect(value[locale].trim().length).toBeGreaterThan(0);
  }
}

function isRoutedCue(cue: TransitionCue): cue is TransitionCue & { readonly routeId: string } {
  return 'routeId' in cue;
}

describe('isolated raw HPA scale-out story', () => {
  it('compiles every HPA beat within the mobile control-flow density budget', () => {
    const mobile = courseEngine.compileLesson(lesson, scenario, { viewport: 'mobile' });
    expect(mobile.steps).toHaveLength(8);
    for (const compiledStep of mobile.steps) {
      for (const route of compiledStep.view.activeRoutes) {
        for (const hop of route.hops) {
          expect(compiledStep.view.entityStates[hop.fromEntityId]?.visible).toBe(true);
          expect(compiledStep.view.entityStates[hop.toEntityId]?.visible).toBe(true);
        }
      }
    }
  });

  it('parses raw schema-v2 YAML and compiles the eight-event sequence deterministically', () => {
    expect(authoredScenario.scenarioId).toBe('hpa-scale-out');
    expect(lesson).toMatchObject({ id: 'hpa', scenarioId: 'hpa-scale-out' });
    expect(compiled.steps.map((candidate) => candidate.stepId)).toEqual([
      'metric-rises',
      'hpa-raises-desired-replicas',
      'replicaset-creates-pending-pod',
      'scheduler-binds-pod',
      'kubelet-starts-container',
      'pod-becomes-ready',
      'endpointslice-adds-backend',
      'traffic-fan-out-expands',
    ]);

    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
  });

  it('keeps metric observation, scale intent, Pod creation, binding, runtime, readiness, and endpoint membership separate', () => {
    const metric = step('metric-rises');
    expect(metric.beforeWorld.entities[METRICS]?.data.observedUtilization).toBe(45);
    expect(metric.world.entities[METRICS]?.data.observedUtilization).toBe(78);
    expect(metric.world.entities[HPA]?.data).toMatchObject({
      currentReplicas: 2,
      desiredReplicas: 2,
      metric: { target: 60, current: 78 },
    });
    expect(metric.world.entities[POD_C]).toBeUndefined();

    const scale = step('hpa-raises-desired-replicas');
    expect(scale.world.entities[HPA]?.data).toMatchObject({
      currentReplicas: 2,
      desiredReplicas: 3,
    });
    expect(Math.ceil((2 * 78) / 60)).toBe(3);
    expect(scale.world.entities[DEPLOYMENT]?.data).toMatchObject({ desiredReplicas: 3 });
    expect(getReplicaSetData(scale.world.entities[REPLICA_SET]!)).toMatchObject({
      specReplicas: 2,
      statusReplicas: 2,
      readyReplicas: 2,
    });
    expect(scale.world.entities[POD_C]).toBeUndefined();
    expect(scale.world.entities[CONTAINER_C]).toBeUndefined();

    const created = step('replicaset-creates-pending-pod');
    expect(getReplicaSetData(created.world.entities[REPLICA_SET]!)).toMatchObject({
      specReplicas: 3,
      statusReplicas: 3,
      readyReplicas: 2,
    });
    expect(created.world.entities[HPA]?.data.currentReplicas).toBe(3);
    expect(getPodData(created.world.entities[POD_C]!)).toMatchObject({
      uid: 'synthetic-api-scale-c-01',
      phase: 'Pending',
      conditions: { podScheduled: false, containersReady: false, ready: false },
    });
    expect(getPodData(created.world.entities[POD_C]!).nodeName).toBeUndefined();
    expect(created.world.entities[POD_C]!.data.podIP).toBeUndefined();
    const waitingContainer = getContainerData(created.world.entities[CONTAINER_C]!);
    expect(waitingContainer.containerID).toBeUndefined();
    expect(waitingContainer).toMatchObject({
      ready: false,
      started: false,
      state: { kind: 'waiting', reason: 'Pending' },
    });
    expect(created.world.relations['api-c-on-worker-scale']).toBeUndefined();

    const bound = step('scheduler-binds-pod');
    expect(getPodData(bound.world.entities[POD_C]!)).toMatchObject({
      nodeName: 'worker-scale',
      phase: 'Pending',
      conditions: { podScheduled: true, containersReady: false, ready: false },
    });
    expect(getContainerData(bound.world.entities[CONTAINER_C]!).state.kind).toBe('waiting');
    expect(bound.world.entities[POD_C]!.data.podIP).toBeUndefined();
    expect(bound.world.relations['api-c-on-worker-scale']).toMatchObject({
      from: POD_C,
      to: NODE,
      semantic: 'placement',
    });

    const started = step('kubelet-starts-container');
    expect(getContainerData(started.world.entities[CONTAINER_C]!)).toMatchObject({
      containerID: 'containerd://synthetic-api-scale-c-01',
      restartCount: 0,
      ready: false,
      started: true,
      state: { kind: 'running' },
    });
    expect(getPodData(started.world.entities[POD_C]!)).toMatchObject({
      phase: 'Running',
      conditions: { podScheduled: true, initialized: true, containersReady: false, ready: false },
    });
    expect(started.world.entities[POD_C]!.data.podIP).toBe('192.0.2.43');
    expect(endpointRows(started.world.entities[SLICE]!)).toHaveLength(2);

    const ready = step('pod-becomes-ready');
    expect(getPodData(ready.world.entities[POD_C]!)).toMatchObject({
      phase: 'Running',
      conditions: { containersReady: true, ready: true },
    });
    expect(getContainerData(ready.world.entities[CONTAINER_C]!).ready).toBe(true);
    expect(ready.world.entities[HPA]?.data.currentReplicas).toBe(3);
    expect(getReplicaSetData(ready.world.entities[REPLICA_SET]!).readyReplicas).toBe(3);
    expect(ready.world.entities[DEPLOYMENT]?.data).toMatchObject({
      desiredReplicas: 3,
      readyReplicas: 3,
      availableReplicas: 3,
    });
    expect(endpointRows(ready.world.entities[SLICE]!)).toHaveLength(2);

    const published = step('endpointslice-adds-backend');
    expect(endpointRows(published.world.entities[SLICE]!)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          address: '192.0.2.43',
          targetRef: POD_C,
          conditions: { ready: true, serving: true, terminating: false },
        }),
      ]),
    );
    expect(endpointRows(published.world.entities[SLICE]!)).toHaveLength(3);
    expect(published.world.relations['service-selects-api-c']).toBeDefined();
    expect(published.world.relations['api-slice-references-api-c']).toBeDefined();
    expect(published.view.entityStates[POD_C]?.visible).toBe(true);
    expect(published.view.relationStates['api-slice-references-api-c']?.visible).toBe(true);
  });

  it('keeps every causal route persistent and separates control, scheduling, node-runtime, and data-flow semantics', () => {
    const expectedRoutes: Readonly<Record<string, readonly [string, string][]>> = {
      'metric-rises': [['route-metrics-to-hpa', 'control']],
      'hpa-raises-desired-replicas': [['route-hpa-api-scale-target', 'control']],
      'replicaset-creates-pending-pod': [['route-controller-api-create-pod', 'control']],
      'scheduler-binds-pod': [
        ['route-hpa-scheduler-control', 'control'],
        ['route-hpa-scheduling-decision', 'scheduling'],
      ],
      'kubelet-starts-container': [
        ['route-api-kubelet-watch', 'control'],
        ['route-kubelet-runtime-start', 'node-runtime'],
      ],
      'pod-becomes-ready': [['route-kubelet-api-ready', 'control']],
      'endpointslice-adds-backend': [['route-controller-api-endpoints', 'control']],
      'traffic-fan-out-expands': [['route-client-service-api-c', 'data-flow']],
    };

    for (const compiledStep of compiled.steps) {
      expect(compiledStep.view.activeRoutes.map((route) => [route.id, route.semantic])).toEqual(
        expectedRoutes[compiledStep.stepId],
      );
      for (const route of compiledStep.view.activeRoutes) {
        expect(route.persistAfterAnimation).toBe(true);
        expect(route.hops.length).toBeGreaterThan(0);
      }
      const routeIds = new Set(compiledStep.view.activeRoutes.map((route) => route.id));
      for (const cue of compiledStep.transition.cues.filter(isRoutedCue)) {
        expect(routeIds.has(cue.routeId), `${compiledStep.stepId}/${cue.routeId}`).toBe(true);
      }
    }

    const scheduledRoutes = step('scheduler-binds-pod').view.activeRoutes;
    expect(scheduledRoutes.find((route) => route.semantic === 'control')?.hops).toEqual([
      expect.objectContaining({ fromEntityId: SCHEDULER, toEntityId: API }),
      expect.objectContaining({ fromEntityId: API, toEntityId: POD_C }),
    ]);
    expect(scheduledRoutes.find((route) => route.semantic === 'scheduling')?.hops).toEqual([
      expect.objectContaining({ fromEntityId: POD_C, toEntityId: NODE }),
    ]);

    const runtimeRoutes = step('kubelet-starts-container').view.activeRoutes;
    expect(runtimeRoutes.find((route) => route.semantic === 'node-runtime')?.hops).toEqual([
      expect.objectContaining({ fromEntityId: KUBELET, toEntityId: RUNTIME }),
      expect.objectContaining({ fromEntityId: RUNTIME, toEntityId: CONTAINER_C }),
    ]);
  });

  it('expands eligibility to three while animating one request to exactly one selected backend', () => {
    const traffic = step('traffic-fan-out-expands');
    const endpointTargets = endpointRows(traffic.world.entities[SLICE]!).map(
      (row) => row.targetRef,
    );
    expect(endpointTargets).toEqual([
      'api-object:namespaced:shop:Pod:api-a',
      'api-object:namespaced:shop:Pod:api-b',
      POD_C,
    ]);

    const routes = traffic.view.activeRoutes;
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      id: 'route-client-service-api-c',
      semantic: 'data-flow',
      requestId: 'hpa-request-001',
      flowPhase: 'request',
      persistAfterAnimation: true,
      support: {
        endpointSliceId: SLICE,
        serviceId: SERVICE,
        selectedEndpointTargetId: POD_C,
      },
      hops: [
        { fromEntityId: CLIENT, toEntityId: SERVICE },
        { fromEntityId: SERVICE, toEntityId: POD_C },
      ],
    });
    expect(routes[0]?.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(
      SLICE,
    );
    expect(traffic.transition.cues).toEqual([
      expect.objectContaining({
        type: 'data-packet',
        routeId: 'route-client-service-api-c',
        direction: 'forward',
      }),
    ]);
  });

  it('provides complete trilingual teaching, Evidence, Takeaway, and official source references', () => {
    for (const value of [lesson.title, lesson.summary, lesson.learningOutcome]) {
      expectLocalized(value);
    }
    for (const sourceId of lesson.sourceIds) expect(sources[sourceId]).toBeDefined();

    for (const authoredStep of lesson.steps) {
      for (const value of [
        authoredStep.title,
        authoredStep.learningOutcome,
        authoredStep.narration,
        authoredStep.teaching.whatChanged,
        authoredStep.teaching.whyItHappened,
        authoredStep.teaching.takeaway,
      ]) {
        expectLocalized(value);
      }
      expect(authoredStep.evidence.entityIds.length).toBeGreaterThan(0);
      expect(authoredStep.evidence.mode).not.toBe('none');
      expect(authoredStep.sourceIds.length).toBeGreaterThan(0);
      for (const sourceId of authoredStep.sourceIds) expect(sources[sourceId]).toBeDefined();
    }

    for (const entity of authoredScenario.entities) {
      expectLocalized(entity.title);
      expectLocalized(entity.summary);
      for (const sourceId of entity.sourceIds) expect(sources[sourceId]).toBeDefined();
    }
    for (const relation of authoredScenario.relations) {
      expectLocalized(relation.title);
      for (const sourceId of relation.sourceIds) expect(sources[sourceId]).toBeDefined();
    }
  });

  it('renders HPA and metric source as distinct data-bearing specialized visual handles', () => {
    const hpaEntity = scenario.entities[HPA];
    const metricEntity = scenario.entities[METRICS];
    if (!hpaEntity || !metricEntity) throw new Error('Missing HPA visual fixtures');

    const hpa = new HorizontalPodAutoscalerVisualHandle(hpaEntity, normal);
    const metrics = new MetricSourceVisualHandle(metricEntity, normal);
    expect(hpa.root.userData).toMatchObject({
      visualKind: 'horizontal-pod-autoscaler-scale-controller',
      directContainerStarter: false,
      currentReplicas: 2,
      desiredReplicas: 2,
      currentMetric: 45,
      targetMetric: 60,
    });
    expect(metrics.root.userData).toMatchObject({
      visualKind: 'metric-source-telemetry-instrument',
      observedUtilization: 45,
      targetUtilization: 60,
      aboveTarget: false,
    });

    const scaledHpa = step('hpa-raises-desired-replicas').world.entities[HPA];
    const highMetric = step('metric-rises').world.entities[METRICS];
    if (!scaledHpa || !highMetric) throw new Error('Missing updated HPA visual fixtures');
    hpa.update(scaledHpa, normal);
    metrics.update(highMetric, normal);
    expect(hpa.root.userData).toMatchObject({
      currentReplicas: 2,
      desiredReplicas: 3,
      scalingOut: true,
    });
    expect(metrics.root.userData).toMatchObject({
      observedUtilization: 78,
      targetUtilization: 60,
      aboveTarget: true,
      activeSampleBars: 8,
    });
    expect(hpa.root.userData.visualKind).not.toBe(metrics.root.userData.visualKind);

    hpa.dispose();
    metrics.dispose();
    expect(hpa.isDisposed).toBe(true);
    expect(metrics.isDisposed).toBe(true);
  });
});
