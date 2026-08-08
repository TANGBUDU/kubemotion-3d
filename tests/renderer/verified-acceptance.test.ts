import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lessonById, scenarioById } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import type { CompiledStep, ViewMode } from '../../src/course/types';
import { calculateLayout, type LayoutResult } from '../../src/renderer/LayoutEngine';
import { RelationLayer } from '../../src/renderer/relations/RelationLayer';
import { RouteObstacleMap } from '../../src/renderer/relations/RouteObstacleMap';
import { RoutePlanner } from '../../src/renderer/relations/RoutePlanner';
import { RouteSceneAdapter } from '../../src/renderer/relations/RouteSceneAdapter';
import { getTeachingRouteStyle } from '../../src/renderer/relations/RelationStyleCatalog';
import { boundsForHandles } from '../../src/renderer/camera/CameraFramer';
import { OrthographicLessonCamera } from '../../src/renderer/camera/OrthographicLessonCamera';
import { SceneRegistry } from '../../src/renderer/SceneRegistry';
import { createEffectiveScenePlan } from '../../src/renderer/scene-grammar';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';

const lessonIds = [
  'cluster-overview',
  'pod-and-placement',
  'manifest-to-running-pod',
  'service-routes-to-pods',
  'container-restart-vs-pod-replacement',
] as const;

function compiledLesson(lessonId: (typeof lessonIds)[number]) {
  const lesson = lessonById.get(lessonId);
  if (!lesson) throw new Error(`Missing verified lesson ${lessonId}`);
  const scenario = scenarioById.get(lesson.scenarioId);
  if (!scenario) throw new Error(`Missing verified scenario ${lesson.scenarioId}`);
  return courseEngine.compileLesson(lesson, scenario);
}

function cameraDirection(view: ViewMode): THREE.Vector3 {
  if (view === 'logical') return new THREE.Vector3(0, 1.55, 1);
  if (view === 'placement') return new THREE.Vector3(1, 1.45, 1);
  if (view === 'control-flow' || view === 'traffic') return new THREE.Vector3(0.15, 1.3, 1);
  return new THREE.Vector3(0.8, 1.5, 1);
}

const viewportGates = [
  {
    viewport: { width: 1440, height: 900 },
    insets: { top: 58, right: 438, bottom: 58, left: 12 },
  },
  {
    viewport: { width: 1280, height: 720 },
    insets: { top: 54, right: 390, bottom: 54, left: 12 },
  },
  {
    viewport: { width: 390, height: 844 },
    insets: { top: 52, right: 12, bottom: 360, left: 12 },
  },
] as const;

function projectBox(box: THREE.Box3, camera: THREE.Camera, width: number, height: number) {
  const points = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ].map((point) => point.project(camera));
  const xs = points.map((point) => ((point.x + 1) / 2) * width);
  const ys = points.map((point) => ((1 - point.y) / 2) * height);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  };
}

function sceneFor(step: CompiledStep, layout: LayoutResult) {
  const root = new THREE.Group();
  const registry = new SceneRegistry(root, new VisualFactoryRegistry(), { allowGeneric: false });
  const retainedExitIds = new Set(step.worldDiff.removedEntities.map((entity) => entity.id));
  if (retainedExitIds.size > 0) {
    const exitTargets = new Set(
      step.transition.cues.flatMap((cue) => (cue.type === 'entity-exit' ? [cue.entityId] : [])),
    );
    const authoredBeforeView = {
      ...step.view,
      entityStates: Object.fromEntries(
        Object.values(step.beforeWorld.entities).map((entity) => [
          entity.id,
          step.view.entityStates[entity.id] ?? {
            visible: exitTargets.has(entity.id),
            emphasis: exitTargets.has(entity.id) ? 'focused' : 'hidden',
            labelMode: exitTargets.has(entity.id) ? 'full' : 'none',
          },
        ]),
      ),
      relationStates: Object.fromEntries(
        Object.values(step.beforeWorld.relations).map((relation) => [
          relation.id,
          step.view.relationStates[relation.id] ?? {
            visible: false,
            emphasis: 'normal',
          },
        ]),
      ),
    } as typeof step.view;
    const beforeView = createEffectiveScenePlan(step.beforeWorld, authoredBeforeView, {
      viewport: 'desktop',
      applyGrammarDefaults: false,
    }).projection;
    registry.sync(step.beforeWorld, beforeView);
    registry.applyLayout(calculateLayout({ world: step.beforeWorld, view: beforeView }));
  }
  registry.sync(step.world, step.view, retainedExitIds);
  registry.applyLayout(layout);
  const routeRoot = new THREE.Group();
  root.add(routeRoot);
  const adapter = new RouteSceneAdapter(registry);
  const obstacleMap = new RouteObstacleMap(registry);
  const routes = new RelationLayer(
    routeRoot,
    new RoutePlanner(adapter, obstacleMap, {
      preferredLaneX: [-9.4, -6.4, 0, 6.4, 9.4],
      preferredLaneZ: [-6.7, -3.3, 3.3, 6.7],
    }),
    { width: 1440, height: 900, pixelRatio: 1 },
  );
  routes.syncActiveRoutes(step.view.activeRoutes);
  return {
    registry,
    routes,
    dispose: () => {
      routes.dispose();
      registry.clear();
      root.clear();
    },
  };
}

