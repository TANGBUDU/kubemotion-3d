import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { lessonById, scenario } from '../../src/content/loader';
import { courseEngine } from '../../src/course/CourseEngine';
import type { EntityViewState, RelationViewState, ViewProjection } from '../../src/course/types';
import { calculateLayout, type LayoutResult } from '../../src/renderer/LayoutEngine';
import { diagnoseRuntimeLayout } from '../../src/renderer/scene/RuntimeHierarchyDiagnostics';
import type { EntityId, RelationId, WorldSnapshot } from '../../src/world/types';

const projection = (world: WorldSnapshot, view: ViewProjection['view']): ViewProjection => ({
  view,
  cameraPresetId: view,
  entityStates: Object.fromEntries(
    Object.values(world.entities).map((entity) => [
      entity.id,
      { visible: true, emphasis: 'normal', labelMode: 'short' } satisfies EntityViewState,
    ]),
  ) as Record<EntityId, EntityViewState>,
  relationStates: Object.fromEntries(
    Object.values(world.relations).map((relation) => [
      relation.id,
      { visible: true, emphasis: 'normal' } satisfies RelationViewState,
    ]),
  ) as Record<RelationId, RelationViewState>,
  callouts: [],
  activeRoutes: [],
});

const withEntityPosition = (
  layout: LayoutResult,
  entityId: EntityId,
  position: readonly [number, number, number],
): LayoutResult => {
  const entities = new Map(layout.entities);
  const current = entities.get(entityId);
  if (!current) throw new Error(`Missing layout for ${entityId}`);
  entities.set(entityId, { ...current, position });
  return { ...layout, entities };
};

describe('runtime hierarchy diagnostics', () => {
  it('proves every scheduled Pod occupies one non-overlapping Node bay', () => {
    const view = projection(scenario, 'placement');
    const layout = calculateLayout({ world: scenario, view });

    expect(diagnoseRuntimeLayout(scenario, view, layout)).toEqual({
      visibleNodes: 3,
      nodeBays: 12,
      scheduledPods: 3,
      scheduledPodsOutsideBays: 0,
      duplicateBayAssignments: 0,
      podPairOverlaps: 0,
      podSystemModuleOverlaps: 0,
      pendingPods: 0,
      pendingPodsInsideNodes: 0,
    });
  });

  it('rejects a scheduled Pod moved away from its deterministic bay', () => {
    const view = projection(scenario, 'placement');
    const layout = calculateLayout({ world: scenario, view });
    const podId = 'api-object:namespaced:shop:Pod:api-a-old';
    const nodeId = 'infrastructure:cluster:global:Node:worker-a';
    const nodePosition = layout.entities.get(nodeId)?.position;
    if (!nodePosition) throw new Error('worker-a layout is missing');

    const invalid = diagnoseRuntimeLayout(
      scenario,
      view,
      withEntityPosition(layout, podId, nodePosition),
    );
    expect(invalid.scheduledPodsOutsideBays).toBe(1);
  });

  it('uses the rendered Pod AABB when visual geometry protrudes beyond nominal dimensions', () => {
    const view = projection(scenario, 'placement');
    const layout = calculateLayout({ world: scenario, view });
    const podId = 'api-object:namespaced:shop:Pod:api-a-old';
    const podLayout = layout.entities.get(podId);
    if (!podLayout) throw new Error('api-a-old layout is missing');

    const oversizedBounds = new THREE.Box3(
      new THREE.Vector3(podLayout.position[0] - 0.5, 0, podLayout.position[2] - 1),
      new THREE.Vector3(podLayout.position[0] + 0.5, 2, podLayout.position[2] + 1),
    );
    const diagnostics = diagnoseRuntimeLayout(scenario, view, layout, (entityId) =>
      entityId === podId ? oversizedBounds : undefined,
    );

    expect(diagnostics.scheduledPodsOutsideBays).toBe(1);
  });

  it('keeps a newly created Pending Pod outside every Node chassis', () => {
    const lesson = lessonById.get('container-restart-vs-pod-replacement');
    if (!lesson) throw new Error('Golden lesson is missing');
    const compiled = courseEngine.compileLesson(lesson, scenario);
    const pendingStep = compiled.steps.find((step) => step.stepId === 'replacement-pending');
    if (!pendingStep) throw new Error('Pending step is missing');
    const layout = calculateLayout({ world: pendingStep.world, view: pendingStep.view });

    const valid = diagnoseRuntimeLayout(pendingStep.world, pendingStep.view, layout);
    expect(valid.pendingPods).toBe(1);
    expect(valid.pendingPodsInsideNodes).toBe(0);

    const pendingPodId = 'api-object:namespaced:shop:Pod:api-d-new';
    const workerA = layout.entities.get('infrastructure:cluster:global:Node:worker-a');
    if (!workerA) throw new Error('worker-a layout is missing');
    const invalidLayout = withEntityPosition(layout, pendingPodId, workerA.position);
    expect(
      diagnoseRuntimeLayout(pendingStep.world, pendingStep.view, invalidLayout)
        .pendingPodsInsideNodes,
    ).toBe(1);
  });
});
