import * as THREE from 'three';
import type { RouteObstacle, RouteObstacleProvider } from './relationTypes';
import type { RouteVisualHandle, RouteVisualRegistry } from './RouteSceneAdapter';

export interface RouteObstacleMapOptions {
  /** Approximate world-space width occupied by one visible label character. */
  readonly labelCharacterWidth?: number;
  readonly labelMinimumWidth?: number;
  readonly labelMaximumWidth?: number;
  readonly labelDepth?: number;
  readonly labelHeight?: number;
}

const DEFAULT_CHARACTER_WIDTH = 0.105;
const DEFAULT_MINIMUM_WIDTH = 0.72;
const DEFAULT_MAXIMUM_WIDTH = 4.2;
const DEFAULT_LABEL_DEPTH = 0.62;
const DEFAULT_LABEL_HEIGHT = 0.52;

const finitePositive = (value: number, name: string): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive finite value.`);
  }
  return value;
};

const labelTextFor = (handle: RouteVisualHandle): string | undefined => {
  const domLabel = handle.root.userData.domLabel;
  if (
    domLabel &&
    typeof domLabel === 'object' &&
    'text' in domLabel &&
    typeof domLabel.text === 'string' &&
    domLabel.text.trim().length > 0
  ) {
    return domLabel.text.trim();
  }
  const shortLabel = handle.root.userData.shortLabel;
  return typeof shortLabel === 'string' && shortLabel.trim().length > 0
    ? shortLabel.trim()
    : undefined;
};

const visibleHandleBounds = (handle: RouteVisualHandle): THREE.Box3 | undefined => {
  const target = new THREE.Box3();
  const bounds = handle.getWorldBounds
    ? handle.getWorldBounds(target).clone()
    : target.setFromObject(handle.root, true);
  return bounds.isEmpty() ? undefined : bounds;
};

const explicitParentId = (handle: RouteVisualHandle): string | undefined => {
  for (const key of ['composedInPod', 'composedInNode', 'layoutParentId'] as const) {
    const value = handle.root.userData[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

const isContainedBy = (
  candidate: RouteVisualHandle,
  ancestor: RouteVisualHandle,
  handlesById: ReadonlyMap<string, RouteVisualHandle>,
): boolean => {
  let object: THREE.Object3D | null = candidate.root.parent;
  while (object) {
    if (object === ancestor.root) return true;
    object = object.parent;
  }
  const visited = new Set<string>();
  let current: RouteVisualHandle | undefined = candidate;
  while (current) {
    const parentId = explicitParentId(current);
    if (!parentId || visited.has(parentId)) return false;
    if (parentId === ancestor.entityId) return true;
    visited.add(parentId);
    current = handlesById.get(parentId);
  }
  return false;
};

/**
 * Live obstacle provider for semantic routes. It protects both primary model footprints and the
 * world-space footprint occupied by their DOM labels, while retaining stable obstacle identity.
 */
export class RouteObstacleMap implements RouteObstacleProvider {
  private readonly labelCharacterWidth: number;
  private readonly labelMinimumWidth: number;
  private readonly labelMaximumWidth: number;
  private readonly labelDepth: number;
  private readonly labelHeight: number;

  public constructor(
    private readonly registry: RouteVisualRegistry,
    options: RouteObstacleMapOptions = {},
  ) {
    this.labelCharacterWidth = finitePositive(
      options.labelCharacterWidth ?? DEFAULT_CHARACTER_WIDTH,
      'Label character width',
    );
    this.labelMinimumWidth = finitePositive(
      options.labelMinimumWidth ?? DEFAULT_MINIMUM_WIDTH,
      'Label minimum width',
    );
    this.labelMaximumWidth = finitePositive(
      options.labelMaximumWidth ?? DEFAULT_MAXIMUM_WIDTH,
      'Label maximum width',
    );
    this.labelDepth = finitePositive(options.labelDepth ?? DEFAULT_LABEL_DEPTH, 'Label depth');
    this.labelHeight = finitePositive(options.labelHeight ?? DEFAULT_LABEL_HEIGHT, 'Label height');
    if (this.labelMaximumWidth < this.labelMinimumWidth) {
      throw new Error('Label maximum width must be greater than or equal to label minimum width.');
    }
  }

  public getObstacles(): readonly RouteObstacle[] {
    const obstacles: RouteObstacle[] = [];
    const handles = [...this.registry.values()].sort((left, right) =>
      left.entityId.localeCompare(right.entityId),
    );
    const handlesById = new Map(handles.map((handle) => [handle.entityId, handle]));
    for (const handle of handles) {
      if (handle.isDisposed === true || !handle.root.visible) continue;
      const bounds = visibleHandleBounds(handle);
      if (bounds) {
        obstacles.push({
          obstacleId: `entity:${handle.entityId}`,
          entityId: handle.entityId,
          kind: 'entity',
          containedEntityIds: handles
            .filter(
              (candidate) => candidate !== handle && isContainedBy(candidate, handle, handlesById),
            )
            .map((candidate) => candidate.entityId),
          bounds,
        });
      }

      const labelText = labelTextFor(handle);
      if (!labelText || handle.root.userData.labelMode === 'none') continue;
      const anchor = handle.getAnchor('label').clone();
      if (![anchor.x, anchor.y, anchor.z].every(Number.isFinite)) continue;
      const labelWidth = THREE.MathUtils.clamp(
        Array.from(labelText).length * this.labelCharacterWidth,
        this.labelMinimumWidth,
        this.labelMaximumWidth,
      );
      const halfSize = new THREE.Vector3(labelWidth / 2, this.labelHeight / 2, this.labelDepth / 2);
      obstacles.push({
        obstacleId: `label:${handle.entityId}`,
        entityId: handle.entityId,
        kind: 'label',
        bounds: new THREE.Box3(anchor.clone().sub(halfSize), anchor.clone().add(halfSize)),
      });
    }
    return obstacles.sort((left, right) => left.obstacleId.localeCompare(right.obstacleId));
  }
}
