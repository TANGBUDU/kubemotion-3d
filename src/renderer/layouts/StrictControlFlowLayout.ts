import { getPodData } from '../../world/dataGuards';
import type { EntityId, WorldEntity } from '../../world/types';
import type {
  EntityLayout,
  LayoutContainer,
  LayoutInput,
  LayoutModule,
  LayoutResult,
  LayoutSlot,
} from '../LayoutEngine';
import { dimensions } from '../design/dimensions';
import {
  CONTROL_FLOW_ZONES,
  CONTROL_KINDS,
  EXTERNAL_CONTROL_KINDS,
  LANE_GAP,
  LANE_PADDING,
  NODE_BAY_COUNT,
  NODE_SPACING,
  type PackedLane,
  WORKLOAD_GAP,
  WORKLOAD_STATE_KINDS,
  addControlLane,
  allocateSlot,
  bayPosition,
  controlOrder,
  packHorizontalLanes,
  packedLaneWidth,
  previousSlot,
  relatedNodeName,
  workloadOrder,
  workloadVisualWidth,
} from './controlShared';
import { LayoutContractError } from './LayoutContractError';
import {
  assertEveryVisibleEntityIsAssigned,
  byEntityId,
  completeLayoutResult,
  compositionParent,
  visibleEntities,
} from './layoutShared';

/**
 * API-mediated control-flow layout.
 *
 * Unlike the legacy implementation, this module does not calculate a Placement layout first and
 * rename its containers. Every visible entity must satisfy an explicit control-flow role, and empty
 * semantic zones are omitted.
 */
export class StrictControlFlowLayout implements LayoutModule {
  public readonly view = 'control-flow' as const;

