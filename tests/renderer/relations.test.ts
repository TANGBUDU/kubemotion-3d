import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { describe, expect, it, vi } from 'vitest';
import type { ActiveTeachingRoute, RouteAnchorKind } from '../../src/course/types';
import { RelationLayer } from '../../src/renderer/relations/RelationLayer';
import {
  getContextRelationStyle,
  getTeachingRouteStyle,
  isActiveRouteWidth,
} from '../../src/renderer/relations/RelationStyleCatalog';
import { RoutePlanner, routeIntersectsObstacle } from '../../src/renderer/relations/RoutePlanner';
import { RouteMarkerPool } from '../../src/renderer/relations/RouteMarkerPool';
import {
  RouteSceneAdapter,
  type RouteVisualHandle,
} from '../../src/renderer/relations/RouteSceneAdapter';
import { WideLineHandle } from '../../src/renderer/relations/WideLineHandle';
import type {
  RouteAnchorResolver,
  RouteObstacle,
  RouteObstacleProvider,
  RouteSemantic,
} from '../../src/renderer/relations/relationTypes';

class TestAnchors implements RouteAnchorResolver {
  private readonly values = new Map<string, THREE.Vector3>();

  public set(entityId: string, anchor: RouteAnchorKind, point: THREE.Vector3): this {
    this.values.set(`${entityId}:${anchor}`, point.clone());
    return this;
  }

  public resolveAnchor(entityId: string, anchor: RouteAnchorKind): THREE.Vector3 | undefined {
    return this.values.get(`${entityId}:${anchor}`)?.clone();
  }
}

class TestObstacles implements RouteObstacleProvider {
  public constructor(public values: readonly RouteObstacle[]) {}
  public getObstacles(): readonly RouteObstacle[] {
    return this.values;
  }
}

const oneHopRoute = (
  id = 'control-route',
  semantic: RouteSemantic = 'control',
  persistAfterAnimation = true,
): ActiveTeachingRoute => ({
  id,
  semantic,
  persistAfterAnimation,
  hops: [
    {
      fromEntityId: 'a',
      fromAnchor: 'control',
      toEntityId: 'b',
      toAnchor: 'control',
    },
  ],
});

const multiHopRoute = (id = 'api-mediated'): ActiveTeachingRoute => ({
  id,
  semantic: 'control',
  persistAfterAnimation: true,
  numbered: true,
  hops: [
    {
      fromEntityId: 'a',
      fromAnchor: 'control',
      toEntityId: 'b',
      toAnchor: 'control',
    },
    {
      fromEntityId: 'b',
      fromAnchor: 'control',
      toEntityId: 'c',
      toAnchor: 'control',
    },
  ],
});

const basicAnchors = (): TestAnchors =>
  new TestAnchors()
    .set('a', 'control', new THREE.Vector3(0, 0.5, 0))
    .set('b', 'control', new THREE.Vector3(10, 0.5, 0))
    .set('c', 'control', new THREE.Vector3(14, 0.5, 4));

const serializePoints = (points: readonly THREE.Vector3[]): readonly number[][] =>
  points.map((point) => point.toArray());

describe('RelationStyleCatalog', () => {
  it('enforces readable active-route hierarchy and containment-by-nesting', () => {
    const semantics: readonly RouteSemantic[] = [
      'control',
      'scheduling',
      'data-flow',
      'dns',
      'node-runtime',
    ];
    for (const semantic of semantics) {
      const style = getTeachingRouteStyle(semantic);
      expect(isActiveRouteWidth(style)).toBe(true);
      expect(style.widthCssPx).toBeGreaterThanOrEqual(4);
      expect(style.arrowhead).toBe(true);
      expect(style.opacity).toBeGreaterThanOrEqual(0.95);
    }
    expect(getTeachingRouteStyle('control').dashed).toBe(true);
    expect(getTeachingRouteStyle('dns').dashed).toBe(true);
    expect(getTeachingRouteStyle('data-flow').chevrons).toBe(true);
    expect(getTeachingRouteStyle('scheduling').color).not.toBe(
      getTeachingRouteStyle('control').color,
    );
    expect(getTeachingRouteStyle('node-runtime')).toMatchObject({
      semantic: 'node-runtime',
      dashed: true,
      widthCssPx: 4.75,
      arrowhead: true,
      tokenCount: 1,
    });
    expect(getTeachingRouteStyle('node-runtime').dashSize).toBeLessThan(
      getTeachingRouteStyle('control').dashSize,
    );
    expect(getTeachingRouteStyle('node-runtime').color).not.toBe(
      getTeachingRouteStyle('control').color,
    );
    expect(getContextRelationStyle('composition').externalLine).toBe(false);
    expect(getContextRelationStyle('ownership').widthCssPx).toBeLessThan(2.25);
    expect(getContextRelationStyle('ownership', 'dimmed').opacity).toBeLessThan(
      getContextRelationStyle('ownership').opacity,
    );
  });
});

