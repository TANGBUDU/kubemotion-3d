import { describe, expect, it } from 'vitest';
import type {
  EntityViewState,
  RelationViewState,
  ViewMode,
  ViewProjection,
} from '../../src/course/types';
import { calculateLayout } from '../../src/renderer/LayoutEngine';
import { sceneGrammarFor } from '../../src/renderer/scene-grammar';
import type {
  EntityId,
  LocalizedText,
  RelationId,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../src/world/types';

const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });

const entity = (
  id: EntityId,
  kind: string,
  name: string,
  data: Readonly<Record<string, unknown>>,
): WorldEntity => ({
  id,
  category:
    kind === 'Container'
      ? 'runtime-status'
      : kind === 'Node'
        ? 'infrastructure'
        : kind === 'Kubectl'
          ? 'external'
          : kind === 'Kubelet' ||
              kind === 'KubeAPIServer' ||
              kind === 'ControllerManager' ||
              kind === 'Scheduler'
            ? 'runtime-component'
            : 'api-object',
  kind,
  name,
  status: kind === 'Pod' ? 'running' : 'healthy',
  data,
  title: text(name),
  summary: text(name),
  sourceIds: ['source'],
  visual: {
    archetype:
      kind === 'Node'
        ? 'node'
        : kind === 'Pod'
          ? 'pod'
          : kind === 'Container'
            ? 'container'
            : kind === 'ReplicaSet'
              ? 'replicaset'
              : kind === 'Kubelet'
                ? 'runtime'
                : kind === 'Kubectl'
                  ? 'external'
                  : 'control-plane',
  },
});

const relation = (
  id: RelationId,
  type: WorldRelation['type'],
  semantic: WorldRelation['semantic'],
  from: EntityId,
  to: EntityId,
): WorldRelation => ({
  id,
  type,
  semantic,
  from,
  to,
  directed: true,
  title: text(id),
  sourceIds: ['source'],
});

const nodeMoon = entity('node:moon', 'Node', 'moon-node', {});
const nodeSun = entity('node:sun', 'Node', 'sun-node', {});
const podMoon = entity('pod:moon-api', 'Pod', 'api-moon', {
  uid: 'uid-moon',
  nodeName: 'moon-node',
  phase: 'Running',
  restartPolicy: 'Always',
  conditions: { podScheduled: true, initialized: true, containersReady: true, ready: true },
});
const podSun = entity('pod:sun-api', 'Pod', 'api-sun', {
  uid: 'uid-sun',
  nodeName: 'sun-node',
  phase: 'Running',
  restartPolicy: 'Always',
  conditions: { podScheduled: true, initialized: true, containersReady: true, ready: true },
});
const podPending = {
  ...entity('pod:pending', 'Pod', 'api-pending', {
    uid: 'uid-pending',
    phase: 'Pending',
    restartPolicy: 'Always',
    conditions: { podScheduled: false, initialized: true, containersReady: false, ready: false },
  }),
  status: 'pending' as const,
};
const containerMoon = entity('container:moon', 'Container', 'api', {
  podId: podMoon.id,
  name: 'api',
  image: 'example/api:v1',
  containerID: 'containerd://moon-api-01',
  restartCount: 0,
  ready: true,
  started: true,
  state: { kind: 'running', startedAt: '2026-08-08T00:00:00Z' },
});
const replicaSet = entity('rs:api', 'ReplicaSet', 'api-rs', {
  specReplicas: 3,
  statusReplicas: 3,
  readyReplicas: 2,
});
const controller = entity('component:controller', 'ControllerManager', 'controller-manager', {});
const scheduler = entity('component:scheduler', 'Scheduler', 'scheduler', {});
const apiServer = entity('component:api-server', 'KubeAPIServer', 'kube-apiserver', {});
const kubectl = entity('external:kubectl', 'Kubectl', 'kubectl', {});
const kubeletMoon = entity('component:kubelet-moon', 'Kubelet', 'kubelet-moon', {
  nodeName: 'moon-node',
});

