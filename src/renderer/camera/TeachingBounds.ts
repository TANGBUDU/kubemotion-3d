import * as THREE from 'three';
import type { ViewMode } from '../../course/types';
import type { EntityId } from '../../world/types';
import type { LayoutContainer } from '../LayoutEngine';
import type { EntityVisualHandle } from '../visuals/BaseVisualHandle';

export const TARGET_MAX_FILL: Readonly<Record<ViewMode, number>> = Object.freeze({
  overview: 0.8,
  logical: 0.86,
  placement: 0.88,
  'control-flow': 0.84,
  traffic: 0.88,
  storage: 0.86,
});

const PRIMARY_BOUNDS_MARGIN = 0.45;

export interface TeachingBoundsInput {
  readonly view: ViewMode;
  readonly entityHandles: Iterable<EntityVisualHandle>;
  readonly occupiedGuideBounds: THREE.Box3;
  readonly routeRoot: THREE.Object3D;
  readonly selectedEntityId?: EntityId;
  readonly focusedEntityIds: readonly EntityId[];
  readonly stageFallbackBounds: THREE.Box3;
  readonly margin?: number;
}

export interface TeachingBoundsResult {
  readonly entityBounds: THREE.Box3;
  readonly occupiedGuideBounds: THREE.Box3;
  readonly routeBounds: THREE.Box3;
  readonly primaryBounds: THREE.Box3;
  readonly usedStageFallback: boolean;
}

const isFiniteBounds = (bounds: THREE.Box3): boolean =>
  !bounds.isEmpty() &&
  [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(
    Number.isFinite,
  );

const visibleGeometryBounds = (
  root: THREE.Object3D,
  target: THREE.Box3 = new THREE.Box3(),
): THREE.Box3 => {
  target.makeEmpty();
  root.updateWorldMatrix(true, true);
  const scratch = new THREE.Box3();
  root.traverseVisible((object) => {
    if (object.userData.excludeFromBounds === true) return;
    const geometry = (object as THREE.Mesh | THREE.Line | THREE.Points).geometry;
    if (!(geometry instanceof THREE.BufferGeometry)) return;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    scratch.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
    if (isFiniteBounds(scratch)) target.union(scratch);
  });
  return target;
};

/**
 * Converts an occupied layout guide into a small floor-level composition box. DOM label anchors,
 * guide ornament geometry, and camera concerns deliberately stay out of this calculation.
 */
export const layoutContainerFramingBounds = (
  container: LayoutContainer,
  target: THREE.Box3 = new THREE.Box3(),
): THREE.Box3 => {
  const [centerX, , centerZ] = container.bounds.center;
  const [width, height, depth] = container.bounds.size;
  const halfWidth = Math.max(0, width) / 2;
  const halfDepth = Math.max(0, depth) / 2;
  target.min.set(centerX - halfWidth, -0.05, centerZ - halfDepth);
  target.max.set(centerX + halfWidth, Math.max(0.35, height + 0.2), centerZ + halfDepth);
  return target;
};

/** Maximum teaching-subject fill, with extra breathing room on narrow lesson viewports. */
export const targetMaxFill = (view: ViewMode, viewportWidth: number): number =>
  Math.min(TARGET_MAX_FILL[view], viewportWidth <= 720 ? 0.82 : 0.92);

/**
 * Builds camera bounds from the current teaching subject. The decorative stage is intentionally a
 * last-resort fallback and never participates while an entity, occupied guide, or route is visible.
 */
export const calculateTeachingBounds = (input: TeachingBoundsInput): TeachingBoundsResult => {
  const focusedIds = new Set(input.focusedEntityIds);
  const entityBounds = new THREE.Box3();
  const scratch = new THREE.Box3();

  for (const handle of input.entityHandles) {
    if (handle.isDisposed || !handle.root.visible || handle.root.userData.activeWorld !== true) {
      continue;
    }
    const isSelected = handle.entityId === input.selectedEntityId;
    const isAuthoredFocus = focusedIds.has(handle.entityId);
    if (handle.root.userData.foundationOnly === true && !isSelected && !isAuthoredFocus) continue;

    const bounds = handle.getWorldBounds
      ? handle.getWorldBounds(scratch)
      : visibleGeometryBounds(handle.root, scratch);
    if (isFiniteBounds(bounds)) entityBounds.union(bounds);
  }

  const occupiedGuideBounds = isFiniteBounds(input.occupiedGuideBounds)
    ? input.occupiedGuideBounds.clone()
    : new THREE.Box3();
  const routeBounds = new THREE.Box3();
  const routeScratch = new THREE.Box3();
  for (const route of input.routeRoot.children) {
    if (!route.visible) continue;
    visibleGeometryBounds(route, routeScratch);
    if (isFiniteBounds(routeScratch)) routeBounds.union(routeScratch);
  }

  const primaryBounds = new THREE.Box3();
  if (isFiniteBounds(entityBounds)) primaryBounds.union(entityBounds);
  if (isFiniteBounds(occupiedGuideBounds)) primaryBounds.union(occupiedGuideBounds);
  if (isFiniteBounds(routeBounds)) primaryBounds.union(routeBounds);

  let usedStageFallback = false;
  if (isFiniteBounds(primaryBounds)) {
    primaryBounds.expandByScalar(Math.max(0, input.margin ?? PRIMARY_BOUNDS_MARGIN));
  } else if (isFiniteBounds(input.stageFallbackBounds)) {
    primaryBounds.copy(input.stageFallbackBounds);
    usedStageFallback = true;
  }

  return {
    entityBounds,
    occupiedGuideBounds,
    routeBounds,
    primaryBounds,
    usedStageFallback,
  };
};
