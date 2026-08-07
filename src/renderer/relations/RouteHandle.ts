import * as THREE from 'three';
import type { ArrowheadLease, ArrowheadPool } from './ArrowheadPool';
import type { FlowTokenLease, FlowTokenPool } from './FlowTokenPool';
import { getTeachingRouteStyle } from './RelationStyleCatalog';
import type { RouteMarkerLease, RouteMarkerPool } from './RouteMarkerPool';
import { directionAtProgress, samplePolyline } from './polyline';
import type {
  ActiveTeachingRoute,
  PlannedTeachingRoute,
  TeachingRouteStyle,
  ViewportResolution,
} from './relationTypes';
import { WideLineHandle } from './WideLineHandle';

const wrappedProgress = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return ((value % 1) + 1) % 1;
};

type RequestAwareTeachingRoute = ActiveTeachingRoute & { readonly requestId?: string };

const requestIdFor = (route: ActiveTeachingRoute): string | undefined =>
  (route as RequestAwareTeachingRoute).requestId;

/** Owns one persistent active route; pooled arrows/tokens/markers return on update or dispose. */
export class RouteHandle {
  public readonly root = new THREE.Group();
  public readonly line: WideLineHandle;
  private readonly arrows: ArrowheadLease[] = [];
  private readonly tokens: FlowTokenLease[] = [];
  private readonly markers: RouteMarkerLease[] = [];
  private currentRoute: ActiveTeachingRoute;
  private currentPlan: PlannedTeachingRoute;
  private currentStyle: TeachingRouteStyle;
  private reducedMotion = false;
  private disposed = false;

  public constructor(
    route: ActiveTeachingRoute,
    plan: PlannedTeachingRoute,
    resolution: ViewportResolution,
    private readonly arrowPool: ArrowheadPool,
    private readonly tokenPool: FlowTokenPool,
    private readonly markerPool: RouteMarkerPool,
  ) {
    if (route.id !== plan.route.id) {
      throw new Error(`Route handle "${route.id}" received plan for "${plan.route.id}".`);
    }
    this.currentRoute = route;
    this.currentPlan = plan;
    this.currentStyle = getTeachingRouteStyle(route.semantic);
    this.root.name = `teaching-route:${route.id}`;
    this.root.userData.routeId = route.id;
    this.root.userData.semantic = route.semantic;
    this.root.userData.persistent = route.persistAfterAnimation;
    this.root.userData.selectable = false;
    this.syncRequestIdentity();
    this.line = new WideLineHandle(route.id, plan.points, this.currentStyle, resolution);
    this.root.add(this.line.root);
    this.syncArrows();
    this.syncMarkers();
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error(`Teaching route "${this.id}" has been disposed.`);
  }

  private syncArrows(): void {
    const descriptors: Array<{
      readonly points: readonly THREE.Vector3[];
      readonly progress: number;
      readonly scale: number;
    }> = [];
    if (this.currentStyle.arrowhead) {
      for (const hop of this.currentPlan.hops) {
        if (this.currentStyle.chevrons) {
          descriptors.push({ points: hop.points, progress: 0.48, scale: 0.72 });
        }
        descriptors.push({ points: hop.points, progress: 1, scale: 1 });
      }
    }
    while (this.arrows.length > descriptors.length) this.arrows.pop()?.release();
    while (this.arrows.length < descriptors.length) {
      this.arrows.push(
        this.arrowPool.acquire(
          {
            color: this.currentStyle.color,
            opacity: this.currentStyle.opacity,
            renderOrder: this.currentStyle.renderOrder + 1,
          },
          this.root,
        ),
      );
    }
    descriptors.forEach((descriptor, index) => {
      const lease = this.arrows[index];
      if (!lease) return;
      lease.object.userData.routeId = this.id;
      lease.object.userData.role = descriptor.progress === 1 ? 'route-arrowhead' : 'route-chevron';
      lease.setAppearance({
        color: this.currentStyle.color,
        opacity: this.currentStyle.opacity,
        renderOrder: this.currentStyle.renderOrder + 1,
        scale: descriptor.scale,
      });
      const position = samplePolyline(descriptor.points, descriptor.progress);
      const direction = directionAtProgress(descriptor.points, descriptor.progress);
      lease.place(position, direction);
      lease.setVisible(this.root.visible);
    });
  }

  private syncMarkers(): void {
    while (this.markers.length > this.currentPlan.markers.length) this.markers.pop()?.release();
    while (this.markers.length < this.currentPlan.markers.length) {
      this.markers.push(
        this.markerPool.acquire(
          {
            color: this.currentStyle.color,
            opacity: this.currentStyle.opacity,
            renderOrder: this.currentStyle.renderOrder + 3,
          },
          this.root,
        ),
      );
    }
    this.currentPlan.markers.forEach((marker, index) => {
      const lease = this.markers[index];
      if (!lease) return;
      lease.setAppearance({
        color: this.currentStyle.color,
        opacity: this.currentStyle.opacity,
        renderOrder: this.currentStyle.renderOrder + 3,
      });
      lease.setMarker(marker, this.id);
      lease.setVisible(this.root.visible);
    });
  }

