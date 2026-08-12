import { describe, expect, it } from 'vitest';
import type { EntityViewState, RelationViewState, ViewProjection } from '../../src/course/types';
import { calculateLayout, type LayoutContainer } from '../../src/renderer/LayoutEngine';
import { dimensions } from '../../src/renderer/design/dimensions';
import type {
  EntityId,
  RelationId,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../src/world/types';

const text = (value: string) => ({ en: value, ja: value, 'zh-CN': value });

const entity = (
  id: string,
  kind: string,
  name: string,
  data: Readonly<Record<string, unknown>> = {},
): WorldEntity => ({
  id,
  category:
    kind === 'Cluster' || kind === 'Node'
      ? 'infrastructure'
      : kind === 'Pod'
        ? 'api-object'
        : 'runtime-component',
  kind,
  name,
  ...(kind === 'Pod' ? { namespace: 'shop' } : {}),
  status: kind === 'Pod' && data.nodeName === undefined ? 'pending' : 'ready',
  data,
  title: text(name),
  summary: text(name),
  sourceIds: ['k8s-components'],
  visual: {
    archetype:
      kind === 'Cluster'
        ? 'cluster'
        : kind === 'Node'
          ? 'node'
          : kind === 'Pod'
            ? 'pod'
            : 'control-plane',
  },
});

const node = (name: string, rackOrder: number) =>
  entity(`infrastructure:cluster:global:Node:${name}`, 'Node', name, {
    rackOrder,
    podSlotCount: 4,
  });

const pod = (name: string, nodeName?: string) =>
  entity(`api-object:namespaced:shop:Pod:${name}`, 'Pod', name, {
    uid: `synthetic-${name}`,
    ...(nodeName ? { nodeName } : {}),
    phase: nodeName ? 'Running' : 'Pending',
    restartPolicy: 'Always',
    conditions: {
      podScheduled: nodeName !== undefined,
      initialized: nodeName !== undefined,
      containersReady: nodeName !== undefined,
      ready: nodeName !== undefined,
    },
  });

const scheduledOn = (child: WorldEntity, parent: WorldEntity): WorldRelation => ({
  id: `scheduled:${child.name}:${parent.name}`,
  type: 'scheduled-on',
  from: child.id,
  to: parent.id,
  directed: true,
  semantic: 'placement',
  title: text(`${child.name} scheduled on ${parent.name}`),
  sourceIds: ['k8s-scheduling'],
});

const workerA = node('worker-a', 1);
const workerB = node('worker-b', 2);
const workerC = node('worker-c', 3);
const podA = pod('api-a', 'worker-a');
const podB = pod('api-b', 'worker-b');
const podC = pod('api-c', 'worker-c');
const pending = pod('api-pending');
const kubeletA = entity('runtime-component:node:worker-a:Kubelet:kubelet', 'Kubelet', 'kubelet', {
  nodeName: 'worker-a',
});
const runtimeA = entity(
  'runtime-component:node:worker-a:ContainerRuntime:runtime',
  'ContainerRuntime',
  'container-runtime',
  { nodeName: 'worker-a' },
);

const entities = [
  entity('infrastructure:cluster:global:Cluster:demo-shop', 'Cluster', 'demo-shop'),
  entity(
    'runtime-component:cluster:global:KubeAPIServer:kube-apiserver',
    'KubeAPIServer',
    'kube-apiserver',
  ),
  entity('runtime-component:cluster:global:Etcd:etcd', 'Etcd', 'etcd'),
  entity('runtime-component:cluster:global:Scheduler:kube-scheduler', 'Scheduler', 'scheduler'),
  entity(
    'runtime-component:cluster:global:ControllerManager:kube-controller-manager',
    'ControllerManager',
    'controller manager',
  ),
  workerA,
  workerB,
  workerC,
  podA,
  podB,
  podC,
  pending,
  kubeletA,
  runtimeA,
];
const relations = [
  scheduledOn(podA, workerA),
  scheduledOn(podB, workerB),
  scheduledOn(podC, workerC),
];
const world: WorldSnapshot = {
  schemaVersion: 2,
  scenarioId: 'overview-foundation-test',
  revision: 1,
  entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  relations: Object.fromEntries(relations.map((item) => [item.id, item])),
};

const projection = (view: ViewProjection['view']): ViewProjection => ({
  view,
  cameraPresetId: view,
  entityStates: Object.fromEntries(
    entities.map((item) => [
      item.id,
      { visible: true, emphasis: 'normal', labelMode: 'short' } satisfies EntityViewState,
    ]),
  ) as Record<EntityId, EntityViewState>,
  relationStates: Object.fromEntries(
    relations.map((item) => [
      item.id,
      { visible: true, emphasis: 'normal' } satisfies RelationViewState,
    ]),
  ) as Record<RelationId, RelationViewState>,
  callouts: [],
  activeRoutes: [],
});

const overlaps = (left: LayoutContainer, right: LayoutContainer): boolean => {
  const [leftX, , leftZ] = left.bounds.center;
  const [leftWidth, , leftDepth] = left.bounds.size;
  const [rightX, , rightZ] = right.bounds.center;
  const [rightWidth, , rightDepth] = right.bounds.size;
  return (
    Math.abs(leftX - rightX) < (leftWidth + rightWidth) / 2 &&
    Math.abs(leftZ - rightZ) < (leftDepth + rightDepth) / 2
  );
};

describe('Overview foundation layout', () => {
  it('builds three non-overlapping semantic islands on a deterministic bounded stage', () => {
    const first = calculateLayout({ world, view: projection('overview') });
    const second = calculateLayout({ world, view: projection('overview') });
    expect(second).toEqual(first);

    const islands = ['control-plane-island', 'worker-nodes-island', 'unscheduled-transit-lane'].map(
      (id) => first.containers.find((container) => container.id === id),
    );
    expect(islands.every(Boolean)).toBe(true);
    const [control, workers, transit] = islands as [
      LayoutContainer,
      LayoutContainer,
      LayoutContainer,
    ];
    expect(overlaps(control, workers)).toBe(false);
    expect(overlaps(control, transit)).toBe(false);
    expect(overlaps(workers, transit)).toBe(false);
    for (const island of islands) {
      if (!island) continue;
      expect(Math.abs(island.bounds.center[0]) + island.bounds.size[0] / 2).toBeLessThanOrEqual(11);
      expect(Math.abs(island.bounds.center[2]) + island.bounds.size[2] / 2).toBeLessThanOrEqual(
        7.5,
      );
    }
  });

  it('places control-plane components, Nodes, scheduled Pods, and Pending Pods in their own zones', () => {
    const layout = calculateLayout({ world, view: projection('overview') });
    const controlKinds = ['KubeAPIServer', 'Etcd', 'Scheduler', 'ControllerManager'];
    for (const item of entities.filter((candidate) => controlKinds.includes(candidate.kind))) {
      expect(layout.entities.get(item.id)?.containerId).toBe('control-plane-island');
    }
    for (const item of [workerA, workerB, workerC]) {
      expect(layout.entities.get(item.id)?.containerId).toBe(`node:${item.id}`);
    }
    for (const item of [podA, podB, podC]) {
      const placed = layout.entities.get(item.id);
      expect(placed?.lane).toBe('pod-slot');
      expect(placed?.parentId).toBe(
        [workerA, workerB, workerC].find((candidate) => candidate.name === item.data.nodeName)?.id,
      );
    }
    expect(layout.entities.get(pending.id)).toMatchObject({
      lane: 'pending',
      containerId: 'unscheduled-transit-lane',
    });
    expect(layout.entities.get(pending.id)?.parentId).toBeUndefined();

    const workerPosition = layout.entities.get(workerA.id)?.position;
    expect(workerPosition).toBeDefined();
    if (!workerPosition) return;
    expect(layout.entities.get(kubeletA.id)).toMatchObject({
      lane: 'node-agent',
      parentId: workerA.id,
      containerId: `node:${workerA.id}`,
      position: [
        workerPosition[0] + dimensions.node.kubeletMountOffset[0],
        dimensions.node.kubeletMountOffset[1],
        workerPosition[2] + dimensions.node.kubeletMountOffset[2],
      ],
    });
    expect(layout.entities.get(runtimeA.id)).toMatchObject({
      lane: 'node-agent',
      parentId: workerA.id,
      containerId: `node:${workerA.id}`,
      position: [
        workerPosition[0] + dimensions.node.runtimeMountOffset[0],
        dimensions.node.runtimeMountOffset[1],
        workerPosition[2] + dimensions.node.runtimeMountOffset[2],
      ],
    });
  });

  it('does not reuse Placement geometry for Overview', () => {
    const overview = calculateLayout({ world, view: projection('overview') });
    const placement = calculateLayout({ world, view: projection('placement') });
    expect(overview.entities.get(workerA.id)?.position).not.toEqual(
      placement.entities.get(workerA.id)?.position,
    );
    expect(overview.containers.map((container) => container.id)).toContain('control-plane-island');
  });

  it('projects Control Flow onto its own three non-overlapping semantic islands', () => {
    const layout = calculateLayout({ world, view: projection('control-flow') });
    const islands = layout.containers.filter((container) => container.kind !== 'node-rack');
    expect(islands.map((container) => container.id)).toEqual([
      'control-flow-control-plane',
      'control-flow-worker-zone',
      'control-flow-transit',
    ]);
    for (let leftIndex = 0; leftIndex < islands.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < islands.length; rightIndex += 1) {
        const left = islands[leftIndex];
        const right = islands[rightIndex];
        if (!left || !right) continue;
        expect(overlaps(left, right)).toBe(false);
      }
    }
  });
});