  public calculate(input: LayoutInput): LayoutResult {
    const visible = visibleEntities(input);
    const layouts = new Map<EntityId, EntityLayout>();
    const containers: LayoutContainer[] = [];
    const relations = Object.values(input.world.relations);

    const controlEntities = visible
      .filter((entity) => CONTROL_KINDS.has(entity.kind))
      .sort((left, right) => controlOrder(left) - controlOrder(right) || byEntityId(left, right));
    const externalActors = visible
      .filter((entity) => EXTERNAL_CONTROL_KINDS.has(entity.kind))
      .sort(byEntityId);

    const controlZone = CONTROL_FLOW_ZONES.controlPlane;
    const controlSpacing = 3.8;
    const controlWidth =
      controlEntities.length > 0 ? Math.max(8.5, controlEntities.length * controlSpacing + 1.5) : 0;

    if (controlEntities.length > 0) {
      const controlX = (index: number): number =>
        (index - (controlEntities.length - 1) / 2) * controlSpacing;
      controlEntities.forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [controlX(index), 0.18, controlZone.centerZ],
          lane: 'control',
          containerId: 'control-flow-control-plane',
          slotIndex: index,
        });
      });
      addControlLane(containers, {
        id: 'control-flow-control-plane',
        kind: 'control-lane',
        label: 'CONTROL PLANE',
        zoneId: 'control-plane',
        center: [0, 0.025, controlZone.centerZ],
        size: [controlWidth, 0.05, controlZone.depth],
        labelAnchor: [-9.4, 0.12, controlZone.centerZ - controlZone.depth / 2 + 0.145],
        slots: controlEntities.map((entity, index) => ({
          id: `control-flow-control-plane:slot:${index}`,
          index,
          position: [controlX(index), 0.18, controlZone.centerZ],
          occupiedBy: entity.id,
        })),
      });
    }

    if (externalActors.length > 0) {
      const spacing = 1.9;
      const externalWidth = 2.9;
      // Sits immediately left of the Control Plane plate so a wide control lane can never grow
      // underneath the external input plate.
      const externalX = -(controlWidth / 2 + LANE_GAP + externalWidth / 2);
      const externalZ = (index: number): number =>
        controlZone.centerZ + (index - (externalActors.length - 1) / 2) * spacing;
      externalActors.forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [externalX, 0.18, externalZ(index)],
          lane: 'control',
          containerId: 'control-flow-external-input',
          slotIndex: index,
        });
      });
      addControlLane(containers, {
        id: 'control-flow-external-input',
        kind: 'semantic-lane',
        label: 'EXTERNAL API INPUT',
        center: [externalX, 0.025, controlZone.centerZ],
        size: [externalWidth, 0.05, Math.max(2.4, externalActors.length * spacing + 0.7)],
        slots: externalActors.map((entity, index) => ({
          id: `control-flow-external-input:slot:${index}`,
          index,
          position: [externalX, 0.18, externalZ(index)],
          occupiedBy: entity.id,
        })),
      });
    }

    const nodes = visible.filter((entity) => entity.kind === 'Node').sort(byEntityId);
    const nodesById = new Map(nodes.map((node) => [node.id, node] as const));
    const nodesByName = new Map(nodes.map((node) => [node.name, node] as const));
    const nodeXById = new Map<EntityId, number>();

    const workerZone = CONTROL_FLOW_ZONES.workerNodes;

    nodes.forEach((node, index) => {
      const x = (index - (nodes.length - 1) / 2) * NODE_SPACING;
      nodeXById.set(node.id, x);
      layouts.set(node.id, {
        entityId: node.id,
        position: [x, 0, workerZone.centerZ],
        lane: 'node',
        containerId: `node:${node.id}`,
      });
    });

    const scheduledPodsByNode = new Map<EntityId, WorldEntity[]>();
    const transitPods: WorldEntity[] = [];
    const assignedPodsWithoutVisibleNode: WorldEntity[] = [];
    for (const pod of visible.filter((entity) => entity.kind === 'Pod').sort(byEntityId)) {
      const nodeName = getPodData(pod).nodeName;
      if (!nodeName) {
        transitPods.push(pod);
        continue;
      }
      const node = nodesByName.get(nodeName);
      if (!node) {
        assignedPodsWithoutVisibleNode.push(pod);
        continue;
      }
      const scheduled = scheduledPodsByNode.get(node.id) ?? [];
      scheduled.push(pod);
      scheduledPodsByNode.set(node.id, scheduled);
    }

    for (const node of nodes) {
      const x = nodeXById.get(node.id) ?? 0;
      const containerId = `node:${node.id}`;
      const used = new Set<number>();
      const occupied = new Map<number, EntityId>();
      const pods = scheduledPodsByNode.get(node.id) ?? [];
      if (pods.length > NODE_BAY_COUNT) {
        throw new LayoutContractError({
          view: input.view.view,
          scenarioId: input.world.scenarioId,
          issues: [{ code: 'missing-role', role: `node-capacity:${node.name}` }],
        });
      }

      for (const pod of pods) {
        const slotIndex = allocateSlot(
          pod.id,
          used,
          previousSlot(input, pod.id, containerId),
          input.world.scenarioId,
        );
        used.add(slotIndex);
        occupied.set(slotIndex, pod.id);
        layouts.set(pod.id, {
          entityId: pod.id,
          position: bayPosition(x, slotIndex),
          lane: 'pod-slot',
          parentId: node.id,
          containerId,
          slotIndex,
        });
      }

      const slots: LayoutSlot[] = dimensions.node.bayAnchors.map((_, slotIndex) => {
        const occupiedBy = occupied.get(slotIndex);
        return {
          id: `${containerId}:slot:${slotIndex}`,
          index: slotIndex,
          position: bayPosition(x, slotIndex),
          ...(occupiedBy ? { occupiedBy } : {}),
        };
      });
      addControlLane(containers, {
        id: containerId,
        kind: 'node-rack',
        label: node.name,
        center: [x, 0.2, workerZone.centerZ],
        size: [dimensions.node.width, 0.5, dimensions.node.depth],
        slots,
      });
    }

    if (nodes.length > 0) {
      addControlLane(containers, {
        id: 'control-flow-worker-zone',
        kind: 'worker-lane',
        label: 'WORKER NODES',
        zoneId: 'worker-nodes',
        center: [0, 0.025, workerZone.centerZ],
        size: [Math.max(8.5, nodes.length * NODE_SPACING + 1.5), 0.05, workerZone.depth],
        labelAnchor: [-9.4, 0.12, workerZone.centerZ - workerZone.depth / 2 + 0.205],
        slots: nodes.map((node, index) => ({
          id: `control-flow-worker-zone:slot:${index}`,
          index,
          position: [nodeXById.get(node.id) ?? 0, 0, workerZone.centerZ],
          occupiedBy: node.id,
        })),
      });
    }

    const agents = visible
      .filter((entity) => entity.kind === 'Kubelet' || entity.kind === 'ContainerRuntime')
      .sort(byEntityId);
    for (const agent of agents) {
      const nodeName = relatedNodeName(agent, relations, nodesById);
      const node = nodeName ? nodesByName.get(nodeName) : undefined;
      if (!node) {
        throw new LayoutContractError({
          view: input.view.view,
          scenarioId: input.world.scenarioId,
          issues: [{ code: 'missing-parent', entityId: agent.id, expectedParentKind: 'Node' }],
        });
      }
      const x = nodeXById.get(node.id) ?? 0;
      const offset =
        agent.kind === 'Kubelet'
          ? dimensions.node.kubeletMountOffset
          : dimensions.node.runtimeMountOffset;
      layouts.set(agent.id, {
        entityId: agent.id,
        position: [x + offset[0], offset[1], workerZone.centerZ + offset[2]],
        lane: 'node-agent',
        parentId: node.id,
        containerId: `node:${node.id}`,
      });
    }

    const workloadEntities = visible
      .filter((entity) => WORKLOAD_STATE_KINDS.has(entity.kind))
      .sort((left, right) => workloadOrder(left) - workloadOrder(right) || byEntityId(left, right));

    // Workload State, Unscheduled/Transit and Assigned Pod Context all teach "what the API server
    // currently believes", so they share the middle Z band and are packed side by side along X.
    // Nothing here may grow towards the Worker zone: that is what produced intersecting plates.
    const middleZone = CONTROL_FLOW_ZONES.workloadState;
    const podLaneSpacing = 2.15;
    const workloadWidths = workloadEntities.map((entity) => workloadVisualWidth(entity.kind));
    const podLaneWidth = (count: number): number =>
      Math.max(5.1, count * podLaneSpacing + LANE_PADDING);

    const middleLanes: PackedLane[] = [];
    if (workloadEntities.length > 0) {
      middleLanes.push({
        id: 'control-flow-workload-state',
        width: packedLaneWidth(workloadWidths, WORKLOAD_GAP),
      });
    }
    if (transitPods.length > 0) {
      middleLanes.push({
        id: 'control-flow-transit',
        width: podLaneWidth(transitPods.length),
      });
    }
    if (assignedPodsWithoutVisibleNode.length > 0) {
      middleLanes.push({
        id: 'control-flow-assigned-pod-context',
        width: podLaneWidth(assignedPodsWithoutVisibleNode.length),
      });
    }
    const middleLaneCenters = packHorizontalLanes(middleLanes, LANE_GAP);
    const middleLaneWidth = (id: string): number =>
      middleLanes.find((lane) => lane.id === id)?.width ?? 0;
    const middleLabelAnchor = (id: string, y: number): [number, number, number] => [
      (middleLaneCenters.get(id) ?? 0) - middleLaneWidth(id) / 2 + 0.4,
      y,
      middleZone.centerZ - middleZone.depth / 2 + 0.105,
    ];

    if (workloadEntities.length > 0) {
      const laneCenterX = middleLaneCenters.get('control-flow-workload-state') ?? 0;
      // Packed by real model width so wide cards (Deployment, ReplicaSet) keep enough clearance for
      // the persistent routes that terminate on them.
      const workloadX = packHorizontalLanes(
        workloadEntities.map((entity, index) => ({
          id: entity.id,
          width: workloadWidths[index] ?? workloadVisualWidth(entity.kind),
        })),
        WORKLOAD_GAP,
        laneCenterX,
      );
      const entityX = (entity: WorldEntity): number => workloadX.get(entity.id) ?? laneCenterX;
      workloadEntities.forEach((entity, index) => {
        layouts.set(entity.id, {
          entityId: entity.id,
          position: [entityX(entity), 0.18, middleZone.centerZ],
          lane: 'workload-state',
          containerId: 'control-flow-workload-state',
          slotIndex: index,
        });
      });
      addControlLane(containers, {
        id: 'control-flow-workload-state',
        kind: 'workload-lane',
        label: 'WORKLOAD STATE',
        zoneId: 'workload-state',
        center: [laneCenterX, 0.025, middleZone.centerZ],
        size: [middleLaneWidth('control-flow-workload-state'), 0.05, middleZone.depth],
        labelAnchor: middleLabelAnchor('control-flow-workload-state', 0.12),
        slots: workloadEntities.map((entity, index) => ({
          id: `control-flow-workload-state:slot:${index}`,
          index,
          position: [entityX(entity), 0.18, middleZone.centerZ],
          occupiedBy: entity.id,
        })),
      });
    }

    if (transitPods.length > 0) {
      const laneCenterX = middleLaneCenters.get('control-flow-transit') ?? 0;
      const podX = (index: number): number =>
        laneCenterX + (index - (transitPods.length - 1) / 2) * podLaneSpacing;
      transitPods.forEach((pod, index) => {
        layouts.set(pod.id, {
          entityId: pod.id,
          position: [podX(index), 0.3, middleZone.centerZ],
          lane: 'pending',
          containerId: 'control-flow-transit',
          slotIndex: index,
        });
      });
      addControlLane(containers, {
        id: 'control-flow-transit',
        kind: 'pending-lane',
        label: 'UNSCHEDULED / TRANSIT',
        zoneId: 'workload-state',
        center: [laneCenterX, 0.1, middleZone.centerZ],
        size: [middleLaneWidth('control-flow-transit'), 0.2, middleZone.depth],
        labelAnchor: middleLabelAnchor('control-flow-transit', 0.45),
        slots: transitPods.map((pod, index) => ({
          id: `control-flow-transit:slot:${index}`,
          index,
          position: [podX(index), 0.3, middleZone.centerZ],
          occupiedBy: pod.id,
        })),
      });
    }

    if (assignedPodsWithoutVisibleNode.length > 0) {
      const laneCenterX = middleLaneCenters.get('control-flow-assigned-pod-context') ?? 0;
      const podX = (index: number): number =>
        laneCenterX + (index - (assignedPodsWithoutVisibleNode.length - 1) / 2) * podLaneSpacing;
      assignedPodsWithoutVisibleNode.forEach((pod, index) => {
        layouts.set(pod.id, {
          entityId: pod.id,
          position: [podX(index), 0.18, middleZone.centerZ],
          lane: 'workload-state',
          containerId: 'control-flow-assigned-pod-context',
          slotIndex: index,
        });
      });
      addControlLane(containers, {
        id: 'control-flow-assigned-pod-context',
        kind: 'workload-lane',
        label: 'ASSIGNED POD CONTEXT',
        zoneId: 'workload-state',
        center: [laneCenterX, 0.025, middleZone.centerZ],
        size: [middleLaneWidth('control-flow-assigned-pod-context'), 0.05, middleZone.depth],
        labelAnchor: middleLabelAnchor('control-flow-assigned-pod-context', 0.12),
        slots: assignedPodsWithoutVisibleNode.map((pod, index) => ({
          id: `control-flow-assigned-pod-context:slot:${index}`,
          index,
          position: [podX(index), 0.18, middleZone.centerZ],
          occupiedBy: pod.id,
        })),
      });
    }

    const clusterContext = visible.filter((entity) => entity.kind === 'Cluster').sort(byEntityId);
    clusterContext.forEach((entity, index) => {
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [8.4, 0.03 + index * 0.02, controlZone.centerZ],
        lane: 'semantic',
        containerId: 'control-flow-scope-context',
        slotIndex: index,
      });
    });

    const runtimeContainers = visible
      .filter((entity) => entity.kind === 'Container')
      .sort(byEntityId);
    for (const entity of runtimeContainers) {
      const parentId = compositionParent(input.world, entity.id, layouts);
      if (!parentId) {
        throw new LayoutContractError({
          view: input.view.view,
          scenarioId: input.world.scenarioId,
          issues: [{ code: 'missing-parent', entityId: entity.id, expectedParentKind: 'Pod' }],
        });
      }
      layouts.set(entity.id, {
        entityId: entity.id,
        position: [0, 0, 0],
        lane: 'composition',
        parentId,
        containerId: `pod:${parentId}`,
      });
    }

    assertEveryVisibleEntityIsAssigned(input, visible, layouts);
    return completeLayoutResult(input, layouts, containers);
  }
}