describe('WideLineHandle', () => {
  it('keeps Line2 width and resolution in logical CSS pixels across DPR changes', () => {
    const style = getTeachingRouteStyle('data-flow');
    const handle = new WideLineHandle(
      'route',
      [new THREE.Vector3(0, 1, 0), new THREE.Vector3(4, 1, 2)],
      style,
      { width: 800, height: 600, pixelRatio: 2 },
    );
    expect(handle.line).toBeInstanceOf(Line2);
    expect(handle.geometry).toBeInstanceOf(LineGeometry);
    expect(handle.material).toBeInstanceOf(LineMaterial);
    expect(handle.material.linewidth).toBe(style.widthCssPx);
    expect(handle.material.resolution.toArray()).toEqual([800, 600]);
    expect(handle.line.renderOrder).toBe(style.renderOrder);

    handle.setResolution(1_280, 720, 1.5);
    expect(handle.material.resolution.toArray()).toEqual([1_280, 720]);
    expect(handle.material.linewidth).toBe(style.widthCssPx);
    handle.dispose();
  });

  it('disposes replaced geometry, preserves material, then disposes current resources once', () => {
    const handle = new WideLineHandle(
      'route',
      [new THREE.Vector3(), new THREE.Vector3(2, 0, 0)],
      getTeachingRouteStyle('control'),
      { width: 800, height: 600, pixelRatio: 1 },
    );
    const geometry = handle.geometry;
    const material = handle.material;
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    handle.updatePoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 1),
      new THREE.Vector3(4, 0, 1),
    ]);
    const currentGeometry = handle.geometry;
    const currentGeometryDispose = vi.spyOn(currentGeometry, 'dispose');
    handle.applyStyle(getTeachingRouteStyle('scheduling'));
    expect(handle.geometry).not.toBe(geometry);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(handle.material).toBe(material);
    expect(handle.sample(1).toArray()).toEqual([4, 0, 1]);
    expect(handle.material.dashed).toBe(false);
    handle.dispose();
    handle.dispose();
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(currentGeometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(() => handle.setResolution(1, 1)).toThrow(/disposed/);
  });

  it('rejects invalid geometry and invalid viewport dimensions', () => {
    expect(
      () =>
        new WideLineHandle('invalid', [new THREE.Vector3()], getTeachingRouteStyle('control'), {
          width: 800,
          height: 600,
          pixelRatio: 1,
        }),
    ).toThrow(/at least two points/);
    expect(
      () =>
        new WideLineHandle(
          'invalid-resolution',
          [new THREE.Vector3(), new THREE.Vector3(1, 0, 0)],
          getTeachingRouteStyle('control'),
          { width: 0, height: 600, pixelRatio: 1 },
        ),
    ).toThrow(/positive finite/);
  });
});