const entities = [
  nodeMoon,
  nodeSun,
  podMoon,
  podSun,
  podPending,
  containerMoon,
  replicaSet,
  apiServer,
  controller,
  scheduler,
  kubectl,
  kubeletMoon,
];
const relations = [
  relation('scheduled:moon', 'scheduled-on', 'placement', podMoon.id, nodeMoon.id),
  relation('contains:moon', 'contains-runtime', 'composition', podMoon.id, containerMoon.id),
  relation('owns:moon', 'owns', 'ownership', replicaSet.id, podMoon.id),
];

const world: WorldSnapshot = {
  schemaVersion: 2,
  scenarioId: 'layout-test',
  revision: 1,
  entities: Object.fromEntries(entities.map((item) => [item.id, item])),
  relations: Object.fromEntries(relations.map((item) => [item.id, item])),
};

const projection = (snapshot: WorldSnapshot, view: ViewMode = 'placement'): ViewProjection => {
  const entityStates: Record<EntityId, EntityViewState> = {};
  for (const item of Object.values(snapshot.entities)) {
    entityStates[item.id] = { visible: true, emphasis: 'normal', labelMode: 'short' };
  }
  const relationStates: Record<RelationId, RelationViewState> = {};
  for (const item of Object.values(snapshot.relations)) {
    relationStates[item.id] = { visible: true, emphasis: 'normal' };
  }
  return {
    view,
    cameraPresetId: view,
    entityStates,
    relationStates,
    callouts: [],
    activeRoutes: [],
  };
};

