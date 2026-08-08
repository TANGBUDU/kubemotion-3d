import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import lessonRaw from '../../content/courses/kubernetes-foundations/lessons/manifest-to-running-pod.yaml?raw';
import scenarioRaw from '../../content/scenarios/container-restart-golden.yaml?raw';
import { lessonV2Schema, scenarioV2AuthorSchema } from '../../src/content/schemas';
import { courseEngine } from '../../src/course/CourseEngine';
import type { LessonV2, RouteSemantic, TransitionCue } from '../../src/course/types';
import { validateWorldSnapshot } from '../../src/world/validation';

const POD = 'api-object:namespaced:shop:Pod:api-manifest-new';
const CONTAINER = 'container-status:shop:Pod:api-manifest-new:Container:api';
const DEPLOYMENT = 'api-object:namespaced:shop:Deployment:api';
const REPLICA_SET = 'api-object:namespaced:shop:ReplicaSet:api-rs';
const NODE = 'infrastructure:cluster:global:Node:worker-c';

const lesson = lessonV2Schema.parse(parse(lessonRaw)) as unknown as LessonV2;
const authoredScenario = scenarioV2AuthorSchema.parse(parse(scenarioRaw));
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

function step(id: string) {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  if (!value) throw new Error(`Missing manifest lesson step ${id}`);
  return value;
}

function routedCue(cue: TransitionCue): cue is TransitionCue & { readonly routeId: string } {
  return 'routeId' in cue;
}

describe('M7 manifest-to-running-pod lesson', () => {
  it('compiles the required eight-event control story deterministically', () => {
    expect(compiled.steps.map((candidate) => candidate.stepId)).toEqual([
      'submit-deployment-manifest',
      'persist-api-state',
      'controller-creates-pending-pod',
      'pending-before-scheduling',
      'scheduler-records-worker-c',
      'kubelet-observes-assignment',
      'runtime-starts-container',
      'pod-becomes-ready',
    ]);

    for (const [index, sequential] of compiled.steps.entries()) {
      expect(courseEngine.compileDirect(lesson, scenario, index)).toEqual(sequential);
    }
  });

  it('keeps creation, scheduling, startup, and readiness as separate world facts', () => {
    const submitted = step('submit-deployment-manifest');
    expect(submitted.world.entities[DEPLOYMENT]?.data.desiredReplicas).toBe(4);
    expect(submitted.world.entities[REPLICA_SET]?.data.specReplicas).toBe(3);
    expect(submitted.world.entities[POD]).toBeUndefined();

    const created = step('controller-creates-pending-pod');
    expect(created.world.entities[POD]).toMatchObject({
      status: 'pending',
      data: {
        uid: 'synthetic-uid-manifest-new-01',
        phase: 'Pending',
        conditions: { podScheduled: false, containersReady: false, ready: false },
      },
    });
    expect(created.world.entities[POD]?.data.nodeName).toBeUndefined();
    expect(created.world.entities[CONTAINER]).toMatchObject({
      status: 'waiting',
      data: { ready: false, started: false, state: { kind: 'waiting', reason: 'Pending' } },
    });
    expect(created.world.entities[REPLICA_SET]?.data).toMatchObject({
      specReplicas: 4,
      statusReplicas: 4,
      readyReplicas: 3,
    });

    const pending = step('pending-before-scheduling');
    expect(pending.world.relations['scheduled-api-manifest-new']).toBeUndefined();
    expect(pending.world.entities[POD]?.data.nodeName).toBeUndefined();

    const scheduled = step('scheduler-records-worker-c');
    expect(scheduled.world.entities[POD]).toMatchObject({
      status: 'pending',
      data: { nodeName: 'worker-c', phase: 'Pending', conditions: { podScheduled: true } },
    });
    expect(scheduled.world.entities[CONTAINER]?.status).toBe('waiting');
    expect(scheduled.world.relations['scheduled-api-manifest-new']).toMatchObject({
      from: POD,
      to: NODE,
      semantic: 'placement',
    });

    const started = step('runtime-starts-container');
    expect(started.world.entities[CONTAINER]).toMatchObject({
      status: 'running',
      data: {
        containerID: 'containerd://synthetic-api-manifest-new-01',
        restartCount: 0,
        ready: false,
        started: true,
        state: { kind: 'running' },
      },
    });
    expect(started.world.entities[POD]).toMatchObject({
      status: 'not-ready',
      data: { phase: 'Running', conditions: { containersReady: false, ready: false } },
    });

    const ready = step('pod-becomes-ready');
    expect(ready.world.entities[CONTAINER]?.data.ready).toBe(true);
    expect(ready.world.entities[POD]).toMatchObject({
      status: 'ready',
      data: { phase: 'Running', conditions: { containersReady: true, ready: true } },
    });
    expect(ready.world.entities[REPLICA_SET]?.data).toMatchObject({
      specReplicas: 4,
      statusReplicas: 4,
      readyReplicas: 4,
    });
  });

  it('gives every routed cue a persistent route with the matching semantic', () => {
    const expectedSemantic: Partial<Record<TransitionCue['type'], RouteSemantic>> = {
      'api-request': 'control',
      'reconcile-pulse': 'control',
      'scheduler-assignment': 'scheduling',
      'node-runtime-restart': 'node-runtime',
    };

    for (const compiledStep of compiled.steps) {
      const routeById = new Map(compiledStep.view.activeRoutes.map((route) => [route.id, route]));
      for (const route of compiledStep.view.activeRoutes) {
        expect(route.persistAfterAnimation).toBe(true);
        expect(route.hops.length).toBeGreaterThan(0);
      }
      for (const cue of compiledStep.transition.cues.filter(routedCue)) {
        const route = routeById.get(cue.routeId);
        expect(route, `${compiledStep.stepId}/${cue.type} route`).toBeDefined();
        expect(route?.semantic).toBe(expectedSemantic[cue.type]);
      }
    }

    expect(step('persist-api-state').view.activeRoutes[0]).toMatchObject({
      id: 'route-api-storage',
      persistAfterAnimation: true,
      hops: [
        {
          fromEntityId: 'runtime-component:cluster:global:KubeAPIServer:kube-apiserver',
          fromAnchor: 'storage',
          toEntityId: 'runtime-component:cluster:global:Etcd:etcd',
          toAnchor: 'storage',
        },
      ],
    });
    expect(step('runtime-starts-container').view.activeRoutes[0]?.semantic).toBe('node-runtime');
  });

  it('never places Deployment or ReplicaSet on an animated route', () => {
    for (const compiledStep of compiled.steps) {
      for (const route of compiledStep.view.activeRoutes) {
        for (const entityId of new Set(
          route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]),
        )) {
          expect(compiledStep.world.entities[entityId]?.kind).not.toMatch(/Deployment|ReplicaSet/);
        }
      }
    }
  });
});
