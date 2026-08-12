import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState } from '../../src/course/types';
import {
  BaseVisualHandle,
  type EntityVisualHandle,
} from '../../src/renderer/visuals/BaseVisualHandle';
import {
  calculateTeachingBounds,
  layoutContainerFramingBounds,
  targetMaxFill,
} from '../../src/renderer/camera/TeachingBounds';
import type { LayoutContainer } from '../../src/renderer/LayoutEngine';
import type { EntityId, WorldEntity } from '../../src/world/types';
import { emphasisScale } from '../../src/renderer/design/effects';

const normalView: EntityViewState = {
  visible: true,
  emphasis: 'normal',
  labelMode: 'short',
};

class HaloFixtureHandle extends BaseVisualHandle {
  public constructor(focusRadius: number) {
    super(entity(`halo-${focusRadius}`), normalView, focusRadius);
  }

  protected updateVisual(): void {}
}

const entity = (id: EntityId, kind = 'Pod'): WorldEntity => ({
  id,
  category: kind === 'Cluster' ? 'infrastructure' : 'runtime-instance',
  kind,
  name: id,
  status: 'running',
  data: {},
  title: { en: id, ja: id, 'zh-CN': id },
  summary: { en: id, ja: id, 'zh-CN': id },
  sourceIds: [],
  visual: { archetype: kind === 'Cluster' ? 'cluster' : 'pod' },
});

const handle = (
  id: EntityId,
  bounds: THREE.Box3,
  options: { readonly kind?: string; readonly foundationOnly?: boolean } = {},
): EntityVisualHandle => {
  const root = new THREE.Group();
  root.visible = true;
  root.userData.activeWorld = true;
  if (options.foundationOnly) root.userData.foundationOnly = true;
  return {
    entityId: id,
    entity: entity(id, options.kind),
    root,
    selectableObjects: [],
    isDisposed: false,
    update: () => undefined,
    setSelected: () => undefined,
    getAnchor: () => bounds.getCenter(new THREE.Vector3()),
    getWorldBounds: (target = new THREE.Box3()) => target.copy(bounds),
    dispose: () => undefined,
  };
};

const emptyRoutes = (): THREE.Group => new THREE.Group();

const calculate = (
  handles: readonly EntityVisualHandle[],
  overrides: Partial<Parameters<typeof calculateTeachingBounds>[0]> = {},
) =>
  calculateTeachingBounds({
    view: 'overview',
    entityHandles: handles,
    occupiedGuideBounds: new THREE.Box3(),
    routeRoot: emptyRoutes(),
    focusedEntityIds: [],
    stageFallbackBounds: new THREE.Box3(
      new THREE.Vector3(-11, -0.1, -7.5),
      new THREE.Vector3(11, 0.5, 7.5),
    ),
    margin: 0,
    ...overrides,
  });

