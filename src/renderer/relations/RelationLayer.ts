import * as THREE from 'three';
import { ArrowheadPool } from './ArrowheadPool';
import { FlowTokenPool } from './FlowTokenPool';
import { RouteHandle } from './RouteHandle';
import { RouteMarkerPool } from './RouteMarkerPool';
import type { RoutePlanner } from './RoutePlanner';
import { countStrongXReversals } from './polyline';
import type {
  ActiveTeachingRoute,
  RelationLayerDiagnostics,
  RouteSyncResult,
  ViewportResolution,
} from './relationTypes';

const validateResolution = (
  width: number,
  height: number,
  pixelRatio: number,
): ViewportResolution => {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !Number.isFinite(pixelRatio) ||
    width <= 0 ||
    height <= 0 ||
    pixelRatio <= 0
  ) {
    throw new Error('Relation layer resolution and pixel ratio must be positive finite values.');
  }
  return { width, height, pixelRatio };
};

/**
 * Persistent route registry. It plans every requested route before mutating the scene, making a
 * failed sync atomic from the renderer's point of view.
 */
export class RelationLayer {
  public readonly root = new THREE.Group();
  private readonly handles = new Map<string, RouteHandle>();
  private readonly arrowheads: ArrowheadPool;
  private readonly flowTokens: FlowTokenPool;
  private readonly routeMarkers: RouteMarkerPool;
  private resolution: ViewportResolution;
  private reducedMotion = false;
  private disposed = false;

  public constructor(
    scene: THREE.Object3D,
    private readonly planner: RoutePlanner,
    resolution: ViewportResolution,
  ) {
    this.resolution = validateResolution(
      resolution.width,
      resolution.height,
      resolution.pixelRatio,
    );
    this.root.name = 'persistent-teaching-routes';
    this.root.userData.selectable = false;
    scene.add(this.root);
    this.arrowheads = new ArrowheadPool(this.root);
    this.flowTokens = new FlowTokenPool(this.root);
    this.routeMarkers = new RouteMarkerPool(this.root);
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error('Relation layer has been disposed.');
  }

  public syncActiveRoutes(routes: readonly ActiveTeachingRoute[]): RouteSyncResult {
    this.assertUsable();
    const ids = routes.map((route) => route.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error('Active teaching route IDs must be unique within one projection.');
    }

    const planned = [...routes]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((route) => ({ route, plan: this.planner.plan(route) }));
    const desiredIds = new Set(ids);
    const removed: string[] = [];
    for (const routeId of [...this.handles.keys()].sort()) {
      if (desiredIds.has(routeId)) continue;
      this.remove(routeId);
      removed.push(routeId);
    }

    const added: string[] = [];
    const updated: string[] = [];
    for (const entry of planned) {
      const current = this.handles.get(entry.route.id);
      if (current) {
        current.update(entry.route, entry.plan);
        current.setReducedMotion(this.reducedMotion);
        updated.push(entry.route.id);
      } else {
        const handle = new RouteHandle(
          entry.route,
          entry.plan,
          this.resolution,
          this.arrowheads,
          this.flowTokens,
          this.routeMarkers,
        );
        handle.setReducedMotion(this.reducedMotion);
        this.handles.set(entry.route.id, handle);
        this.root.add(handle.root);
        added.push(entry.route.id);
      }
    }
    return { added, updated, removed };
  }

  public getRoute(routeId: string): RouteHandle | undefined {
    return this.handles.get(routeId);
  }

  /** AnimationCoordinator can use this to move tokens along the already-visible settled route. */
  public getRoutePoints(routeId: string): readonly THREE.Vector3[] | undefined {
    return this.handles.get(routeId)?.getPoints();
  }

  public sampleRoute(
    routeId: string,
    progress: number,
    target = new THREE.Vector3(),
  ): THREE.Vector3 | undefined {
    return this.handles.get(routeId)?.sample(progress, target);
  }

  public setFlowProgress(
    routeId: string,
    progress: number,
    direction: 'forward' | 'reverse' = 'forward',
    flowPhase: 'request' | 'response' = 'request',
  ): void {
    const handle = this.handles.get(routeId);
    if (!handle) throw new Error(`Cannot animate nonexistent teaching route "${routeId}".`);
    handle.setFlowProgress(progress, direction, flowPhase);
  }

  public finishFlow(routeId: string): void {
    const handle = this.handles.get(routeId);
    if (!handle) throw new Error(`Cannot finish nonexistent teaching route "${routeId}".`);
    handle.finishFlow();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertUsable();
    this.reducedMotion = reducedMotion;
    for (const handle of this.handles.values()) handle.setReducedMotion(reducedMotion);
  }

  public advanceDash(distance: number): void {
    this.assertUsable();
    if (this.reducedMotion) return;
    for (const handle of this.handles.values()) handle.advanceDash(distance);
  }

  public setResolution(width: number, height: number, pixelRatio = 1): void {
    this.assertUsable();
    this.resolution = validateResolution(width, height, pixelRatio);
    for (const handle of this.handles.values()) handle.setResolution(width, height, pixelRatio);
  }

  public remove(routeId: string): void {
    const handle = this.handles.get(routeId);
    if (!handle) return;
    handle.dispose();
    this.handles.delete(routeId);
  }

  public clear(): void {
    for (const routeId of [...this.handles.keys()]) this.remove(routeId);
  }

  public get diagnostics(): RelationLayerDiagnostics {
    const sortedHandles = [...this.handles.values()].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
    const routeObstacleIntersectionDetails = sortedHandles.flatMap((handle) =>
      this.planner.diagnoseObstacleIntersections(handle.plan),
    );
    const flowTokenRouteDistances = sortedHandles.flatMap((handle) =>
      handle.getFlowTokenRouteDistances(),
    );
    return {
      routeHandles: this.handles.size,
      wideLineGeometries: this.handles.size,
      wideLineMaterials: this.handles.size,
      leasedArrowheads: this.arrowheads.leasedCount,
      pooledArrowheads: this.arrowheads.pooledCount,
      leasedFlowTokens: this.flowTokens.leasedCount,
      pooledFlowTokens: this.flowTokens.pooledCount,
      leasedRouteMarkers: this.routeMarkers.leasedCount,
      pooledRouteMarkers: this.routeMarkers.pooledCount,
      routeObstacleIntersections: routeObstacleIntersectionDetails.length,
      routeObstacleIntersectionDetails,
      routeEndpointDriftCount: sortedHandles.reduce(
        (count, handle) => count + this.planner.countEndpointDrifts(handle.plan),
        0,
      ),
      activeRouteWidthsBelowMinimum: sortedHandles.filter(
        (handle) => handle.root.visible && handle.line.material.linewidth < 4,
      ).length,
      visibleRoutesWithoutArrowheads: sortedHandles.filter(
        (handle) => handle.root.visible && handle.arrowheadCount === 0,
      ).length,
      strongXRouteReversals: sortedHandles.reduce(
        (count, handle) => count + countStrongXReversals(handle.plan.points),
        0,
      ),
      flowTokensOffRoute: flowTokenRouteDistances.filter((distance) => distance > 0.02).length,
      maximumFlowTokenRouteDistance: Math.max(0, ...flowTokenRouteDistances),
    };
  }

  public get size(): number {
    return this.handles.size;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.arrowheads.dispose();
    this.flowTokens.dispose();
    this.routeMarkers.dispose();
    this.root.removeFromParent();
    this.root.clear();
    this.disposed = true;
  }
}

/** Name used by animation-facing integration code. */
export { RelationLayer as RouteLayer };
