import { describe, expect, it } from 'vitest';
import { course, lessonById, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';

const LESSON_ID = 'service-routes-to-pods';
const SERVICE = 'api-object:namespaced:shop:Service:api';
const SLICE = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const API_A = 'api-object:namespaced:shop:Pod:api-a';
const API_C = 'api-object:namespaced:shop:Pod:api-c';
const CLIENT = 'api-object:namespaced:shop:Pod:traffic-client';

const lesson = lessonById.get(LESSON_ID);
if (!lesson) throw new Error('Service lesson is missing');
const scenario = scenarioById.get(lesson.scenarioId);
if (!scenario) throw new Error('Service scenario is missing');
const compiled = courseEngine.compileLesson(lesson, scenario);

function step(id: string) {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing service lesson step ${id}`);
  return value;
}

describe('service-routes-to-pods verified lesson', () => {
  it('publishes exactly two verified lessons and the required six-step sequence', () => {
    expect(
      course.lessons.filter((entry) => entry.status === 'available').map((entry) => entry.id),
    ).toEqual(expect.arrayContaining(['container-restart-vs-pod-replacement', LESSON_ID]));
    expect(course.lessons.filter((entry) => entry.status === 'available')).toHaveLength(2);
    expect(compiled.steps.map((item) => item.stepId)).toEqual([
      'identify-traffic-objects',
      'stable-service-entry',
      'endpoint-slice-backends',
      'request-ready-backend',
      'reroute-not-ready-endpoint',
      'complete-service-path',
    ]);
    expect(lesson.steps.map((item) => item.title.en)).toEqual([
      'Identify the traffic objects',
      'The Service stays stable',
      'EndpointSlice lists eligible backends',
      'A request reaches one ready backend',
      'Traffic reroutes around a NotReady endpoint',
      'Trace the complete Service path',
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

  it('models EndpointSlice conditions and reroutes data flow without making it a network hop', () => {
    const initialRoute = step('request-ready-backend').view.activeRoutes[0];
    expect(initialRoute).toMatchObject({ id: 'client-service-api-a', semantic: 'data-flow' });
    expect(initialRoute?.persistAfterAnimation).toBe(true);
    expect(initialRoute?.hops.map((hop) => [hop.fromEntityId, hop.toEntityId])).toEqual([
      [CLIENT, SERVICE],
      [SERVICE, API_A],
    ]);
    expect(initialRoute?.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId])).not.toContain(
      SLICE,
    );
    expect(step('request-ready-backend').transition.cues).toEqual([
      expect.objectContaining({ type: 'data-packet', routeId: 'client-service-api-a' }),
    ]);

    const rerouted = step('reroute-not-ready-endpoint');
    const endpoints = rerouted.world.entities[SLICE]?.data.endpoints;
    expect(endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetRef: API_A,
          conditions: expect.objectContaining({ ready: false }),
        }),
        expect.objectContaining({
          targetRef: API_C,
          conditions: expect.objectContaining({ ready: true }),
        }),
      ]),
    );
    expect(rerouted.world.entities[API_A]?.status).toBe('not-ready');
    expect(rerouted.view.activeRoutes[0]?.hops.map((hop) => hop.toEntityId)).toEqual([
      SERVICE,
      API_C,
    ]);
    expect(step('complete-service-path').view.activeRoutes[0]?.hops.at(-1)?.toEntityId).toBe(API_C);
    expect(rerouted.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: SLICE,
          path: '/data/endpoints',
          change: 'changed',
          before: expect.objectContaining({ en: '3/3 Ready' }),
          after: expect.objectContaining({ en: '2/3 Ready' }),
        }),
      ]),
    );
  });

  it('keeps direct compilation deterministic and contains no Gateway object or hop', () => {
    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
    expect(JSON.stringify({ lesson, scenario })).not.toMatch(/Gateway/);
  });
});