describe('RoutePlanner', () => {
  it('deterministically avoids unrelated AABB footprints', () => {
    const obstacle: RouteObstacle = {
      entityId: 'blocker',
      bounds: new THREE.Box3(new THREE.Vector3(4, 0, -1), new THREE.Vector3(6, 3, 1)),
    };
    const planner = new RoutePlanner(basicAnchors(), new TestObstacles([obstacle]), {
      obstacleClearance: 0.3,
    });
    const first = planner.plan(oneHopRoute());
    const second = planner.plan(oneHopRoute());
    expect(first.stableKey).toBe(second.stableKey);
    expect(serializePoints(first.points)).toEqual(serializePoints(second.points));
    expect(routeIntersectsObstacle(first.points, obstacle, 0.3)).toBe(false);
    expect(first.points.length).toBeGreaterThan(4);
    expect(first.points[0]?.toArray()).toEqual([0, 0.5, 0]);
    expect(first.points.at(-1)?.toArray()).toEqual([10, 0.5, 0]);
  });

  it('plans ordered multi-hop routes and stable numbered marker positions', () => {
    const planner = new RoutePlanner(basicAnchors());
    const route = multiHopRoute();
    const plan = planner.plan(route);
    expect(plan.hops).toHaveLength(2);
    expect(plan.markers.map((marker) => marker.number)).toEqual([1, 2]);
    expect(plan.markers.map((marker) => marker.hopIndex)).toEqual([0, 1]);
    expect(plan.totalLength).toBeGreaterThan(0);
    expect(plan.points[0]?.toArray()).toEqual([0, 0.5, 0]);
    expect(plan.points.at(-1)?.toArray()).toEqual([14, 0.5, 4]);
    expect(serializePoints(planner.plan(route).points)).toEqual(serializePoints(plan.points));
  });

  it('ignores endpoint entities as obstacles but rejects missing anchors', () => {
    const endpointObstacle: RouteObstacle = {
      entityId: 'a',
      bounds: new THREE.Box3(new THREE.Vector3(-1, 0, -1), new THREE.Vector3(1, 2, 1)),
    };
    const planner = new RoutePlanner(basicAnchors(), new TestObstacles([endpointObstacle]));
    expect(() => planner.plan(oneHopRoute())).not.toThrow();

    const missing = new RoutePlanner(new TestAnchors());
    expect(() => missing.plan(oneHopRoute())).toThrow(/cannot resolve/);
  });

  it('ignores hierarchy shells that enclose a nested route endpoint', () => {
    const enclosingNode: RouteObstacle = {
      entityId: 'node:worker-a',
      bounds: new THREE.Box3(new THREE.Vector3(8, 0, -2), new THREE.Vector3(12, 3, 2)),
    };
    const planner = new RoutePlanner(basicAnchors(), new TestObstacles([enclosingNode]));
    expect(() => planner.plan(oneHopRoute())).not.toThrow();
    expect(planner.plan(oneHopRoute()).points.at(-1)?.toArray()).toEqual([10, 0.5, 0]);
  });

  it('ignores an enclosing shell when its nested anchor sits just outside the raw AABB', () => {
    const nearEndpointShell: RouteObstacle = {
      entityId: 'node:worker-a',
      bounds: new THREE.Box3(new THREE.Vector3(8, 0, -1), new THREE.Vector3(9.8, 3, 1)),
    };
    const planner = new RoutePlanner(basicAnchors(), new TestObstacles([nearEndpointShell]), {
      obstacleClearance: 0.32,
    });
    expect(() => planner.plan(oneHopRoute())).not.toThrow();
  });
});

describe('RouteMarkerPool', () => {
  it('reuses vector marker objects and disposes every owned GPU resource exactly once', () => {
    const root = new THREE.Group();
    const pool = new RouteMarkerPool(root);
    const appearance = { color: 0x38bdf8, opacity: 1, renderOrder: 20 };
    const first = pool.acquire(appearance);
    const second = pool.acquire(appearance);
    first.setMarker({ number: 1, hopIndex: 0, position: new THREE.Vector3(1, 2, 3) }, 'numbered');
    second.setMarker({ number: 2, hopIndex: 1, position: new THREE.Vector3(4, 5, 6) }, 'numbered');

    const objects = [first.object, second.object];
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const object of objects) {
      object.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        geometries.add(child.geometry as THREE.BufferGeometry);
        const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
        childMaterials.forEach((material) => materials.add(material));
        expect((child.material as THREE.MeshBasicMaterial).map).toBeNull();
      });
    }
    first.release();
    expect(pool.leasedCount).toBe(1);
    expect(pool.pooledCount).toBe(1);
    const reused = pool.acquire(appearance);
    expect(reused.object).toBe(first.object);
    reused.setMarker(
      { number: 12, hopIndex: 11, position: new THREE.Vector3(-2, 1, 8) },
      'numbered',
    );
    expect(reused.object.userData.markerNumber).toBe(12);
    expect(reused.object.userData.vectorGlyph).toBe(true);
    reused.object.traverse((child) => {
      if (child instanceof THREE.Mesh) geometries.add(child.geometry as THREE.BufferGeometry);
    });
    const geometryDisposals = [...geometries].map((geometry) => vi.spyOn(geometry, 'dispose'));
    const materialDisposals = [...materials].map((material) => vi.spyOn(material, 'dispose'));

    pool.dispose();
    pool.dispose();
    expect(pool.leasedCount).toBe(0);
    expect(pool.pooledCount).toBe(0);
    expect(root.children).toHaveLength(0);
    geometryDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    materialDisposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    expect(() => pool.acquire(appearance)).toThrow(/disposed/);
  });
});