  private syncRequestIdentity(): void {
    const requestId = requestIdFor(this.currentRoute);
    if (requestId) this.root.userData.requestId = requestId;
    else delete this.root.userData.requestId;
    for (const token of this.tokens) {
      if (requestId) token.object.userData.requestId = requestId;
      else delete token.object.userData.requestId;
    }
  }

  public update(route: ActiveTeachingRoute, plan: PlannedTeachingRoute): void {
    this.assertUsable();
    if (route.id !== this.id || plan.route.id !== this.id) {
      throw new Error(`Route handle "${this.id}" cannot update a different route.`);
    }
    this.currentRoute = route;
    this.currentPlan = plan;
    this.currentStyle = getTeachingRouteStyle(route.semantic);
    this.root.userData.semantic = route.semantic;
    this.root.userData.persistent = route.persistAfterAnimation;
    this.syncRequestIdentity();
    this.line.updatePoints(plan.points);
    this.line.applyStyle(this.currentStyle);
    this.syncArrows();
    this.syncMarkers();
    if (this.reducedMotion) this.clearFlowTokens();
  }

  public setResolution(width: number, height: number, pixelRatio = 1): void {
    this.assertUsable();
    this.line.setResolution(width, height, pixelRatio);
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.assertUsable();
    this.reducedMotion = reducedMotion;
    this.root.userData.reducedMotion = reducedMotion;
    // Direction remains visible through the persistent line and arrowheads.
    this.root.visible = true;
    this.line.setVisible(true);
    for (const arrow of this.arrows) arrow.setVisible(true);
    for (const marker of this.markers) marker.setVisible(true);
    if (reducedMotion) this.clearFlowTokens();
  }

  public setVisible(visible: boolean): void {
    this.assertUsable();
    this.root.visible = visible;
    this.line.setVisible(visible);
    for (const arrow of this.arrows) arrow.setVisible(visible);
    for (const marker of this.markers) marker.setVisible(visible);
    for (const token of this.tokens) token.setVisible(visible && !this.reducedMotion);
  }

  private ensureFlowTokens(): void {
    if (this.reducedMotion) return;
    while (this.tokens.length < this.currentStyle.tokenCount) {
      const token = this.tokenPool.acquire(
        {
          color: this.currentStyle.tokenColor,
          opacity: 1,
          renderOrder: this.currentStyle.renderOrder + 2,
        },
        this.root,
      );
      token.object.userData.routeId = this.id;
      const requestId = requestIdFor(this.currentRoute);
      if (requestId) token.object.userData.requestId = requestId;
      this.tokens.push(token);
    }
    while (this.tokens.length > this.currentStyle.tokenCount) this.tokens.pop()?.release();
  }

  public setFlowProgress(progress: number): void {
    this.assertUsable();
    this.root.visible = true;
    this.line.setVisible(true);
    for (const arrow of this.arrows) arrow.setVisible(true);
    for (const marker of this.markers) marker.setVisible(true);
    if (this.reducedMotion) {
      this.clearFlowTokens();
      return;
    }
    this.ensureFlowTokens();
    const count = Math.max(1, this.tokens.length);
    this.tokens.forEach((token, index) => {
      token.setVisible(true);
      token.setProgress(this.currentPlan.points, wrappedProgress(progress + index / count));
    });
  }

  public finishFlow(): void {
    this.assertUsable();
    this.clearFlowTokens();
    this.setVisible(this.currentRoute.persistAfterAnimation);
  }

  public clearFlowTokens(): void {
    while (this.tokens.length > 0) this.tokens.pop()?.release();
  }

  public advanceDash(distance: number): void {
    this.assertUsable();
    if (!this.reducedMotion) this.line.advanceDash(distance);
  }

  public sample(progress: number, target = new THREE.Vector3()): THREE.Vector3 {
    this.assertUsable();
    return this.line.sample(progress, target);
  }

  public getPoints(): readonly THREE.Vector3[] {
    this.assertUsable();
    return this.line.getPoints();
  }

  public get id(): string {
    return this.currentRoute.id;
  }

  public get route(): ActiveTeachingRoute {
    return this.currentRoute;
  }

  public get plan(): PlannedTeachingRoute {
    return this.currentPlan;
  }

  public get arrowheadCount(): number {
    return this.arrows.length;
  }

  public get flowTokenCount(): number {
    return this.tokens.length;
  }

  public get markerCount(): number {
    return this.markers.length;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearFlowTokens();
    while (this.arrows.length > 0) this.arrows.pop()?.release();
    while (this.markers.length > 0) this.markers.pop()?.release();
    this.line.dispose();
    this.root.removeFromParent();
    this.root.clear();
  }
}
