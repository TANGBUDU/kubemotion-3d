import type { ViewMode, ViewProjection } from '../course/types';
import { getPodData, isPlainRecord } from '../world/dataGuards';
import type {
  EntityId,
  RelationId,
  RelationSemantic,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../world/types';
import { dimensions } from './design/dimensions';
import { StrictControlFlowLayout } from './layouts/StrictControlFlowLayout';
import { StrictTrafficLayout } from './layouts/StrictTrafficLayout';

export type Position = readonly [number, number, number];

export type LayoutLane =
  | 'node'
  | 'pod-slot'
  | 'node-agent'
  | 'pending'
  | 'control'
  | 'workload-state'
  | 'composition'
  | 'semantic';

export interface EntityLayout {
  readonly entityId: EntityId;
  readonly position: Position;
  readonly lane: LayoutLane;
  readonly parentId?: EntityId;
  readonly containerId?: string;
  readonly slotIndex?: number;
}

export interface LayoutBounds {
  readonly center: Position;
  readonly size: Position;
}

export interface LayoutSlot {
  readonly id: string;
  readonly index: number;
  readonly position: Position;
  readonly occupiedBy?: EntityId;
}

export interface LayoutContainer {
  readonly id: string;
  readonly kind:
    | 'node-rack'
    | 'pending-lane'
    | 'control-lane'
    | 'workload-lane'
    | 'worker-lane'
    | 'semantic-lane';
  readonly label: string;
  readonly bounds: LayoutBounds;
  readonly entityId?: EntityId;
  readonly zoneId?: 'control-plane' | 'workload-state' | 'worker-nodes';
  readonly labelAnchor?: Position;
  readonly slots: readonly LayoutSlot[];
}

export interface RelationRoute {
  readonly relationId: RelationId;
  readonly points: readonly Position[];
  readonly curve: 'straight' | 'arc' | 'orthogonal';
}

export interface LayoutInput {
  readonly world: WorldSnapshot;
  readonly view: ViewProjection;
  readonly previous?: LayoutResult;
}

export interface LayoutResult {
  readonly entities: ReadonlyMap<EntityId, EntityLayout>;
  readonly containers: readonly LayoutContainer[];
  readonly routes: ReadonlyMap<RelationId, RelationRoute>;
  /** Convenience view retained for camera/animation consumers; entity layouts remain authoritative. */
  readonly positions: ReadonlyMap<EntityId, Position>;
}

export interface LayoutModule {
  readonly view: ViewMode;
  calculate(input: LayoutInput): LayoutResult;
}

const NODE_BAY_COUNT = dimensions.node.bayAnchors.length;
const NODE_RACK_SPACING = dimensions.node.width + 0.2;
const OCCUPIED_WORKER_LANE_HORIZONTAL_PADDING = 0.6;
const OCCUPIED_WORKER_LANE_DEPTH_PADDING = 0.5;
const occupiedWorkerLaneWidth = (nodeCount: number): number =>
  Math.max(0, nodeCount - 1) * NODE_RACK_SPACING +
  dimensions.node.width +
  OCCUPIED_WORKER_LANE_HORIZONTAL_PADDING;
const occupiedWorkerLaneDepth = dimensions.node.depth + OCCUPIED_WORKER_LANE_DEPTH_PADDING;

const TEACHING_ZONES = Object.freeze({
  controlPlane: Object.freeze({ centerZ: -5.25, depth: 2.55 }),
  workloadState: Object.freeze({ centerZ: -2.05, depth: 2.35 }),
  workerNodes: Object.freeze({ centerZ: 2.85, depth: 5.55 }),
});

const PENDING_TRAY_CENTER_X = 4.6;
const EXTERNAL_CONTROL_INPUT_X = -11.65;

const byId = (left: WorldEntity, right: WorldEntity): number => left.id.localeCompare(right.id);

const configuredRackOrder = (entity: WorldEntity): number => {
  const value = entity.data.rackOrder;
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
};

const byRackOrder = (left: WorldEntity, right: WorldEntity): number =>
  configuredRackOrder(left) - configuredRackOrder(right) || byId(left, right);

const isVisible = (entity: WorldEntity, view: ViewProjection): boolean => {
  const state = view.entityStates[entity.id];
  return state?.visible === true && state.emphasis !== 'hidden';
};

const toPositions = (
  entities: ReadonlyMap<EntityId, EntityLayout>,
): ReadonlyMap<EntityId, Position> =>
  new Map([...entities].map(([entityId, layout]) => [entityId, layout.position] as const));

const routeCurve = (semantic: RelationSemantic): RelationRoute['curve'] => {
  switch (semantic) {
    case 'ownership':
    case 'control-observation':
    case 'selection':
    case 'endpoint-membership':
      return 'arc';
    case 'placement':
    case 'storage':
    case 'configuration':
      return 'orthogonal';
    case 'composition':
    case 'scope':
    case 'data-flow':
    case 'DNS-flow':
      return 'straight';
  }
};

const anchorPosition = (
  layout: EntityLayout,
  relation: WorldRelation,
  endpoint: 'from' | 'to',
): Position => {
  const [x, y, z] = layout.position;
  if (relation.semantic === 'composition') {
    return endpoint === 'from' ? [x, y + 0.75, z] : [x, y + 0.88, z];
  }
  if (relation.semantic === 'placement') {
    return endpoint === 'from' ? [x, y + 0.45, z] : [x, y + 0.42, z];
  }
  if (relation.semantic === 'ownership') {
    return endpoint === 'from' ? [x + 0.9, y + 0.72, z] : [x - 0.72, y + 0.78, z];
  }
  if (relation.semantic === 'control-observation') {
    return [x, y + 0.72, z];
  }
  return [x, y + 0.5, z];
};

const buildRoutes = (
  world: WorldSnapshot,
  view: ViewProjection,
  entities: ReadonlyMap<EntityId, EntityLayout>,
): ReadonlyMap<RelationId, RelationRoute> => {
  const routes = new Map<RelationId, RelationRoute>();
  const relations = Object.values(world.relations).sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  for (const relation of relations) {
    const state = view.relationStates[relation.id];
    if (!state?.visible) continue;
    const from = entities.get(relation.from);
    const to = entities.get(relation.to);
    if (!from || !to) continue;
    routes.set(relation.id, {
      relationId: relation.id,
      points: [anchorPosition(from, relation, 'from'), anchorPosition(to, relation, 'to')],
      curve: routeCurve(relation.semantic),
    });
  }
  return routes;
};

const completeResult = (
  world: WorldSnapshot,
  view: ViewProjection,
  entities: ReadonlyMap<EntityId, EntityLayout>,
  containers: readonly LayoutContainer[],
): LayoutResult => ({
  entities,
  containers,
  routes: buildRoutes(world, view, entities),
  positions: toPositions(entities),
});

const stableHash = (value: string): number => {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

const dataNodeName = (entity: WorldEntity): string | undefined => {
  if (!isPlainRecord(entity.data)) return undefined;
  const value = entity.data.nodeName;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
};

const relatedNodeName = (
  entity: WorldEntity,
  relations: readonly WorldRelation[],
  nodesById: ReadonlyMap<EntityId, WorldEntity>,
): string | undefined => {
  for (const relation of relations) {
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

const previousSlot = (
  previous: LayoutResult | undefined,
  entityId: EntityId,
  containerId: string,
): number | undefined => {
  const layout = previous?.entities.get(entityId);
  return layout?.containerId === containerId ? layout.slotIndex : undefined;
};

const allocateSlot = (
  entityId: EntityId,
  used: ReadonlySet<number>,
  preferred: number | undefined,
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
  throw new Error(
    `Cannot place scheduled Pod "${entityId}": all ${NODE_BAY_COUNT} Node bays are occupied.`,
  );
};

const nodeBayOffset = (slotIndex: number): Position => {
  const anchor = dimensions.node.bayAnchors[slotIndex];
  if (!anchor) {
    throw new Error(
      `Invalid Node bay index ${slotIndex}; expected an index from 0 to ${NODE_BAY_COUNT - 1}.`,
    );
  }
  return [anchor[0], dimensions.node.podLandingY, anchor[1]];
};

const nodeModuleOffset = (entity: WorldEntity): Position | undefined => {
  if (entity.kind === 'Kubelet') return dimensions.node.kubeletMountOffset;
  if (entity.kind === 'ContainerRuntime') return dimensions.node.runtimeMountOffset;
  return undefined;
};

export class PlacementLayout implements LayoutModule {
  public readonly view = 'placement' as const;

  public calculate(input: LayoutInput): LayoutResult {
    const { world, view, previous } = input;
    const visibleEntities = Object.values(world.entities).filter((entity) =>
      isVisible(entity, view),
    );
    const visibleNodes = visibleEntities
      .filter((entity) => entity.kind === 'Node')
      .sort(byRackOrder);
    const allRelations = Object.values(world.relations);
    const nodesById = new Map(visibleNodes.map((entity) => [entity.id, entity] as const));
    const nodesByName = new Map(visibleNodes.map((entity) => [entity.name, entity] as const));
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const nodeXById = new Map<EntityId, number>();

    visibleNodes.forEach((node, nodeIndex) => {
      const x = (nodeIndex - (visibleNodes.length - 1) / 2) * NODE_RACK_SPACING;
      nodeXById.set(node.id, x);
      layouts.set(node.id, {
        entityId: node.id,
        position: [x, 0, TEACHING_ZONES.workerNodes.centerZ],
        lane: 'node',
        containerId: `node:${node.id}`,
      });
    });

    if (visibleNodes.length > 0) {
      const workerLaneWidth = occupiedWorkerLaneWidth(visibleNodes.length);
      containers.push({
        id: 'worker-nodes-zone',
        kind: 'worker-lane',
        label: 'WORKER NODES',
        zoneId: 'worker-nodes',
        labelAnchor: [-workerLaneWidth / 2 + 0.3, 0.12, 0.28],
        bounds: {
          center: [0, 0.025, TEACHING_ZONES.workerNodes.centerZ],
          size: [workerLaneWidth, 0.05, occupiedWorkerLaneDepth],
        },
        slots: visibleNodes.map((node, index) => ({
          id: `worker-nodes-zone:slot:${index}`,
          index,
          position: [nodeXById.get(node.id) ?? 0, 0, TEACHING_ZONES.workerNodes.centerZ],
          occupiedBy: node.id,
        })),
      });
    }

    const scheduledPods = new Map<EntityId, WorldEntity[]>();
    const pendingPods: WorldEntity[] = [];
    for (const entity of visibleEntities
      .filter((candidate) => candidate.kind === 'Pod')
      .sort(byId)) {
      const nodeName = getPodData(entity).nodeName;
      const node = nodeName ? nodesByName.get(nodeName) : undefined;
      if (!nodeName) {
        pendingPods.push(entity);
        continue;
      }
      if (!node) continue;
      const pods = scheduledPods.get(node.id) ?? [];
      pods.push(entity);
      scheduledPods.set(node.id, pods);
    }

    for (const node of visibleNodes) {
      const x = nodeXById.get(node.id) ?? 0;
      const containerId = `node:${node.id}`;
      const used = new Set<number>();
      const occupied = new Map<number, EntityId>();
      const nodePods = scheduledPods.get(node.id) ?? [];
      if (nodePods.length > NODE_BAY_COUNT) {
        throw new Error(
          `Cannot place ${nodePods.length} scheduled Pods on Node "${node.name}": capacity is ${NODE_BAY_COUNT} bays.`,
        );
      }
      for (const pod of nodePods) {
        const preferred = previousSlot(previous, pod.id, containerId);
        const slotIndex = allocateSlot(pod.id, used, preferred);
        used.add(slotIndex);
        occupied.set(slotIndex, pod.id);
        const [offsetX, offsetY, offsetZ] = nodeBayOffset(slotIndex);
        layouts.set(pod.id, {
          entityId: pod.id,
          position: [x + offsetX, offsetY, TEACHING_ZONES.workerNodes.centerZ + offsetZ],
          lane: 'pod-slot',
          parentId: node.id,
          containerId,
          slotIndex,
        });
      }
      const slots: LayoutSlot[] = [];
      for (let slotIndex = 0; slotIndex < NODE_BAY_COUNT; slotIndex += 1) {
        const [offsetX, offsetY, offsetZ] = nodeBayOffset(slotIndex);
        const occupiedBy = occupied.get(slotIndex);
        slots.push({
          id: `${containerId}:slot:${slotIndex}`,
          index: slotIndex,
          position: [x + offsetX, offsetY, TEACHING_ZONES.workerNodes.centerZ + offsetZ],
          ...(occupiedBy ? { occupiedBy } : {}),
        });
      }
      containers.push({
        id: containerId,
        kind: 'node-rack',
        label: node.name,
        entityId: node.id,
        bounds: {
          center: [x, 0.2, TEACHING_ZONES.workerNodes.centerZ],
          size: [dimensions.node.width, 0.5, dimensions.node.depth],
        },
        slots,
      });
    }

    const nodeAgents = visibleEntities
      .filter((entity) => entity.kind === 'Kubelet' || entity.kind === 'ContainerRuntime')
      .sort(byId);
    for (const agent of nodeAgents) {
      const nodeName = dataNodeName(agent) ?? relatedNodeName(agent, allRelations, nodesById);
      const node = nodeName ? nodesByName.get(nodeName) : undefined;
      if (!node) continue;
      const x = nodeXById.get(node.id) ?? 0;
      const offset = nodeModuleOffset(agent);
      if (!offset) continue;
      const [moduleX, moduleY, moduleZ] = offset;
      layouts.set(agent.id, {
        entityId: agent.id,
        position: [x + moduleX, moduleY, TEACHING_ZONES.workerNodes.centerZ + moduleZ],
        lane: 'node-agent',
        parentId: node.id,
        containerId: `node:${node.id}`,
      });
    }

    const controlKinds = new Set([
      'KubeAPIServer',
      'ApiServer',
      'APIServer',
      'Etcd',
      'ControllerManager',
      'KubeControllerManager',
      'Scheduler',
      'MetricSource',
      'HorizontalPodAutoscaler',
    ]);
    const controlEntities = visibleEntities
      .filter((entity) => controlKinds.has(entity.kind))
      .sort((left, right) => {
        const order = (entity: WorldEntity): number => {
          if (
            entity.kind === 'KubeAPIServer' ||
            entity.kind === 'ApiServer' ||
            entity.kind === 'APIServer'
          )
            return 0;
          if (entity.kind === 'Etcd') return 1;
          if (entity.kind === 'ControllerManager' || entity.kind === 'KubeControllerManager')
            return 2;
          if (entity.kind === 'Scheduler') return 3;
          if (entity.kind === 'MetricSource') return 4;
          if (entity.kind === 'HorizontalPodAutoscaler') return 5;
          return 6;
        };
        return order(left) - order(right) || left.id.localeCompare(right.id);
      });
    if (controlEntities.length > 0) {
      const spacing = 5.15;
      controlEntities.forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [
            (index - (controlEntities.length - 1) / 2) * spacing,
            0.08,
            TEACHING_ZONES.controlPlane.centerZ,
          ],
          lane: 'control',
          containerId: 'control-plane-zone',
          slotIndex: index,
        });
      });
      containers.push({
        id: 'control-plane-zone',
        kind: 'control-lane',
        label: 'CONTROL PLANE',
        zoneId: 'control-plane',
        labelAnchor: [-9.4, 0.12, -6.38],
        bounds: {
          center: [0, 0.025, TEACHING_ZONES.controlPlane.centerZ],
          size: [20, 0.05, TEACHING_ZONES.controlPlane.depth],
        },
        slots: controlEntities.map((entity, index) => ({
          id: `control-plane-zone:slot:${index}`,
          index,
          position: [
            (index - (controlEntities.length - 1) / 2) * spacing,
            0.08,
            TEACHING_ZONES.controlPlane.centerZ,
          ],
          occupiedBy: entity.id,
        })),
      });
    }

    const externalControlEntities = visibleEntities
      .filter((entity) => entity.kind === 'Kubectl' || entity.kind === 'Developer')
      .sort(byId);
    externalControlEntities.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        // Keep the command terminal outside the control-plane island instead of hiding it behind
        // the API Server. The camera framer includes this external actor in its fitted bounds.
        position: [
          EXTERNAL_CONTROL_INPUT_X,
          0.08,
          TEACHING_ZONES.controlPlane.centerZ + index * 1.8,
        ],
        lane: 'control',
        containerId: 'external-control-input',
        slotIndex: index,
      });
    });

    const replicaSets = visibleEntities.filter((entity) => entity.kind === 'ReplicaSet').sort(byId);
    replicaSets.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [-5.55 + index * 3.9, 0.08, TEACHING_ZONES.workloadState.centerZ],
        lane: 'workload-state',
        containerId: 'workload-state-zone',
        slotIndex: index,
      });
    });
    const workloadBoundsWidth = Math.max(8.5, replicaSets.length * 3.9 + 1.2);
    const workloadBoundsCenterX = -5.1 + Math.max(0, replicaSets.length - 1) * 1.95;
    containers.push({
      id: 'workload-state-zone',
      kind: 'workload-lane',
      label: 'WORKLOAD STATE',
      zoneId: 'workload-state',
      labelAnchor: [-9.4, 0.12, -3.12],
      bounds: {
        center: [workloadBoundsCenterX, 0.025, TEACHING_ZONES.workloadState.centerZ],
        size: [workloadBoundsWidth, 0.05, TEACHING_ZONES.workloadState.depth],
      },
      slots: replicaSets.map((entity, index) => ({
        id: `workload-state-zone:slot:${index}`,
        index,
        position: [-5.55 + index * 3.9, 0.08, TEACHING_ZONES.workloadState.centerZ],
        occupiedBy: entity.id,
      })),
    });

    const pendingSlotCount = Math.max(3, pendingPods.length);
    const pendingSlotSpacing = 1.95;
    const pendingSlotPositions: Position[] = Array.from(
      { length: pendingSlotCount },
      (_, index) => [
        PENDING_TRAY_CENTER_X + (index - (pendingSlotCount - 1) / 2) * pendingSlotSpacing,
        0.28,
        TEACHING_ZONES.workloadState.centerZ,
      ],
    );
    const assignedSlotIndices =
      pendingPods.length === 1
        ? [1]
        : pendingPods.length === 2
          ? [0, 2]
          : pendingPods.map((_, index) => index);
    const pendingOccupancy = new Map<number, EntityId>();
    pendingPods.forEach((pod, index) => {
      const slotIndex = assignedSlotIndices[index] ?? index;
      const position = pendingSlotPositions[slotIndex] ?? [
        PENDING_TRAY_CENTER_X,
        0.28,
        TEACHING_ZONES.workloadState.centerZ,
      ];
      pendingOccupancy.set(slotIndex, pod.id);
      layouts.set(pod.id, {
        entityId: pod.id,
        position,
        lane: 'pending',
        containerId: 'pending-lane',
        slotIndex,
      });
    });
    containers.push({
      id: 'pending-lane',
      kind: 'pending-lane',
      label: 'UNSCHEDULED PODS',
      zoneId: 'workload-state',
      labelAnchor: [1.4, 0.48, -3.02],
      bounds: {
        center: [PENDING_TRAY_CENTER_X, 0.1, TEACHING_ZONES.workloadState.centerZ],
        size: [Math.max(6.45, pendingSlotCount * pendingSlotSpacing + 0.7), 0.2, 1.82],
      },
      slots: pendingSlotPositions.map((position, index) => {
        const occupiedBy = pendingOccupancy.get(index);
        return {
          id: `pending-lane:slot:${index}`,
          index,
          position,
          ...(occupiedBy ? { occupiedBy } : {}),
        };
      }),
    });

    const containsRelations = allRelations
      .filter((relation) => relation.semantic === 'composition')
      .sort((left, right) => left.id.localeCompare(right.id));
    for (const entity of visibleEntities
      .filter((candidate) => candidate.kind === 'Container')
      .sort(byId)) {
      const relation = containsRelations.find(
        (candidate) => candidate.to === entity.id && layouts.has(candidate.from),
      );
      if (!relation) continue;
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [0, 0, 0],
        lane: 'composition',
        parentId: relation.from,
        containerId: `pod:${relation.from}`,
      });
    }

    const reserved = new Set(layouts.keys());
    const semanticRemainder = visibleEntities
      .filter((entity) => !reserved.has(entity.id))
      .sort(byId);
    semanticRemainder.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [-5.4 + (index % 6) * 2.15, 0.18, 7.4 + Math.floor(index / 6) * 1.8],
        lane: 'semantic',
        containerId: 'placement-context',
        slotIndex: index,
      });
    });

    return completeResult(world, view, layouts, containers);
  }
}