describe('RouteSceneAdapter', () => {
  it('uses handle bounds when available and falls back to visible root bounds', () => {
    const firstRoot = new THREE.Group();
    firstRoot.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2)));
    firstRoot.position.set(3, 0, 0);
    const secondRoot = new THREE.Group();
    secondRoot.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
    secondRoot.position.set(-3, 0, 0);
    const hiddenRoot = new THREE.Group();
    hiddenRoot.visible = false;
    const explicitBounds = new THREE.Box3(new THREE.Vector3(2, -1, -1), new THREE.Vector3(4, 1, 1));
    const handles: RouteVisualHandle[] = [
      {
        entityId: 'first',
        root: firstRoot,
        getAnchor: () => new THREE.Vector3(3, 1, 0),
        getWorldBounds: (target = new THREE.Box3()) => target.copy(explicitBounds),
      },
      {
        entityId: 'second',
        root: secondRoot,
        getAnchor: () => new THREE.Vector3(-3, 1, 0),
      },
      {
        entityId: 'hidden',
        root: hiddenRoot,
        getAnchor: () => new THREE.Vector3(),
      },
    ];
    const registry = {
      get: (entityId: string) => handles.find((handle) => handle.entityId === entityId),
      values: () => handles.values(),
    };
    const adapter = new RouteSceneAdapter(registry);
    expect(adapter.resolveAnchor('first', 'control')?.toArray()).toEqual([3, 1, 0]);
    expect(adapter.resolveAnchor('hidden', 'control')).toBeUndefined();
    const obstacles = adapter.getObstacles();
    expect(obstacles.map((obstacle) => obstacle.entityId)).toEqual(['first', 'second']);
    expect(obstacles[0]?.bounds.min.toArray()).toEqual([2, -1, -1]);
    expect(obstacles[1]?.bounds.containsPoint(new THREE.Vector3(-3, 0, 0))).toBe(true);
  });
});