describe('verified visual-acceptance metadata', () => {
  it('has one primary focus, no more than two callouts, and a highest-emphasis active route', () => {
    for (const lessonId of lessonIds) {
      for (const step of compiledLesson(lessonId).steps) {
        if (step.view.comparison) continue;
        const focused = Object.entries(step.view.entityStates).filter(
          ([, state]) => state.visible && state.emphasis === 'focused',
        );
        expect(focused, `${lessonId}/${step.stepId} primary focus`).toHaveLength(1);
        expect(
          step.view.callouts.length,
          `${lessonId}/${step.stepId} callouts`,
        ).toBeLessThanOrEqual(2);
        for (const route of step.view.activeRoutes) {
          const style = getTeachingRouteStyle(route.semantic);
          expect(style.widthCssPx).toBeGreaterThanOrEqual(4);
          expect(style.opacity).toBeGreaterThanOrEqual(0.98);
          expect(style.renderOrder).toBeGreaterThanOrEqual(20);
          expect(style.arrowhead).toBe(true);
        }
      }
    }
  });

  it('keeps the two golden peer Pods dimmed whenever they are visible', () => {
    const compiled = compiledLesson('container-restart-vs-pod-replacement');
    const peerIds = [
      'api-object:namespaced:shop:Pod:api-b',
      'api-object:namespaced:shop:Pod:api-c',
    ];
    for (const step of compiled.steps) {
      for (const peerId of peerIds) {
        const state = step.view.entityStates[peerId];
        if (state?.visible) expect(state.emphasis).toBe('dimmed');
      }
    }
  });

  it('produces identical final layouts and active routes for direct and sequential navigation', () => {
    for (const lessonId of lessonIds) {
      let previous: LayoutResult | undefined;
      for (const step of compiledLesson(lessonId).steps) {
        const sequential = calculateLayout({
          world: step.world,
          view: step.view,
          ...(previous ? { previous } : {}),
        });
        const direct = calculateLayout({ world: step.world, view: step.view });
        expect([...sequential.positions.entries()]).toEqual([...direct.positions.entries()]);

        const sequentialScene = sceneFor(step, sequential);
        const directScene = sceneFor(step, direct);
        try {
          for (const route of step.view.activeRoutes) {
            expect(sequentialScene.routes.getRoute(route.id)?.plan.stableKey).toBe(
              directScene.routes.getRoute(route.id)?.plan.stableKey,
            );
          }
        } finally {
          sequentialScene.dispose();
          directScene.dispose();
        }
        previous = sequential;
      }
    }
  }, 20_000);

  it('fits real entity and route bounds inside the 6% safe frame at every required viewport', () => {
    for (const lessonId of lessonIds) {
      let previous: LayoutResult | undefined;
      for (const step of compiledLesson(lessonId).steps) {
        if (step.view.comparison) continue;
        const layout = calculateLayout({
          world: step.world,
          view: step.view,
          ...(previous ? { previous } : {}),
        });
        const scene = sceneFor(step, layout);
        try {
          const bounds = boundsForHandles(scene.registry.values());
          const routeBounds = new THREE.Box3().setFromObject(scene.routes.root, true);
          if (!routeBounds.isEmpty()) bounds.union(routeBounds);
          for (const gate of viewportGates) {
            const camera = new OrthographicLessonCamera();
            const fit = camera.fit(
              bounds,
              { viewport: gate.viewport, insets: gate.insets, safeFrameRatio: 0.06 },
              { direction: cameraDirection(step.view.view) },
            );
            const projected = projectBox(
              bounds,
              camera.camera,
              gate.viewport.width,
              gate.viewport.height,
            );
            const safe = fit.safeViewport.safeRect;
            const tolerance = 0.75;
            expect(projected.x).toBeGreaterThanOrEqual(safe.x - tolerance);
            expect(projected.y).toBeGreaterThanOrEqual(safe.y - tolerance);
            expect(projected.x + projected.width).toBeLessThanOrEqual(
              safe.x + safe.width + tolerance,
            );
            expect(projected.y + projected.height).toBeLessThanOrEqual(
              safe.y + safe.height + tolerance,
            );
          }
        } finally {
          scene.dispose();
        }
        previous = layout;
      }
    }
  });
});