abstract class SemanticLaneLayout implements LayoutModule {
  public abstract readonly view: ViewMode;
  protected abstract laneKey(entity: WorldEntity): string;

  public calculate(input: LayoutInput): LayoutResult {
    const visible = Object.values(input.world.entities).filter((entity) =>
      isVisible(entity, input.view),
    );
    const byLane = new Map<string, WorldEntity[]>();
    for (const entity of visible.sort(byId)) {
      const key = this.laneKey(entity);
      const lane = byLane.get(key) ?? [];
      lane.push(entity);
      byLane.set(key, lane);
    }
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    [...byLane]
      .sort(([left], [right]) => left.localeCompare(right))
      .forEach(([key, lane], laneIndex) => {
        const x = (laneIndex - (byLane.size - 1) / 2) * 5.2;
        lane.forEach((entity, index) => {
          layouts.set(entity.id, {
            entityId: entity.id,
            position: [x, 0.2 + index * 1.6, 0],
            lane: 'semantic',
            containerId: `${this.view}:${key}`,
            slotIndex: index,
          });
        });
        containers.push({
          id: `${this.view}:${key}`,
          kind: 'semantic-lane',
          label: key,
          bounds: { center: [x, 0, 0], size: [4.4, 0.1, 3.4] },
          slots: lane.map((entity, index) => ({
            id: `${this.view}:${key}:slot:${index}`,
            index,
            position: [x, 0.2 + index * 1.6, 0],
            occupiedBy: entity.id,
          })),
        });
      });
    return completeResult(input.world, input.view, layouts, containers);
  }
}

