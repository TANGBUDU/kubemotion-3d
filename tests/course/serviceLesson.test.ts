import { describe, expect, it } from 'vitest';
import { course, lessonById, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import { snapshotEvidence } from '../../src/course/diff/evidenceRules';
import type { ActiveTeachingRoute, LessonV2, TransitionCue } from '../../src/course/types';

const LESSON_ID = 'service-routes-to-pods';
const SERVICE = 'api-object:namespaced:shop:Service:api';
const SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const API_A = 'api-object:namespaced:shop:Pod:api-a';
const API_C = 'api-object:namespaced:shop:Pod:api-c';
const CLIENT = 'api-object:namespaced:shop:Pod:traffic-client';
const API_A_MEMBERSHIP = 'endpoint-slice-references-api-a';

const loadedLesson = lessonById.get(LESSON_ID);
if (!loadedLesson) throw new Error('Service lesson is missing');
const lesson: LessonV2 = loadedLesson;
const scenario = scenarioById.get(lesson.scenarioId);
if (!scenario) throw new Error('Service scenario is missing');
const compiled = courseEngine.compileLesson(lesson, scenario);

function step(id: string) {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing service lesson step ${id}`);
  return value;
}

function requestIdOf(route: unknown): string | undefined {
  if (!route || typeof route !== 'object') return undefined;
  const requestId = (route as Readonly<Record<string, unknown>>).requestId;
  return typeof requestId === 'string' ? requestId : undefined;
}

function endpointFor(entity: unknown, targetRef: string): Readonly<Record<string, unknown>> {
  if (!entity || typeof entity !== 'object') throw new Error('EndpointSlice entity is missing');
  const data = (entity as { readonly data?: Readonly<Record<string, unknown>> }).data;
  const endpoints = data?.endpoints;
  if (!Array.isArray(endpoints)) throw new Error('EndpointSlice endpoints are missing');
  const endpoint = endpoints.find(
    (candidate) =>
      candidate !== null &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate) &&
      (candidate as Readonly<Record<string, unknown>>).targetRef === targetRef,
  );
  if (!endpoint || Array.isArray(endpoint)) throw new Error(`Missing endpoint for ${targetRef}`);
  return endpoint as Readonly<Record<string, unknown>>;
}

function lessonWithRequestStep(
  route: ActiveTeachingRoute,
  cues?: readonly TransitionCue[],
): LessonV2 {
  return {
    ...lesson,
    steps: lesson.steps.map((candidate) =>
      candidate.id === 'request-ready-backend'
        ? {
            ...candidate,
            viewPatch: { ...candidate.viewPatch, activeRoutes: [route] },
            ...(cues ? { transition: { cues } } : {}),
          }
        : candidate,
    ),
  };
}

describe('service-routes-to-pods verified lesson', () => {
  it('publishes all fourteen verified lessons in foundation order and the six-step Service sequence', () => {
    expect(
      course.lessons.filter((entry) => entry.status === 'available').map((entry) => entry.id),
    ).toEqual([
      'why-kubernetes-exists',
      'cluster-overview',
      'pod-and-container',
      'pod-and-placement',
      'deployment-replicaset-and-pods',
      'manifest-to-running-pod',
      'pending-and-scheduling',
      'container-restart-vs-pod-replacement',
      'labels-and-selectors',
      LESSON_ID,
      'dns-and-service-discovery',
      'probes-and-rolling-update',
      'full-external-request',
      'hpa',
    ]);
    expect(course.lessons.filter((entry) => entry.status === 'available')).toHaveLength(14);
    expect(compiled.steps.map((item) => item.stepId)).toEqual([
      'identify-traffic-objects',
      'stable-service-entry',
      'endpoint-slice-backends',
      'request-ready-backend',
      'endpoint-becomes-not-ready',
      'later-request-ready-backend',
    ]);
    expect(lesson.steps.map((item) => item.title.en)).toEqual([
      'Identify the traffic objects',
      'The Service stays stable',
      'EndpointSlice lists eligible backends',
      'Request A reaches Ready endpoint api-a',
      'api-a remains listed but becomes NotReady',
      'A later request selects another Ready endpoint',
    ]);
    const visibleIds = Object.entries(compiled.steps[0]!.view.entityStates)
      .filter(([, state]) => state.visible && state.emphasis !== 'hidden')
      .map(([id]) => id)
      .sort();
    expect(visibleIds).toEqual(
      [CLIENT, SERVICE, SLICE, API_A, 'api-object:namespaced:shop:Pod:api-b', API_C].sort(),
    );
  });

  it('keeps the Service identity and address stable across every compiled snapshot', () => {
    const baseline = compiled.steps[0]?.world.entities[SERVICE];
    expect(baseline?.data).toMatchObject({
      serviceType: 'ClusterIP',
      publishNotReadyAddresses: false,
      clusterIP: '198.51.100.42',
      ports: [expect.objectContaining({ port: 8080, targetPort: 8080, protocol: 'TCP' })],
    });
    for (const item of compiled.steps) {
      expect(item.world.entities[SERVICE]).toEqual(baseline);
      expect(item.worldDiff.addedEntities.some((entity) => entity.id === SERVICE)).toBe(false);
      expect(item.worldDiff.removedEntities.some((entity) => entity.id === SERVICE)).toBe(false);
      expect(item.worldDiff.updatedEntities.some((entity) => entity.id === SERVICE)).toBe(false);
    }
  });

  it('models exact EndpointSlice conditions and two distinct requests without migrating Request A', () => {
    const requestA = step('request-ready-backend');
    const requestARoute = requestA.view.activeRoutes[0];
    expect(requestARoute).toMatchObject({
      id: 'client-service-api-a',
      semantic: 'data-flow',
      flowPhase: 'request',
      support: { endpointSliceId: SLICE, serviceId: SERVICE, selectedEndpointTargetId: API_A },
    });
    expect(requestIdOf(requestARoute)).toBe('request-a');
    expect(requestARoute?.persistAfterAnimation).toBe(true);
    expect(requestARoute?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [CLIENT, SERVICE],
      [SERVICE, API_A],
    ]);
    expect(requestARoute?.hops.map((hop) => [hop.fromAnchor, hop.toAnchor])).toEqual([
      ['network-out', 'network-in'],
      ['network-out', 'network-in'],
    ]);
    expect(requestARoute?.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(
      SLICE,
    );
    expect(requestA.transition.cues).toEqual([
      expect.objectContaining({ type: 'data-packet', routeId: 'client-service-api-a' }),
    ]);

    const readinessChange = step('endpoint-becomes-not-ready');
    const apiAEndpoint = endpointFor(readinessChange.world.entities[SLICE], API_A);
    const apiCEndpoint = endpointFor(readinessChange.world.entities[SLICE], API_C);
    expect(apiAEndpoint.conditions).toEqual({
      ready: false,
      serving: false,
      terminating: false,
    });
    expect(apiCEndpoint.conditions).toEqual({
      ready: true,
      serving: true,
      terminating: false,
    });
    expect(readinessChange.world.relations[API_A_MEMBERSHIP]?.data).toEqual({
      address: '192.0.2.11',
      ready: false,
      serving: false,
      terminating: false,
    });
    expect(readinessChange.world.entities[SERVICE]?.data.publishNotReadyAddresses).toBe(false);
    expect(readinessChange.world.entities[API_A]?.status).toBe('not-ready');
    expect(readinessChange.view.activeRoutes).toEqual([
      expect.objectContaining({
        id: 'client-service-api-c',
        persistAfterAnimation: true,
        support: {
          endpointSliceId: SLICE,
          serviceId: SERVICE,
          selectedEndpointTargetId: API_C,
        },
      }),
    ]);
    expect(readinessChange.view.activeRoutes[0]?.hops.map((hop) => hop.toEntityId)).toEqual([
      SERVICE,
      API_C,
    ]);
    expect(
      readinessChange.view.activeRoutes[0]?.hops.flatMap((hop) => [
        hop.fromEntityId,
        hop.toEntityId,
      ]),
    ).not.toContain(API_A);
    expect(readinessChange.transition.cues).toEqual([]);

    const requestB = step('later-request-ready-backend');
    const requestBRoute = requestB.view.activeRoutes[0];
    expect(requestBRoute).toMatchObject({
      flowPhase: 'request',
      support: { endpointSliceId: SLICE, serviceId: SERVICE, selectedEndpointTargetId: API_C },
    });
    expect(requestIdOf(requestBRoute)).toBe('request-b');
    expect(requestIdOf(requestBRoute)).not.toBe(requestIdOf(requestARoute));
    expect(requestBRoute?.hops.map((hop) => hop.toEntityId)).toEqual([SERVICE, API_C]);
    expect(requestBRoute?.hops.at(-1)?.toEntityId).toBe(API_C);
    expect(requestBRoute?.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(
      API_A,
    );
    expect(requestB.transition.cues).toEqual([
      expect.objectContaining({ type: 'data-packet', routeId: 'client-service-api-c' }),
    ]);
    expect(readinessChange.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: SLICE,
          path: '/data/endpoints',
          change: 'changed',
          before: expect.objectContaining({ en: '3/3 Ready' }),
          after: expect.objectContaining({ en: '2/3 Ready' }),
        }),
        expect.objectContaining({
          entityId: SLICE,
          path: '/data/endpoints/0/conditions',
          change: 'changed',
          before: expect.objectContaining({
            en: 'ready=true · serving=true · terminating=false',
          }),
          after: expect.objectContaining({
            en: 'ready=false · serving=false · terminating=false',
          }),
        }),
      ]),
    );
  });

  it('rejects configuration objects as packet hops and requires explicit support to match the backend', () => {
    const route = step('request-ready-backend').view.activeRoutes[0];
    if (!route) throw new Error('Request route is missing');
    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep({
          ...route,
          hops: [
            route.hops[0]!,
            {
              fromEntityId: SERVICE,
              fromAnchor: 'network-out',
              toEntityId: SLICE,
              toAnchor: 'network-in',
            },
            {
              fromEntityId: SLICE,
              fromAnchor: 'network-out',
              toEntityId: API_A,
              toAnchor: 'network-in',
            },
          ],
        }),
        scenario,
      ),
    ).toThrow(/cannot physically pass through EndpointSlice/);

    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep({
          ...route,
          support: {
            endpointSliceId: SLICE,
            serviceId: SERVICE,
            selectedEndpointTargetId: API_C,
          },
        }),
        scenario,
      ),
    ).toThrow(/final hop does not match selected endpoint support/);

    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep({
          ...route,
          hops: [
            {
              fromEntityId: CLIENT,
              fromAnchor: 'network-out',
              toEntityId: API_A,
              toAnchor: 'network-in',
            },
          ],
        }),
        scenario,
      ),
    ).toThrow(/must enter the selected backend through its supported Service/);
  });

  it('supports one request and a paused reverse response on the same persistent route', () => {
    const authored = lesson.steps.find((candidate) => candidate.id === 'request-ready-backend');
    const route = authored?.viewPatch.activeRoutes?.[0];
    const request = authored?.transition?.cues.find(
      (cue): cue is Extract<TransitionCue, { type: 'data-packet' }> => cue.type === 'data-packet',
    );
    if (!route || !request) throw new Error('Request authoring fixture is missing');
    const { flowPhase: _authoredFlowPhase, ...bidirectionalRoute } = route;
    expect(_authoredFlowPhase).toBe('request');
    const response: Extract<TransitionCue, { type: 'data-packet' }> = {
      ...request,
      flowPhase: 'response',
      direction: 'reverse',
      delayMs: (request.delayMs ?? 0) + request.durationMs + 180,
      label: { en: 'Response', ja: '応答', 'zh-CN': '响应' },
    };
    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep(bidirectionalRoute, [request, response]),
        scenario,
      ),
    ).not.toThrow();

    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep(bidirectionalRoute, [request, { ...response, direction: 'forward' }]),
        scenario,
      ),
    ).toThrow(/must reverse the request route/);
    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep(bidirectionalRoute, [
          request,
          { ...response, delayMs: request.durationMs },
        ]),
        scenario,
      ),
    ).toThrow(/must pause after the request completes/);

    expect(() =>
      courseEngine.compileLesson(
        lessonWithRequestStep(bidirectionalRoute, [{ ...request, direction: 'reverse' }]),
        scenario,
      ),
    ).toThrow(/request must play forward/);
  });

  it('treats omitted EndpointConditions.ready as Ready in factual evidence', () => {
    const endpointSlice = structuredClone(compiled.steps[0]!.world.entities[SLICE]!);
    const endpoints = endpointSlice.data.endpoints;
    if (!Array.isArray(endpoints)) throw new Error('EndpointSlice endpoints are missing');
    const first = endpoints[0];
    if (!first || typeof first !== 'object' || Array.isArray(first)) {
      throw new Error('First EndpointSlice endpoint is missing');
    }
    const conditions = first.conditions;
    if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) {
      throw new Error('First EndpointSlice conditions are missing');
    }
    delete (conditions as Record<string, unknown>).ready;

    const readiness = snapshotEvidence(endpointSlice).find((row) => row.path === '/data/endpoints');
    expect(readiness?.after).toEqual({
      en: '3/3 Ready',
      ja: 'Ready 3/3',
      'zh-CN': '就绪 3/3',
    });
  });

  it('keeps ready and serving aligned for this Pod-backed synthetic normal case', () => {
    const snapshot = step('endpoint-becomes-not-ready').world;
    const service = snapshot.entities[SERVICE];
    expect(service?.data.publishNotReadyAddresses).toBe(false);
    const slice = snapshot.entities[SLICE];
    if (!slice) throw new Error('EndpointSlice is missing');
    const endpoints = slice.data.endpoints;
    if (!Array.isArray(endpoints)) throw new Error('EndpointSlice endpoints are missing');

    for (const endpointValue of endpoints) {
      if (!endpointValue || typeof endpointValue !== 'object' || Array.isArray(endpointValue)) {
        continue;
      }
      const endpoint = endpointValue as Readonly<Record<string, unknown>>;
      const targetRef = endpoint.targetRef;
      const conditions = endpoint.conditions;
      if (
        typeof targetRef !== 'string' ||
        !conditions ||
        typeof conditions !== 'object' ||
        Array.isArray(conditions)
      ) {
        continue;
      }
      const conditionRecord = conditions as Readonly<Record<string, unknown>>;
      if (
        snapshot.entities[targetRef]?.kind === 'Pod' &&
        service?.data.publishNotReadyAddresses === false &&
        conditionRecord.terminating === false
      ) {
        expect(conditionRecord.ready).toBe(conditionRecord.serving);
      }
    }
  });

  it('guards the Service lesson against in-flight migration wording', () => {
    const forbiddenCopy = [
      ['Rerouted', 'request'].join(' '),
      ['reroute', 'to', 'Ready'].join(' '),
      ['Traffic', 'reroutes'].join(' '),
      ['再ルーティングされた', 'リクエスト'].join(''),
      ['改道后的', '请求'].join(''),
    ];
    for (const phrase of forbiddenCopy) expect(JSON.stringify(lesson)).not.toContain(phrase);
  });

  it('keeps direct compilation deterministic and contains no Gateway object or hop', () => {
    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
    expect(JSON.stringify({ lesson, scenario })).not.toMatch(/Gateway/);
  });
});
