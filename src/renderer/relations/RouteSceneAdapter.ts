import * as THREE from 'three';
import type { EntityId } from '../../world/types';
import type {
  RouteAnchorKind,
  RouteAnchorResolver,
  RouteObstacle,
  RouteObstacleProvider,
} from './relationTypes';

/** Structural subset implemented by both legacy and Milestone-1 visual handles. */
export interface RouteVisualHandle {
  readonly entityId: EntityId;
  readonly root: THREE.Object3D;
  readonly isDisposed?: boolean;
  getAnchor(anchor: RouteAnchorKind): THREE.Vector3;
  getWorldBounds?(target?: THREE.Box3): THREE.Box3;
}

export interface RouteVisualRegistry {
  get(entityId: EntityId): RouteVisualHandle | undefined;
  values(): Iterable<RouteVisualHandle>;
}

/** Adapts the visual registry without importing a concrete Node/Pod implementation. */
export class RouteSceneAdapter implements RouteAnchorResolver, RouteObstacleProvider {
  public constructor(private readonly registry: RouteVisualRegistry) {}

  public resolveAnchor(entityId: EntityId, anchor: RouteAnchorKind): THREE.Vector3 | undefined {
    const handle = this.registry.get(entityId);
    if (!handle || handle.isDisposed === true || !handle.root.visible) return undefined;
    return handle.getAnchor(anchor).clone();
  }

  public getObstacles(): readonly RouteObstacle[] {
    const obstacles: RouteObstacle[] = [];
    for (const handle of this.registry.values()) {
      if (handle.isDisposed === true || !handle.root.visible) continue;
      const target = new THREE.Box3();
      const bounds = handle.getWorldBounds
        ? handle.getWorldBounds(target).clone()
        : target.setFromObject(handle.root, true);
      if (bounds.isEmpty()) continue;
      obstacles.push({ entityId: handle.entityId, bounds });
    }
    return obstacles.sort((left, right) => left.entityId.localeCompare(right.entityId));
  }
}
