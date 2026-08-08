import type { ViewProjection } from '../../course/types';
import { getPodData } from '../../world/dataGuards';
import type { EntityId, WorldEntity, WorldSnapshot } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { emphasisScale } from '../design/effects';
import type { EntityLayout, LayoutResult } from '../LayoutEngine';

export interface RuntimeLayoutDiagnostics {
  readonly visibleNodes: number;
  readonly nodeBays: number;
  readonly scheduledPods: number;
  readonly scheduledPodsOutsideBays: number;
  readonly duplicateBayAssignments: number;
  readonly podPairOverlaps: number;
  readonly podSystemModuleOverlaps: number;
  readonly pendingPods: number;
  readonly pendingPodsInsideNodes: number;
}

interface Footprint {
  readonly id: EntityId;
  readonly centerX: number;
  readonly centerZ: number;
  readonly halfWidth: number;
  readonly halfDepth: number;
}

export interface RuntimeWorldBounds {
  readonly min: { readonly x: number; readonly z: number };
  readonly max: { readonly x: number; readonly z: number };
}

export type RuntimeWorldBoundsProvider = (entityId: EntityId) => RuntimeWorldBounds | undefined;

const EPSILON = 1e-5;

const isRendered = (entity: WorldEntity, projection: ViewProjection): boolean => {
  const state = projection.entityStates[entity.id];
  return state?.visible === true && state.emphasis !== 'hidden';
};

const footprintForPod = (
  pod: WorldEntity,
  layout: EntityLayout,
  projection: ViewProjection,
  worldBounds?: RuntimeWorldBounds,
): Footprint => {
  if (
    worldBounds &&
    [worldBounds.min.x, worldBounds.min.z, worldBounds.max.x, worldBounds.max.z].every(
      Number.isFinite,
    ) &&
    worldBounds.max.x >= worldBounds.min.x &&
    worldBounds.max.z >= worldBounds.min.z
  ) {
    return {
      id: pod.id,
      centerX: (worldBounds.min.x + worldBounds.max.x) / 2,
      centerZ: (worldBounds.min.z + worldBounds.max.z) / 2,
      halfWidth: (worldBounds.max.x - worldBounds.min.x) / 2,
      halfDepth: (worldBounds.max.z - worldBounds.min.z) / 2,
    };
  }
  const scale = emphasisScale(projection.entityStates[pod.id]?.emphasis ?? 'normal');
  return {
    id: pod.id,
    centerX: layout.position[0],
    centerZ: layout.position[2],
    halfWidth: (dimensions.pod.width * scale) / 2,
    halfDepth: (dimensions.pod.depth * scale) / 2,
  };
};

const overlaps = (left: Footprint, right: Footprint): boolean =>
  Math.abs(left.centerX - right.centerX) + EPSILON < left.halfWidth + right.halfWidth &&
  Math.abs(left.centerZ - right.centerZ) + EPSILON < left.halfDepth + right.halfDepth;

const contains = (
  outerCenter: readonly [number, number],
  outerSize: readonly [number, number],
  inner: Footprint,
): boolean =>
  Math.abs(inner.centerX - outerCenter[0]) + inner.halfWidth <= outerSize[0] / 2 + EPSILON &&
  Math.abs(inner.centerZ - outerCenter[1]) + inner.halfDepth <= outerSize[1] / 2 + EPSILON;

const bayCenter = (
  nodeLayout: EntityLayout,
  slotIndex: number,
): readonly [number, number] | undefined => {
  const anchor = dimensions.node.bayAnchors[slotIndex];
  if (!anchor) return undefined;
  return [nodeLayout.position[0] + anchor[0], nodeLayout.position[2] + anchor[1]];
};

const systemModuleFootprint = (nodeLayout: EntityLayout): Footprint => {
  const [offsetX, , offsetZ] = dimensions.node.systemModuleStrip.center;
  const [width, , depth] = dimensions.node.systemModuleStrip.size;
  return {
    id: `${nodeLayout.entityId}:system-modules`,
    centerX: nodeLayout.position[0] + offsetX,
    centerZ: nodeLayout.position[2] + offsetZ,
    halfWidth: width / 2,
    halfDepth: depth / 2,
  };
};

/**
 * Checks the authored placement model independently of animation and camera state. These counts
 * are intentionally exposed to screenshot gates so an attractive frame cannot hide an invalid
 * Node → Pod placement hierarchy.
 */
