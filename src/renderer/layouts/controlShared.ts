import type { EntityId, WorldEntity, WorldRelation } from '../../world/types';
import type { LayoutContainer, LayoutInput, LayoutSlot, Position } from '../LayoutEngine';
import { dimensions } from '../design/dimensions';
import { LayoutContractError } from './LayoutContractError';
import { dataString } from './layoutShared';

export const NODE_BAY_COUNT = dimensions.node.bayAnchors.length;
export const NODE_SPACING = dimensions.node.width + 0.9;

/**
 * Control Flow reuses the three-band Z structure the repository already proved non-overlapping.
 * Every top-level control-flow container must sit in exactly one band; the bands are separated by
 * a visible gap so foundation plates never intersect:
 *
 *   control  [-6.525, -3.975]
 *   middle   [-3.225, -0.875]
 *   workers  [ 0.075,  5.625]
 *
 * Declared here rather than imported from LayoutEngine to keep the layout modules free of a
 * circular runtime dependency on the engine that consumes them.
 */
export const CONTROL_FLOW_ZONES = Object.freeze({
  controlPlane: Object.freeze({ centerZ: -5.25, depth: 2.55 }),
  workloadState: Object.freeze({ centerZ: -2.05, depth: 2.35 }),
  workerNodes: Object.freeze({ centerZ: 2.85, depth: 5.55 }),
});

/** Minimum clear space between two neighbouring lanes packed along X. */
export const LANE_GAP = 0.45;

/** Minimum clear space between two neighbouring workload models inside the middle band. */
export const WORKLOAD_GAP = 1.2;

/** Padding added to each side of a lane plate so its slots never touch the plate edge. */
export const LANE_PADDING = 0.8;

export interface PackedLane {
  readonly id: string;
  readonly width: number;
}

/**
 * Places lanes side by side along X without overlap, centred on `centerX`.
 *
 * Deterministic: the same lane list always produces the same centres, so screenshots and slot
 * identities stay stable across renders.
 */
export const packHorizontalLanes = (
  lanes: readonly PackedLane[],
  gap: number,
  centerX = 0,
): ReadonlyMap<string, number> => {
  const totalWidth =
    lanes.reduce((sum, lane) => sum + lane.width, 0) + Math.max(0, lanes.length - 1) * gap;

  let cursor = centerX - totalWidth / 2;
  const result = new Map<string, number>();

  for (const lane of lanes) {
    result.set(lane.id, cursor + lane.width / 2);
    cursor += lane.width + gap;
  }

  return result;
};

/**
 * Footprint width of a workload model, used so wide cards (Deployment, ReplicaSet) get enough room
 * for their labels and for route clearance instead of a uniform index spacing.
 */
export const workloadVisualWidth = (kind: string): number => {
  switch (kind) {
    case 'HorizontalPodAutoscaler':
      return 3.4;
    case 'Deployment':
      return 3.8;
    case 'ReplicaSet':
      return 4.2;
    case 'MetricSource':
      return 2.8;
    case 'EndpointSlice':
      return 4.0;
    default:
      return 3.2;
  }
};

/** Total plate width needed to hold `widths` packed with `gap`, including lane padding. */
export const packedLaneWidth = (widths: readonly number[], gap: number): number =>
  widths.reduce((sum, width) => sum + width, 0) +
  Math.max(0, widths.length - 1) * gap +
  LANE_PADDING;

export const CONTROL_KINDS: ReadonlySet<string> = new Set([
  'KubeAPIServer',
  'ApiServer',
  'APIServer',
  'Etcd',
  'ControllerManager',
  'KubeControllerManager',
  'Scheduler',
]);

export const EXTERNAL_CONTROL_KINDS: ReadonlySet<string> = new Set(['Kubectl', 'Developer']);

export const WORKLOAD_STATE_KINDS: ReadonlySet<string> = new Set([
  'Namespace',
  'Deployment',
  'ReplicaSet',
  'StatefulSet',
  'HorizontalPodAutoscaler',
  'MetricSource',
  'Service',
  'EndpointSlice',
  'Gateway',
  'HTTPRoute',
  'ConfigMap',
  'Secret',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
]);