describe('PlacementLayout', () => {
  it('is deterministic and derives racks from arbitrary Node names', () => {
    const view = projection(world);
    const first = calculateLayout({ world, view });
    const second = calculateLayout({ world, view });
    expect(second).toEqual(first);
    expect(first.containers.filter((container) => container.kind === 'node-rack')).toHaveLength(2);
    expect(first.containers.map((container) => container.label)).toContain('moon-node');
    expect(first.containers.map((container) => container.label)).toContain('sun-node');
  });

  it('places Pods inside their Node bounds and leaves stable visible slots', () => {
    const layout = calculateLayout({ world, view: projection(world) });
    for (const pod of [podMoon, podSun]) {
      const podLayout = layout.entities.get(pod.id);
      expect(podLayout?.lane).toBe('pod-slot');
      const rack = layout.containers.find((container) => container.id === podLayout?.containerId);
      expect(rack).toBeDefined();
      if (!podLayout || !rack) continue;
      expect(Math.abs(podLayout.position[0] - rack.bounds.center[0])).toBeLessThan(
        rack.bounds.size[0] / 2,
      );
      expect(Math.abs(podLayout.position[2] - rack.bounds.center[2])).toBeLessThan(
        rack.bounds.size[2] / 2,
      );
      expect(rack.slots.length).toBeGreaterThanOrEqual(4);
      expect(rack.slots.some((slot) => slot.occupiedBy === pod.id)).toBe(true);
    }
  });

  it('uses dedicated pending and control lanes and attaches kubelet to its Node', () => {
    const layout = calculateLayout({ world, view: projection(world) });
    expect(layout.entities.get(podPending.id)?.lane).toBe('pending');
    expect(layout.entities.get(podPending.id)?.parentId).toBeUndefined();
    expect(layout.containers.find((container) => container.kind === 'pending-lane')?.label).toBe(
      'UNSCHEDULED PODS',
    );
    expect(layout.entities.get(replicaSet.id)?.lane).toBe('workload-state');
    expect(layout.entities.get(apiServer.id)?.lane).toBe('control');
    expect(layout.entities.get(controller.id)?.lane).toBe('control');
    expect(layout.entities.get(scheduler.id)?.lane).toBe('control');
    expect(layout.entities.get(kubectl.id)?.containerId).toBe('external-control-input');
    expect(layout.containers.some((container) => container.kind === 'control-lane')).toBe(true);
    expect(layout.containers.some((container) => container.kind === 'workload-lane')).toBe(true);
    expect(layout.containers.some((container) => container.kind === 'worker-lane')).toBe(true);
    expect(layout.entities.get(kubeletMoon.id)?.parentId).toBe(nodeMoon.id);
    expect(layout.entities.get(kubeletMoon.id)?.lane).toBe('node-agent');
  });

  it('orders semantic zones and keeps an empty unscheduled tray visible', () => {
    const view = projection(world);
    const layout = calculateLayout({ world, view });
    const control = layout.containers.find((container) => container.kind === 'control-lane');
    const workload = layout.containers.find((container) => container.kind === 'workload-lane');
    const workers = layout.containers.find((container) => container.kind === 'worker-lane');
    expect(control?.bounds.center[2]).toBeLessThan(
      workload?.bounds.center[2] ?? Number.NEGATIVE_INFINITY,
    );
    expect(workload?.bounds.center[2]).toBeLessThan(
      workers?.bounds.center[2] ?? Number.NEGATIVE_INFINITY,
    );

    const hiddenPending: ViewProjection = {
      ...view,
      entityStates: {
        ...view.entityStates,
        [podPending.id]: { visible: false, emphasis: 'hidden', labelMode: 'none' },
      },
    };
    const withoutPending = calculateLayout({ world, view: hiddenPending });
    const tray = withoutPending.containers.find((container) => container.kind === 'pending-lane');
    expect(tray?.label).toBe('UNSCHEDULED PODS');
    expect(tray?.slots).toHaveLength(3);
    expect(tray?.slots.every((slot) => slot.occupiedBy === undefined)).toBe(true);
  });

  it('keeps every view deterministic without treating Placement geometry as the contract', () => {
    const viewModes: readonly ViewMode[] = [
      'overview',
      'logical',
      'placement',
      'control-flow',
      'traffic',
      'storage',
    ];
    const strategies = new Set<string>();
    for (const viewMode of viewModes) {
      const view = projection(world, viewMode);
      expect(calculateLayout({ world, view })).toEqual(calculateLayout({ world, view }));
      strategies.add(sceneGrammarFor(viewMode).layoutAlgorithm);
    }
    expect(strategies.size).toBe(viewModes.length);
  });

  it('keeps slots stable across status/data-only updates and composes Containers in Pods', () => {
    const view = projection(world);
    const before = calculateLayout({ world, view });
    const changedPod: WorldEntity = {
      ...podMoon,
      status: 'failed',
      data: { ...podMoon.data, phase: 'Failed' },
    };
    const changedWorld: WorldSnapshot = {
      ...world,
      revision: 2,
      entities: { ...world.entities, [changedPod.id]: changedPod },
    };
    const after = calculateLayout({
      world: changedWorld,
      view: projection(changedWorld),
      previous: before,
    });
    expect(after.entities.get(changedPod.id)?.position).toEqual(
      before.entities.get(podMoon.id)?.position,
    );
    expect(after.entities.get(changedPod.id)?.slotIndex).toBe(
      before.entities.get(podMoon.id)?.slotIndex,
    );
    expect(after.entities.get(containerMoon.id)).toMatchObject({
      lane: 'composition',
      parentId: podMoon.id,
    });
  });

  it('creates semantic routes only when both visible endpoints exist', () => {
    const layout = calculateLayout({ world, view: projection(world) });
    expect(layout.routes.get('scheduled:moon')?.curve).toBe('orthogonal');
    expect(layout.routes.get('owns:moon')?.curve).toBe('arc');
    expect(layout.routes.get('contains:moon')?.curve).toBe('straight');
    expect(layout.routes.get('scheduled:moon')?.points).toHaveLength(2);
  });
});