const OVERVIEW_ZONES = Object.freeze({
  controlPlane: Object.freeze({ centerZ: -4.95, depth: 3.05 }),
  transit: Object.freeze({ centerX: 4.65, centerZ: -1.3, width: 6.5, depth: 1.6 }),
  workers: Object.freeze({ centerZ: 2.8, depth: 5.45 }),
});

const overviewControlOrder = (entity: WorldEntity): number => {
  switch (entity.kind) {
    case 'KubeAPIServer':
    case 'ApiServer':
    case 'APIServer':
      return 0;
    case 'Etcd':
      return 1;
    case 'Scheduler':
      return 2;
    case 'ControllerManager':
    case 'KubeControllerManager':
      return 3;
    default:
      return 4;
  }
};

/**
 * Foundation-first overview. The cluster is a bounded teaching stage with separate control-plane,
 * worker, and unscheduled/transit islands; it deliberately does not inherit Placement geometry.
 */
export class OverviewLayout implements LayoutModule {
  public readonly view = 'overview' as const;

  public calculate(input: LayoutInput): LayoutResult {
    const { world, view, previous } = input;
    const visible = Object.values(world.entities).filter((entity) => isVisible(entity, view));
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const relations = Object.values(world.relations);

    const cluster = visible.find((entity) => entity.kind === 'Cluster');
    if (cluster) {
      layouts.set(cluster.id, {
        entityId: cluster.id,
        position: [0, 0.08, 6.65],
        lane: 'semantic',
        containerId: 'cluster-foundation',
      });
    }

    const controlKinds = new Set([
      'KubeAPIServer',
      'ApiServer',
      'APIServer',
      'Etcd',
      'Scheduler',
      'ControllerManager',
      'KubeControllerManager',
    ]);
    const controlEntities = visible
      .filter((entity) => controlKinds.has(entity.kind))
      .sort(
        (left, right) =>
          overviewControlOrder(left) - overviewControlOrder(right) || byId(left, right),
      );
    const controlSpacing = 4.45;
    const controlLaneWidth = Math.max(
      4.8,
      Math.max(0, controlEntities.length - 1) * controlSpacing + 3.2,
    );
    controlEntities.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [
          (index - (controlEntities.length - 1) / 2) * controlSpacing,
          0.08,
          OVERVIEW_ZONES.controlPlane.centerZ,
        ],
        lane: 'control',
        containerId: 'control-plane-island',
        slotIndex: index,
      });
    });
    containers.push({
      id: 'control-plane-island',
      kind: 'control-lane',
      label: 'CONTROL PLANE ISLAND',
      zoneId: 'control-plane',
      labelAnchor: [-controlLaneWidth / 2 + 0.5, 0.14, -6.25],
      bounds: {
        center: [0, 0.035, OVERVIEW_ZONES.controlPlane.centerZ],
        size: [controlLaneWidth, 0.07, OVERVIEW_ZONES.controlPlane.depth],
      },
      slots: controlEntities.map((entity, index) => ({
        id: `control-plane-island:slot:${index}`,
        index,
        position: [
          (index - (controlEntities.length - 1) / 2) * controlSpacing,
          0.08,
          OVERVIEW_ZONES.controlPlane.centerZ,
        ],
        occupiedBy: entity.id,
      })),
    });

    const nodes = visible.filter((entity) => entity.kind === 'Node').sort(byRackOrder);
    const nodesByName = new Map(nodes.map((node) => [node.name, node] as const));
    const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
    const nodeXById = new Map<EntityId, number>();
    nodes.forEach((node, index) => {
      const x = (index - (nodes.length - 1) / 2) * NODE_RACK_SPACING;
      nodeXById.set(node.id, x);
      layouts.set(node.id, {
        entityId: node.id,
        position: [x, 0, OVERVIEW_ZONES.workers.centerZ],
        lane: 'node',
        containerId: `node:${node.id}`,
      });
    });
    const workerLaneWidth = occupiedWorkerLaneWidth(nodes.length);
    containers.push({
      id: 'worker-nodes-island',
      kind: 'worker-lane',
      label: 'WORKER NODES ISLAND',
      zoneId: 'worker-nodes',
      labelAnchor: [-workerLaneWidth / 2 + 0.3, 0.14, 0.35],
      bounds: {
        center: [0, 0.035, OVERVIEW_ZONES.workers.centerZ],
        size: [workerLaneWidth, 0.07, occupiedWorkerLaneDepth],
      },
      slots: nodes.map((node, index) => ({
        id: `worker-nodes-island:slot:${index}`,
        index,
        position: [nodeXById.get(node.id) ?? 0, 0, OVERVIEW_ZONES.workers.centerZ],
        occupiedBy: node.id,
      })),
    });

    const scheduledPods = new Map<EntityId, WorldEntity[]>();
    const pendingPods: WorldEntity[] = [];
    for (const pod of visible.filter((entity) => entity.kind === 'Pod').sort(byId)) {
      const nodeName = getPodData(pod).nodeName;
      if (!nodeName) {
        pendingPods.push(pod);
        continue;
      }
      const node = nodesByName.get(nodeName);
      if (!node) continue;
      const peers = scheduledPods.get(node.id) ?? [];
      peers.push(pod);
      scheduledPods.set(node.id, peers);
    }

    for (const node of nodes) {
      const x = nodeXById.get(node.id) ?? 0;
      const containerId = `node:${node.id}`;
      const used = new Set<number>();
      const occupied = new Map<number, EntityId>();
      const nodePods = scheduledPods.get(node.id) ?? [];
      if (nodePods.length > NODE_BAY_COUNT) {
        throw new Error(
          `Cannot place ${nodePods.length} scheduled Pods on Node "${node.name}": capacity is ${NODE_BAY_COUNT} bays.`,
        );
      }
      for (const pod of nodePods) {
        const slotIndex = allocateSlot(pod.id, used, previousSlot(previous, pod.id, containerId));
        used.add(slotIndex);
        occupied.set(slotIndex, pod.id);
        const [offsetX, offsetY, offsetZ] = nodeBayOffset(slotIndex);
        layouts.set(pod.id, {
          entityId: pod.id,
          position: [x + offsetX, offsetY, OVERVIEW_ZONES.workers.centerZ + offsetZ],
          lane: 'pod-slot',
          parentId: node.id,
          containerId,
          slotIndex,
        });
      }
      containers.push({
        id: containerId,
        kind: 'node-rack',
        label: node.name,
        entityId: node.id,
        bounds: {
          center: [x, 0.2, OVERVIEW_ZONES.workers.centerZ],
          size: [dimensions.node.width, 0.5, dimensions.node.depth],
        },
        slots: dimensions.node.bayAnchors.map((_, slotIndex) => {
          const [offsetX, offsetY, offsetZ] = nodeBayOffset(slotIndex);
          const occupiedBy = occupied.get(slotIndex);
          return {
            id: `${containerId}:slot:${slotIndex}`,
            index: slotIndex,
            position: [x + offsetX, offsetY, OVERVIEW_ZONES.workers.centerZ + offsetZ] as const,
            ...(occupiedBy ? { occupiedBy } : {}),
          };
        }),
      });
    }

    const transitSlotCount = Math.max(3, pendingPods.length);
    const transitSpacing = 1.9;
    const transitSlots = Array.from(
      { length: transitSlotCount },
      (_, index) =>
        [
          OVERVIEW_ZONES.transit.centerX + (index - (transitSlotCount - 1) / 2) * transitSpacing,
          0.28,
          OVERVIEW_ZONES.transit.centerZ,
        ] as const satisfies Position,
    );
    pendingPods.forEach((pod, index) => {
      const slotIndex = pendingPods.length === 1 ? 1 : index;
      const position = transitSlots[slotIndex] ?? transitSlots[0] ?? [0, 0.28, 0];
      layouts.set(pod.id, {
        entityId: pod.id,
        position,
        lane: 'pending',
        containerId: 'unscheduled-transit-lane',
        slotIndex,
      });
    });
    containers.push({
      id: 'unscheduled-transit-lane',
      kind: 'pending-lane',
      label: 'UNSCHEDULED / TRANSIT',
      zoneId: 'workload-state',
      labelAnchor: [1.55, 0.34, -2.05],
      bounds: {
        center: [OVERVIEW_ZONES.transit.centerX, 0.1, OVERVIEW_ZONES.transit.centerZ],
        size: [OVERVIEW_ZONES.transit.width, 0.2, OVERVIEW_ZONES.transit.depth],
      },
      slots: transitSlots.map((position, index) => {
        const occupiedBy = pendingPods.find((_, podIndex) =>
          pendingPods.length === 1 ? index === 1 && podIndex === 0 : index === podIndex,
        )?.id;
        return {
          id: `unscheduled-transit-lane:slot:${index}`,
          index,
          position,
          ...(occupiedBy ? { occupiedBy } : {}),
        };
      }),
    });

    const nodeAgents = visible
      .filter((entity) => entity.kind === 'Kubelet' || entity.kind === 'ContainerRuntime')
      .sort(byId);
    for (const agent of nodeAgents) {
      const nodeName = dataNodeName(agent) ?? relatedNodeName(agent, relations, nodesById);
      const node = nodeName ? nodesByName.get(nodeName) : undefined;
      if (!node) continue;
      const offset = nodeModuleOffset(agent);
      if (!offset) continue;
      const [offsetX, offsetY, offsetZ] = offset;
      layouts.set(agent.id, {
        entityId: agent.id,
        position: [
          (nodeXById.get(node.id) ?? 0) + offsetX,
          offsetY,
          OVERVIEW_ZONES.workers.centerZ + offsetZ,
        ],
        lane: 'node-agent',
        parentId: node.id,
        containerId: `node:${node.id}`,
      });
    }

    const reserved = new Set(layouts.keys());
    visible
      .filter((entity) => !reserved.has(entity.id))
      .sort(byId)
      .forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [-11.7, 0.18, -4.4 + index * 1.8],
          lane: 'semantic',
          containerId: 'external-entry',
          slotIndex: index,
        });
      });

    return completeResult(world, view, layouts, containers);
  }
}