describe('TeachingBounds framing policy', () => {
  it('does not use the full Stage fallback while a teaching entity is visible', () => {
    const result = calculate([
      handle('pod-a', new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1))),
    ]);

    expect(result.usedStageFallback).toBe(false);
    expect(result.primaryBounds.min.toArray()).toEqual([-1, 0, -1]);
    expect(result.primaryBounds.max.toArray()).toEqual([1, 1, 1]);
  });

  it('keeps a foundation-only Cluster out of normal bounds unless selected or authored-focused', () => {
    const pod = handle(
      'pod-a',
      new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)),
    );
    const cluster = handle(
      'cluster',
      new THREE.Box3(new THREE.Vector3(90, 0, 90), new THREE.Vector3(110, 1, 110)),
      { kind: 'Cluster', foundationOnly: true },
    );

    expect(calculate([pod, cluster]).primaryBounds.max.x).toBe(1);
    expect(calculate([pod, cluster], { selectedEntityId: 'cluster' }).primaryBounds.max.x).toBe(
      110,
    );
    expect(calculate([pod, cluster], { focusedEntityIds: ['cluster'] }).primaryBounds.max.x).toBe(
      110,
    );
  });

  it('includes occupied guide bounds but ignores an empty guide box', () => {
    const pod = handle(
      'pod-a',
      new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 1, 1)),
    );
    const occupied = new THREE.Box3(
      new THREE.Vector3(8, -0.05, -2),
      new THREE.Vector3(14, 0.35, 2),
    );

    expect(calculate([pod], { occupiedGuideBounds: occupied }).primaryBounds.max.x).toBe(14);
    expect(calculate([pod], { occupiedGuideBounds: new THREE.Box3() }).primaryBounds.max.x).toBe(1);
  });

  it('includes geometry from every visible active route root', () => {
    const routes = emptyRoutes();
    const visibleRoute = new THREE.Group();
    visibleRoute.position.x = 20;
    visibleRoute.add(new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.2)));
    const hiddenRoute = new THREE.Group();
    hiddenRoute.visible = false;
    hiddenRoute.position.x = 100;
    hiddenRoute.add(new THREE.Mesh(new THREE.BoxGeometry(10, 1, 1)));
    routes.add(visibleRoute, hiddenRoute);

    const result = calculate([], { routeRoot: routes });
    expect(result.usedStageFallback).toBe(false);
    expect(result.routeBounds.min.x).toBeCloseTo(18);
    expect(result.routeBounds.max.x).toBeCloseTo(22);
    expect(result.primaryBounds.max.x).toBeCloseTo(22);
  });

  it('uses the Stage only when all teaching bounds are empty', () => {
    const stage = new THREE.Box3(
      new THREE.Vector3(-11, -0.1, -7.5),
      new THREE.Vector3(11, 0.5, 7.5),
    );
    const result = calculate([], { stageFallbackBounds: stage });

    expect(result.usedStageFallback).toBe(true);
    expect(result.primaryBounds.equals(stage)).toBe(true);
  });

  it('is deterministic for reversed entity and route insertion order', () => {
    const left = handle(
      'left',
      new THREE.Box3(new THREE.Vector3(-5, 0, -1), new THREE.Vector3(-3, 1, 1)),
    );
    const right = handle(
      'right',
      new THREE.Box3(new THREE.Vector3(4, 0, -1), new THREE.Vector3(6, 2, 1)),
    );
    const forward = calculate([left, right], { margin: 0.55 });
    const reverse = calculate([right, left], { margin: 0.55 });

    expect(forward.primaryBounds.equals(reverse.primaryBounds)).toBe(true);
    expect(forward.entityBounds.equals(reverse.entityBounds)).toBe(true);
  });

  it('derives compact guide height and applies the per-view mobile fill cap', () => {
    const container: LayoutContainer = {
      id: 'workload',
      kind: 'workload-lane',
      label: 'WORKLOAD',
      bounds: { center: [4, 0.025, -2], size: [8, 0.05, 3] },
      slots: [{ id: 'slot-0', index: 0, position: [4, 0.2, -2], occupiedBy: 'pod-a' }],
    };
    const bounds = layoutContainerFramingBounds(container);

    expect(bounds.min.toArray()).toEqual([0, -0.05, -3.5]);
    expect(bounds.max.toArray()).toEqual([8, 0.35, -0.5]);
    expect(targetMaxFill('placement', 1_280)).toBe(0.88);
    expect(targetMaxFill('placement', 390)).toBe(0.82);
    expect(targetMaxFill('overview', 390)).toBe(0.8);
  });

  it('uses the restrained focus scale and clamps compact halo radii without WebGL', () => {
    expect(emphasisScale('focused')).toBe(1.04);

    const small = new HaloFixtureHandle(0.1);
    const large = new HaloFixtureHandle(8);
    const smallHalo = small.root.getObjectByName('focus-halo') as THREE.Mesh<THREE.CircleGeometry>;
    const largeHalo = large.root.getObjectByName('focus-halo') as THREE.Mesh<THREE.CircleGeometry>;
    expect(smallHalo.geometry.parameters.radius).toBe(0.42);
    expect(largeHalo.geometry.parameters.radius).toBe(1.22);
    small.dispose();
    large.dispose();
  });
});