export function diagnoseRuntimeLayout(
  world: WorldSnapshot,
  projection: ViewProjection,
  layout: LayoutResult,
  worldBoundsForEntity?: RuntimeWorldBoundsProvider,
): RuntimeLayoutDiagnostics {
  const visibleNodes = Object.values(world.entities)
    .filter((entity) => entity.kind === 'Node' && isRendered(entity, projection))
    .flatMap((entity) => {
      const entityLayout = layout.entities.get(entity.id);
      return entityLayout?.lane === 'node' ? [{ entity, layout: entityLayout }] : [];
    });
  const nodeByName = new Map(visibleNodes.map((entry) => [entry.entity.name, entry] as const));
  const scheduledFootprints: Array<{
    readonly pod: WorldEntity;
    readonly layout: EntityLayout;
    readonly footprint: Footprint;
  }> = [];

  let scheduledPodsOutsideBays = 0;
  let pendingPodsInsideNodes = 0;
  let podSystemModuleOverlaps = 0;
  let scheduledPods = 0;
  let pendingPods = 0;
  const occupiedBayKeys = new Set<string>();
  let duplicateBayAssignments = 0;

  for (const pod of Object.values(world.entities).filter(
    (entity) => entity.kind === 'Pod' && isRendered(entity, projection),
  )) {
    const nodeName = getPodData(pod).nodeName;
    const podLayout = layout.entities.get(pod.id);
    if (nodeName) scheduledPods += 1;
    else pendingPods += 1;
    if (!podLayout) {
      if (nodeName) scheduledPodsOutsideBays += 1;
      else pendingPodsInsideNodes += 1;
      continue;
    }
    const footprint = footprintForPod(pod, podLayout, projection, worldBoundsForEntity?.(pod.id));
    if (!nodeName) {
      if (podLayout.lane !== 'pending' || podLayout.parentId !== undefined) {
        pendingPodsInsideNodes += 1;
        continue;
      }
      if (
        visibleNodes.some(({ layout: visibleNodeLayout }) =>
          overlaps(footprint, {
            id: visibleNodeLayout.entityId,
            centerX: visibleNodeLayout.position[0],
            centerZ: visibleNodeLayout.position[2],
            halfWidth: dimensions.node.width / 2,
            halfDepth: dimensions.node.depth / 2,
          }),
        )
      ) {
        pendingPodsInsideNodes += 1;
      }
      continue;
    }

    scheduledFootprints.push({ pod, layout: podLayout, footprint });
    const node = nodeByName.get(nodeName);
    const slotIndex = podLayout.slotIndex;
    const expectedBayCenter =
      node && slotIndex !== undefined ? bayCenter(node.layout, slotIndex) : undefined;
    const bayKey = node && slotIndex !== undefined ? `${node.entity.id}:${slotIndex}` : undefined;
    if (bayKey) {
      if (occupiedBayKeys.has(bayKey)) duplicateBayAssignments += 1;
      occupiedBayKeys.add(bayKey);
    }
    const isInsideBay =
      node !== undefined &&
      podLayout.lane === 'pod-slot' &&
      podLayout.parentId === node.entity.id &&
      slotIndex !== undefined &&
      expectedBayCenter !== undefined &&
      Math.abs(podLayout.position[1] - dimensions.node.podLandingY) <= EPSILON &&
      contains(expectedBayCenter, [dimensions.node.bayWidth, dimensions.node.bayDepth], footprint);
    if (!isInsideBay) scheduledPodsOutsideBays += 1;
    if (node && overlaps(footprint, systemModuleFootprint(node.layout))) {
      podSystemModuleOverlaps += 1;
    }
  }

  let podPairOverlaps = 0;
  for (let left = 0; left < scheduledFootprints.length; left += 1) {
    for (let right = left + 1; right < scheduledFootprints.length; right += 1) {
      if (overlaps(scheduledFootprints[left]!.footprint, scheduledFootprints[right]!.footprint)) {
        podPairOverlaps += 1;
      }
    }
  }

  return {
    visibleNodes: visibleNodes.length,
    nodeBays: visibleNodes.length * dimensions.node.bayAnchors.length,
    scheduledPods,
    scheduledPodsOutsideBays,
    duplicateBayAssignments,
    podPairOverlaps,
    podSystemModuleOverlaps,
    pendingPods,
    pendingPodsInsideNodes,
  };
}
