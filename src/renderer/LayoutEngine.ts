import type { SceneProjection, ViewMode } from '../course/types';
import type { ClusterEntity, ClusterGraph, EntityId } from '../domain/types';

export type Position = readonly [number, number, number];
export interface LayoutResult {
  positions: ReadonlyMap<EntityId, Position>;
}

const kindOrder = [
  'Cluster',
  'KubeAPIServer',
  'Etcd',
  'Scheduler',
  'ControllerManager',
  'Namespace',
  'Deployment',
  'ReplicaSet',
  'Service',
  'EndpointSlice',
  'Pod',
  'Node',
  'Kubelet',
  'ContainerRuntime',
];

function rank(entity: ClusterEntity): number {
  const value = kindOrder.indexOf(entity.kind);
  return value < 0 ? kindOrder.length : value;
}

function overview(entity: ClusterEntity, index: number): Position {
  if (entity.kind === 'Cluster') return [0, -0.8, 0];
  if (entity.visual.group === 'control-plane') return [-5 + index * 1.7, 2.6, -2.7];
  if (entity.kind === 'Node') return [-5 + index * 5, 0, 2.5];
  if (entity.kind === 'Pod') return [-4 + (index % 5) * 2, 1.2, 0.6 + Math.floor(index / 5) * 1.5];
  return [-4 + (index % 6) * 1.6, 1, -0.8 + Math.floor(index / 6) * 1.4];
}

function logical(entity: ClusterEntity, index: number): Position {
  if (entity.kind === 'Namespace') return [entity.name === 'shop' ? 0 : 7, -0.6, 0];
  const namespaceX = entity.namespace === 'shop' ? 0 : entity.namespace ? 7 : -7;
  const column = rank(entity) % 4;
  return [namespaceX - 3 + column * 2, 0.6 + Math.floor(index / 4) * 1.2, -1.5 + (index % 3) * 1.5];
}

function placement(entity: ClusterEntity, index: number): Position {
  const nodeIndex =
    entity.kind === 'Node' ? ['worker-a', 'worker-b', 'worker-c'].indexOf(entity.name) : -1;
  if (nodeIndex >= 0) return [-6 + nodeIndex * 6, -0.5, 0];
  if (entity.nodeName) {
    const slot = ['worker-a', 'worker-b', 'worker-c'].indexOf(entity.nodeName);
    return [-6 + slot * 6 + ((index % 3) - 1) * 1.45, 0.8 + (index % 3) * 0.65, 0];
  }
  return [-5 + (index % 6) * 2, 3.4, -3.2];
}

function flow(entity: ClusterEntity, index: number, view: ViewMode): Position {
  const order =
    view === 'traffic'
      ? ['Browser', 'Pod', 'Service', 'EndpointSlice']
      : [
          'Developer',
          'KubeAPIServer',
          'Etcd',
          'ControllerManager',
          'Scheduler',
          'Kubelet',
          'ContainerRuntime',
          'Pod',
        ];
  const lane = order.indexOf(entity.kind);
  return [
    lane < 0 ? -5 + (index % 6) * 2 : -8 + lane * 2.3,
    lane < 0 ? -1.2 : 1.1,
    lane < 0 ? 2.8 : (index % 3) * 1.2 - 1.2,
  ];
}

export function calculateLayout(graph: ClusterGraph, projection: SceneProjection): LayoutResult {
  const visible = graph.snapshot.entities
    .filter((entity) => projection.entityStates[entity.id]?.visible)
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id));
  const positions = new Map<EntityId, Position>();
  visible.forEach((entity, index) => {
    const position =
      projection.view === 'overview'
        ? overview(entity, index)
        : projection.view === 'logical'
          ? logical(entity, index)
          : projection.view === 'placement'
            ? placement(entity, index)
            : flow(entity, index, projection.view);
    positions.set(entity.id, position);
  });
  return { positions };
}