/**
 * Logical ownership is deliberately not a rearranged Placement scene. Namespaced API objects sit
 * on a shallow workspace in ownership columns, while optional Node context stays outside it.
 */
export class LogicalLayout implements LayoutModule {
  public readonly view = 'logical' as const;

  public calculate(input: LayoutInput): LayoutResult {
    const visible = Object.values(input.world.entities)
      .filter((entity) => isVisible(entity, input.view))
      .sort(byId);
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const logical = dimensions.logical;
    const rowZ = (index: number, count: number, spacing: number): number =>
      (index - (count - 1) / 2) * spacing;

    const namespaces = visible.filter((entity) => entity.kind === 'Namespace');
    namespaces.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [logical.namespaceWorkspace.centerX, 0.03 + index * 0.02, 0],
        lane: 'semantic',
        containerId: 'namespace-workspace',
        slotIndex: index,
      });
    });

    const placeOwnershipColumn = (kind: string, x: number): void => {
      const entities = visible.filter((entity) => entity.kind === kind);
      entities.forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [x, 0.18, rowZ(index, entities.length, logical.rowSpacing)],
          lane: 'semantic',
          containerId: 'namespace-workspace',
          slotIndex: index,
        });
      });
    };
    placeOwnershipColumn('Deployment', logical.deploymentColumnX);
    placeOwnershipColumn('ReplicaSet', logical.replicaSetColumnX);
    placeOwnershipColumn('Pod', logical.podColumnX);

    const nodes = visible.filter((entity) => entity.kind === 'Node').sort(byRackOrder);
    nodes.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [logical.placementContextX, 0, rowZ(index, nodes.length, logical.nodeRowSpacing)],
        lane: 'node',
        containerId: 'logical-placement-context',
        slotIndex: index,
      });
    });
    if (nodes.length > 0) {
      const depth = Math.max(
        dimensions.node.depth + 0.5,
        (nodes.length - 1) * logical.nodeRowSpacing + dimensions.node.depth + 0.35,
      );
      containers.push({
        id: 'logical-placement-context',
        kind: 'semantic-lane',
        label: 'PLACEMENT CONTEXT / NODES',
        bounds: {
          center: [logical.placementContextX, 0.025, 0],
          size: [dimensions.node.width + 0.5, 0.05, depth],
        },
        labelAnchor: [logical.placementContextX - dimensions.node.width / 2, 0.12, -depth / 2],
        slots: nodes.map((entity, index) => ({
          id: `logical-placement-context:slot:${index}`,
          index,
          position: [
            logical.placementContextX,
            0,
            rowZ(index, nodes.length, logical.nodeRowSpacing),
          ],
          occupiedBy: entity.id,
        })),
      });
    }

    const reserved = new Set(layouts.keys());
    const remainder = visible.filter((entity) => !reserved.has(entity.id));
    remainder.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [
          logical.namespaceWorkspace.centerX +
            (index - (remainder.length - 1) / 2) * logical.rowSpacing,
          0.18,
          logical.namespaceWorkspace.depth / 2 + 1.3,
        ],
        lane: 'semantic',
        containerId: 'logical-context',
        slotIndex: index,
      });
    });

    return completeResult(input.world, input.view, layouts, containers);
  }
}

export { StrictControlFlowLayout as ControlFlowLayout };
export { StrictTrafficLayout as TrafficLayout };

export class StorageLayout extends SemanticLaneLayout {
  public readonly view = 'storage' as const;
  protected laneKey(entity: WorldEntity): string {
    return entity.visual.archetype === 'storage' ? 'storage' : entity.category;
  }
}

const modules: Readonly<Record<ViewMode, LayoutModule>> = {
  overview: new OverviewLayout(),
  logical: new LogicalLayout(),
  placement: new PlacementLayout(),
  'control-flow': new StrictControlFlowLayout(),
  traffic: new StrictTrafficLayout(),
  storage: new StorageLayout(),
};

export const calculateLayout = (input: LayoutInput): LayoutResult =>
  modules[input.view.view].calculate(input);