describe('RelationLayer and RouteHandle', () => {
  it('renders numbered multi-hop markers and preserves them across resize and reduced motion', () => {
    const scene = new THREE.Scene();
    const planner = new RoutePlanner(basicAnchors());
    const layer = new RelationLayer(scene, planner, {
      width: 1_280,
      height: 720,
      pixelRatio: 1,
    });
    const route = multiHopRoute('numbered-control-flow');
    layer.syncActiveRoutes([route]);
    const handle = layer.getRoute(route.id);
    const plan = planner.plan(route);
    const markers = handle?.root.children.filter(
      (child): child is THREE.Group => child.userData.role === 'route-step-marker',
    );

    expect(handle?.markerCount).toBe(2);
    expect(layer.diagnostics.leasedRouteMarkers).toBe(2);
    expect(markers?.map((marker) => marker.userData.markerNumber)).toEqual([1, 2]);
    expect(markers?.map((marker) => marker.userData.hopIndex)).toEqual([0, 1]);
    markers?.forEach((marker, index) => {
      const planned = plan.markers[index];
      expect(planned).toBeDefined();
      expect(marker.position.x).toBeCloseTo(planned?.position.x ?? Number.NaN);
      expect(marker.position.z).toBeCloseTo(planned?.position.z ?? Number.NaN);
      expect(marker.position.y).toBeGreaterThan(planned?.position.y ?? Number.POSITIVE_INFINITY);
      expect(marker.getObjectByName('route-marker-vector-glyph')).toBeInstanceOf(THREE.Mesh);
    });

    const identities = markers ? [...markers] : [];
    handle?.setVisible(false);
    expect(markers?.every((marker) => !marker.visible)).toBe(true);
    handle?.setVisible(true);
    layer.setResolution(390, 844, 2);
    layer.setReducedMotion(true);
    expect(handle?.root.visible).toBe(true);
    expect(handle?.markerCount).toBe(2);
    expect(markers?.every((marker) => marker.visible)).toBe(true);
    expect(
      handle?.root.children.filter((child) => child.userData.role === 'route-step-marker'),
    ).toEqual(identities);
    layer.dispose();
  });

  it('updates marker positions in place and pools badges when numbering is removed', () => {
    const scene = new THREE.Scene();
    const anchors = basicAnchors();
    const planner = new RoutePlanner(anchors);
    const layer = new RelationLayer(scene, planner, {
      width: 800,
      height: 600,
      pixelRatio: 1,
    });
    const route = multiHopRoute('updating-markers');
    layer.syncActiveRoutes([route]);
    const handle = layer.getRoute(route.id);
    const before = handle?.root.children.filter(
      (child): child is THREE.Group => child.userData.role === 'route-step-marker',
    );
    const secondBefore = before?.[1]?.position.clone();

    anchors.set('c', 'control', new THREE.Vector3(18, 0.5, -4));
    expect(layer.syncActiveRoutes([route]).updated).toEqual([route.id]);
    const after = handle?.root.children.filter(
      (child): child is THREE.Group => child.userData.role === 'route-step-marker',
    );
    expect(after).toEqual(before);
    expect(after?.map((marker) => marker.userData.markerNumber)).toEqual([1, 2]);
    expect(after?.[1]?.position.equals(secondBefore ?? new THREE.Vector3())).toBe(false);

    const unnumbered = { ...route, numbered: false };
    layer.syncActiveRoutes([unnumbered]);
    expect(handle?.markerCount).toBe(0);
    expect(layer.diagnostics.leasedRouteMarkers).toBe(0);
    expect(layer.diagnostics.pooledRouteMarkers).toBe(2);
    layer.syncActiveRoutes([route]);
    expect(handle?.markerCount).toBe(2);
    expect(layer.diagnostics.leasedRouteMarkers).toBe(2);
    expect(layer.diagnostics.pooledRouteMarkers).toBe(0);
    expect(
      new Set(handle?.root.children.filter((child) => child.userData.role === 'route-step-marker')),
    ).toEqual(new Set(before));
    layer.dispose();
  });

  it('keeps persistent direction visible with reduced motion and exposes the settled path', () => {
    const scene = new THREE.Scene();
    const layer = new RelationLayer(scene, new RoutePlanner(basicAnchors()), {
      width: 1_280,
      height: 720,
      pixelRatio: 1,
    });
    const route = oneHopRoute('traffic', 'data-flow');
    expect(layer.syncActiveRoutes([route])).toEqual({
      added: ['traffic'],
      updated: [],
      removed: [],
    });
    const handle = layer.getRoute('traffic');
    expect(handle).toBeDefined();
    expect(handle?.line.line).toBeInstanceOf(Line2);
    expect(handle?.line.material.linewidth).toBeGreaterThanOrEqual(4);
    expect(handle?.arrowheadCount).toBeGreaterThan(0);
    expect(handle?.root.visible).toBe(true);
    const points = layer.getRoutePoints('traffic');
    expect(points?.length).toBeGreaterThanOrEqual(2);
    points?.[0]?.set(999, 999, 999);
    expect(layer.getRoutePoints('traffic')?.[0]?.x).not.toBe(999);

    layer.setFlowProgress('traffic', 0.4);
    expect(layer.diagnostics.leasedFlowTokens).toBe(2);
    layer.setReducedMotion(true);
    expect(layer.diagnostics.leasedFlowTokens).toBe(0);
    expect(handle?.root.visible).toBe(true);
    expect(handle?.arrowheadCount).toBeGreaterThan(0);
    expect(layer.sampleRoute('traffic', 1)?.toArray()).toEqual([10, 0.5, 0]);
    layer.dispose();
  });

  it('binds request identity to the route and its pooled flow tokens', () => {
    const scene = new THREE.Scene();
    const layer = new RelationLayer(scene, new RoutePlanner(basicAnchors()), {
      width: 800,
      height: 600,
      pixelRatio: 1,
    });
    const route = {
      ...oneHopRoute('request-b-route', 'data-flow'),
      requestId: 'request-b',
    } as ActiveTeachingRoute & { readonly requestId: string };

    layer.syncActiveRoutes([route]);
    const handle = layer.getRoute(route.id);
    expect(handle?.root.userData.requestId).toBe('request-b');
    layer.setFlowProgress(route.id, 0);
    const tokens = handle?.root.children.filter((child) => child.name === 'route-flow-token') ?? [];
    expect(tokens).toHaveLength(2);
    expect(tokens.every((token) => token.userData.requestId === 'request-b')).toBe(true);

    handle?.clearFlowTokens();
    expect(tokens.every((token) => token.userData.requestId === undefined)).toBe(true);
    layer.dispose();
  });

  it('reuses pooled arrows/tokens and does not replace a stable route material', () => {
    const scene = new THREE.Scene();
    const planner = new RoutePlanner(basicAnchors());
    const layer = new RelationLayer(scene, planner, {
      width: 800,
      height: 600,
      pixelRatio: 1,
    });
    const route = oneHopRoute('scheduled', 'scheduling');
    layer.syncActiveRoutes([route]);
    const firstHandle = layer.getRoute('scheduled');
    const firstMaterial = firstHandle?.line.material;
    layer.setFlowProgress('scheduled', 0.5);
    expect(layer.diagnostics.leasedFlowTokens).toBe(1);
    firstHandle?.clearFlowTokens();
    expect(layer.diagnostics.pooledFlowTokens).toBe(1);

    expect(layer.syncActiveRoutes([route]).updated).toEqual(['scheduled']);
    expect(layer.getRoute('scheduled')).toBe(firstHandle);
    expect(layer.getRoute('scheduled')?.line.material).toBe(firstMaterial);
    const leasedArrows = layer.diagnostics.leasedArrowheads;
    layer.syncActiveRoutes([]);
    expect(layer.diagnostics.leasedArrowheads).toBe(0);
    expect(layer.diagnostics.pooledArrowheads).toBe(leasedArrows);
    layer.syncActiveRoutes([route]);
    expect(layer.diagnostics.leasedArrowheads).toBe(leasedArrows);
    expect(layer.diagnostics.pooledArrowheads).toBe(0);
    layer.dispose();
  });

  it('updates every LineMaterial resolution and applies sync atomically', () => {
    const scene = new THREE.Scene();
    const planner = new RoutePlanner(basicAnchors());
    const layer = new RelationLayer(scene, planner, {
      width: 800,
      height: 600,
      pixelRatio: 1,
    });
    const route = oneHopRoute('control');
    layer.syncActiveRoutes([route]);
    layer.setResolution(1_440, 900, 2);
    expect(layer.getRoute('control')?.line.material.resolution.toArray()).toEqual([1_440, 900]);
    expect(layer.getRoute('control')?.line.material.linewidth).toBe(
      getTeachingRouteStyle('control').widthCssPx,
    );

    const invalid: ActiveTeachingRoute = {
      ...route,
      id: 'invalid',
      hops: [
        {
          fromEntityId: 'missing',
          fromAnchor: 'control',
          toEntityId: 'b',
          toAnchor: 'control',
        },
      ],
    };
    expect(() => layer.syncActiveRoutes([invalid])).toThrow(/cannot resolve/);
    expect(layer.getRoute('control')).toBeDefined();
    expect(layer.size).toBe(1);
    expect(() => layer.syncActiveRoutes([route, route])).toThrow(/unique/);
    expect(layer.size).toBe(1);
    layer.dispose();
  });

  it('honors persistAfterAnimation without ever removing settled reduced-motion meaning', () => {
    const scene = new THREE.Scene();
    const layer = new RelationLayer(scene, new RoutePlanner(basicAnchors()), {
      width: 800,
      height: 600,
      pixelRatio: 1,
    });
    const persistent = oneHopRoute('persistent', 'control', true);
    layer.syncActiveRoutes([persistent]);
    layer.setFlowProgress('persistent', 0.8);
    layer.finishFlow('persistent');
    expect(layer.getRoute('persistent')?.root.visible).toBe(true);

    const transient = oneHopRoute('transient', 'control', false);
    layer.syncActiveRoutes([transient]);
    layer.setFlowProgress('transient', 0.8);
    layer.finishFlow('transient');
    expect(layer.getRoute('transient')?.root.visible).toBe(false);
    layer.setReducedMotion(true);
    expect(layer.getRoute('transient')?.root.visible).toBe(true);
    expect(layer.getRoute('transient')?.arrowheadCount).toBeGreaterThan(0);
    layer.dispose();
  });
});