export const controlOrder = (entity: WorldEntity): number => {
  if (
    entity.kind === 'KubeAPIServer' ||
    entity.kind === 'ApiServer' ||
    entity.kind === 'APIServer'
  ) {
    return 0;
  }
  if (entity.kind === 'Etcd') return 1;
  if (entity.kind === 'ControllerManager' || entity.kind === 'KubeControllerManager') return 2;
  if (entity.kind === 'Scheduler') return 3;
  return 4;
};

const WORKLOAD_ORDER = [
  'MetricSource',
  'HorizontalPodAutoscaler',
  'Namespace',
  'Deployment',
  'StatefulSet',
  'ReplicaSet',
  'Service',
  'EndpointSlice',
  'Gateway',
  'HTTPRoute',
  'ConfigMap',
  'Secret',
  'PersistentVolumeClaim',
  'PersistentVolume',
  'StorageClass',
] as const;

export const workloadOrder = (entity: WorldEntity): number => {
  const index = WORKLOAD_ORDER.indexOf(entity.kind as (typeof WORKLOAD_ORDER)[number]);
  return index >= 0 ? index : WORKLOAD_ORDER.length;
};

const stableHash = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

export const previousSlot = (
  input: LayoutInput,
  entityId: EntityId,
  containerId: string,
): number | undefined => {
  const previous = input.previous?.entities.get(entityId);
  return previous?.containerId === containerId ? previous.slotIndex : undefined;
};

export const allocateSlot = (
  entityId: EntityId,
  used: ReadonlySet<number>,
  preferred: number | undefined,
  scenarioId: string,
): number => {
  if (
    preferred !== undefined &&
    preferred >= 0 &&
    preferred < NODE_BAY_COUNT &&
    !used.has(preferred)
  ) {
    return preferred;
  }

  const initial = stableHash(entityId) % NODE_BAY_COUNT;
  for (let offset = 0; offset < NODE_BAY_COUNT; offset += 1) {
    const candidate = (initial + offset) % NODE_BAY_COUNT;
    if (!used.has(candidate)) return candidate;
  }

  throw new LayoutContractError({
    view: 'control-flow',
    scenarioId,
    issues: [{ code: 'missing-role', role: `free-node-bay-for:${entityId}` }],
  });
};

export const bayPosition = (nodeX: number, slotIndex: number): Position => {
  const anchor = dimensions.node.bayAnchors[slotIndex];
  if (!anchor) throw new Error(`Invalid Node bay index ${slotIndex}.`);
  return [
    nodeX + anchor[0],
    dimensions.node.podLandingY,
    CONTROL_FLOW_ZONES.workerNodes.centerZ + anchor[1],
  ];
};

export const relatedNodeName = (
  entity: WorldEntity,
  worldRelations: readonly WorldRelation[],
  nodesById: ReadonlyMap<EntityId, WorldEntity>,
): string | undefined => {
  const direct = dataString(entity, 'nodeName');
  if (direct) return direct;

  for (const relation of worldRelations) {
    if (relation.from === entity.id) {
      const node = nodesById.get(relation.to);
      if (node && (relation.semantic === 'placement' || relation.semantic === 'composition')) {
        return node.name;
      }
    }
    if (relation.to === entity.id) {
      const node = nodesById.get(relation.from);
      if (node && relation.semantic === 'composition') return node.name;
    }
  }
  return undefined;
};

export const addControlLane = (
  containers: LayoutContainer[],
  options: {
    readonly id: string;
    readonly kind: LayoutContainer['kind'];
    readonly label: string;
    readonly zoneId?: LayoutContainer['zoneId'];
    readonly center: Position;
    readonly size: Position;
    readonly slots: readonly LayoutSlot[];
    readonly labelAnchor?: Position;
  },
): void => {
  containers.push({
    id: options.id,
    kind: options.kind,
    label: options.label,
    ...(options.zoneId ? { zoneId: options.zoneId } : {}),
    ...(options.labelAnchor ? { labelAnchor: options.labelAnchor } : {}),
    bounds: { center: options.center, size: options.size },
    slots: options.slots,
  });
};
