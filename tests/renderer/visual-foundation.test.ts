import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState, RelationViewState, ViewProjection } from '../../src/course/types';
import { calculateLayout } from '../../src/renderer/LayoutEngine';
import { getRelationStyle, RelationRegistry } from '../../src/renderer/RelationRegistry';
import { SceneRegistry } from '../../src/renderer/SceneRegistry';
import { SceneStage } from '../../src/renderer/scene/SceneStage';
import {
  UnsupportedVisualError,
  VisualFactoryRegistry,
} from '../../src/renderer/VisualFactoryRegistry';
import {
  ApiServerVisualHandle,
  ClusterFoundationVisualHandle,
  ContainerVisualHandle,
  ControllerManagerVisualHandle,
  EtcdVisualHandle,
  GenericVisualHandle,
  KubeletVisualHandle,
  KubectlVisualHandle,
  NodeVisualHandle,
  PodVisualHandle,
  ReplicaSetVisualHandle,
  SchedulerVisualHandle,
} from '../../src/renderer/VisualHandles';
import type {
  EntityId,
  LocalizedText,
  RelationId,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../src/world/types';

const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });
const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };

const makeEntity = (
  id: EntityId,
  kind: string,
  data: Readonly<Record<string, unknown>>,
): WorldEntity => ({
  id,
  category:
    kind === 'Container'
      ? 'runtime-status'
      : kind === 'Node' || kind === 'Cluster'
        ? 'infrastructure'
        : kind === 'Kubectl'
          ? 'external'
          : kind === 'Kubelet' ||
              kind === 'KubeAPIServer' ||
              kind === 'Etcd' ||
              kind === 'ControllerManager' ||
              kind === 'Scheduler'
            ? 'runtime-component'
            : 'api-object',
  kind,
  name: id.split(':').at(-1) ?? id,
  ...(kind === 'Pod' || kind === 'Container' || kind === 'ReplicaSet' ? { namespace: 'shop' } : {}),
  status: kind === 'Container' || kind === 'Pod' ? 'running' : 'healthy',
  data,
  title: text(id),
  summary: text(id),
  sourceIds: ['source'],
  visual: {
    archetype:
      kind === 'Cluster'
        ? 'cluster'
        : kind === 'Node'
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

const node = makeEntity('node:atlas', 'Node', {});
const cluster = makeEntity('cluster:demo-shop', 'Cluster', {
  boundaryRole: 'synthetic-teaching-cluster',
});
const pod = makeEntity('pod:api-old', 'Pod', {
  uid: 'uid-old',
  nodeName: node.name,
  phase: 'Running',
  restartPolicy: 'Always',
  conditions: { podScheduled: true, initialized: true, containersReady: true, ready: true },
});
const container = makeEntity('container:api-old', 'Container', {
  podId: pod.id,
  name: 'api',
  image: 'example/api:v1',
  containerID: 'containerd://visual-api-old-01',
  restartCount: 0,
  ready: true,
  started: true,
  state: { kind: 'running', startedAt: '2026-08-08T00:00:00Z' },
});
const replicaSet = makeEntity('rs:api', 'ReplicaSet', {
  specReplicas: 3,
  statusReplicas: 3,
  readyReplicas: 3,
});
const kubelet = makeEntity('component:kubelet', 'Kubelet', { nodeName: node.name });
const controller = makeEntity('component:controller', 'ControllerManager', {});
const scheduler = makeEntity('component:scheduler', 'Scheduler', {});
const apiServer = makeEntity('component:api-server', 'KubeAPIServer', {});
const etcd = makeEntity('component:etcd', 'Etcd', {
  role: 'kubernetes-api-data-store',
  basicModelClient: 'kube-apiserver',
});
const kubectl = makeEntity('external:kubectl', 'Kubectl', { role: 'operator-trigger' });

const makeRelation = (
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

const contains = makeRelation(
  'contains:api',
  'contains-runtime',
  'composition',
  pod.id,
  container.id,
);
const scheduled = makeRelation('scheduled:api', 'scheduled-on', 'placement', pod.id, node.id);
const owns = makeRelation('owns:api', 'owns', 'ownership', replicaSet.id, pod.id);

const snapshot = (
  entityValues: readonly WorldEntity[] = [
    node,
    pod,
    container,
    replicaSet,
    kubelet,
    apiServer,
    controller,
    scheduler,
    kubectl,
  ],
  relationValues: readonly WorldRelation[] = [contains, scheduled, owns],
  revision = 1,
): WorldSnapshot => ({
  schemaVersion: 2,
  scenarioId: 'visual-foundation-test',
  revision,
  entities: Object.fromEntries(entityValues.map((item) => [item.id, item])),
  relations: Object.fromEntries(relationValues.map((item) => [item.id, item])),
});

const viewFor = (world: WorldSnapshot): ViewProjection => {
  const entityStates: Record<EntityId, EntityViewState> = {};
  for (const item of Object.values(world.entities)) entityStates[item.id] = normal;
  const relationStates: Record<RelationId, RelationViewState> = {};
  for (const item of Object.values(world.relations)) {
    relationStates[item.id] = { visible: true, emphasis: 'normal' };
  }
  return {
    view: 'placement',
    cameraPresetId: 'placement',
    entityStates,
    relationStates,
    callouts: [],
    activeRoutes: [],
  };
};

describe('visual factory foundation', () => {
  it('keeps normal surfaces neutral while focused entities receive status emissive emphasis', () => {
    const registry = new VisualFactoryRegistry();
    const normalHandle = registry.create(
      makeEntity('infrastructure:cluster:global:Node:normal', 'Node', {}),
      normal,
      { allowGeneric: false },
    );
    const focusedHandle = registry.create(
      makeEntity('infrastructure:cluster:global:Node:focused', 'Node', {}),
      { ...normal, emphasis: 'focused' },
      { allowGeneric: false },
    );
    const intensities = (root: THREE.Object3D): number[] => {
      const result: number[] = [];
      root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (material instanceof THREE.MeshStandardMaterial) {
            result.push(material.emissiveIntensity);
          }
        }
      });
      return result;
    };

    expect(intensities(normalHandle.root).every((value) => value === 0)).toBe(true);
    expect(intensities(focusedHandle.root).some((value) => value >= 0.32)).toBe(true);
    expect(intensities(focusedHandle.root).every((value) => value <= 0.45)).toBe(true);
    focusedHandle.update(focusedHandle.entity, normal);
    expect(intensities(focusedHandle.root).every((value) => value === 0)).toBe(true);
    normalHandle.dispose();
    focusedHandle.dispose();
  });

  it('uses a specialized visual for every golden-lesson kind', () => {
    const registry = new VisualFactoryRegistry();
    const expectations: readonly (readonly [WorldEntity, object])[] = [
      [cluster, ClusterFoundationVisualHandle.prototype],
      [node, NodeVisualHandle.prototype],
      [pod, PodVisualHandle.prototype],
      [container, ContainerVisualHandle.prototype],
      [replicaSet, ReplicaSetVisualHandle.prototype],
      [kubelet, KubeletVisualHandle.prototype],
      [apiServer, ApiServerVisualHandle.prototype],
      [etcd, EtcdVisualHandle.prototype],
      [controller, ControllerManagerVisualHandle.prototype],
      [scheduler, SchedulerVisualHandle.prototype],
      [kubectl, KubectlVisualHandle.prototype],
    ];
    for (const [item, prototype] of expectations) {
      const handle = registry.create(item, normal, { allowGeneric: false });
      expect(Object.prototype.isPrototypeOf.call(prototype, handle)).toBe(true);
      expect(handle.root.userData.genericVisual).not.toBe(true);
      handle.dispose();
    }
  });

  it('uses a compact boundary marker for Cluster and replicated storage cells for etcd', () => {
    const registry = new VisualFactoryRegistry();
    const clusterHandle = registry.create(cluster, normal, { allowGeneric: false });
    const etcdHandle = registry.create(etcd, normal, { allowGeneric: false });

    expect(clusterHandle).toBeInstanceOf(ClusterFoundationVisualHandle);
    expect(clusterHandle.root.userData).toMatchObject({
      visualKind: 'cluster-foundation-boundary',
      boundarySemantic: 'cluster',
      foundationOnly: true,
      hasFloorSlab: false,
    });
    const clusterRoles: string[] = [];
    clusterHandle.root.traverse((object) => {
      if (typeof object.userData.role === 'string') clusterRoles.push(object.userData.role);
    });
    expect(clusterRoles).toContain('cluster-foundation-plaque');
    expect(clusterRoles.filter((role) => role === 'cluster-boundary-rail')).toHaveLength(2);
    expect(clusterRoles).not.toContain('cluster-floor');
    const clusterSize = clusterHandle.getWorldBounds?.().getSize(new THREE.Vector3());
    expect(clusterSize?.y).toBeLessThan(1);
    expect(clusterSize?.z).toBeLessThan(1);

    expect(etcdHandle).toBeInstanceOf(EtcdVisualHandle);
    expect(etcdHandle.root.userData).toMatchObject({
      visualKind: 'etcd-storage-cells',
      storageCellCount: 3,
      apiAccess: 'api-server-only-basic-model',
    });
    const etcdRoles: string[] = [];
    etcdHandle.root.traverse((object) => {
      if (typeof object.userData.role === 'string') etcdRoles.push(object.userData.role);
      if (object instanceof THREE.Mesh) {
        expect(object.geometry).not.toBeInstanceOf(THREE.TorusKnotGeometry);
        expect(object.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
      }
    });
    expect(etcdRoles.filter((role) => role === 'etcd-storage-column')).toHaveLength(3);
    expect(etcdRoles.filter((role) => role === 'etcd-storage-cell')).toHaveLength(9);
    expect(etcdRoles).toContain('etcd-api-server-port');
    expect(etcdRoles).not.toContain('api-server-gateway');

    clusterHandle.dispose();
    etcdHandle.dispose();
  });

  it('uses distinct control-plane silhouettes without canvas badges or placeholder solids', () => {
    const registry = new VisualFactoryRegistry();
    const handles = [apiServer, controller, scheduler, kubectl].map((entity) =>
      registry.create(entity, normal, { allowGeneric: false }),
    );
    const roles = handles.map((handle) => {
      const result: string[] = [];
      handle.root.traverse((object) => {
        if (typeof object.userData.role === 'string') result.push(object.userData.role);
        if (object instanceof THREE.Mesh) {
          expect(object.geometry).not.toBeInstanceOf(THREE.TorusKnotGeometry);
          expect(object.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
        }
      });
      return result;
    });
    expect(roles[0]?.filter((role) => role === 'api-control-port')).toHaveLength(5);
    expect(roles[1]?.filter((role) => role === 'reconcile-loop')).toHaveLength(2);
    expect(roles[2]?.filter((role) => role === 'scheduler-node-output')).toHaveLength(3);
    expect(roles[3]).toContain('kubectl-delete-trigger');
    expect(roles.flat()).not.toContain('text-badge');
    for (const handle of handles) handle.dispose();
  });

  it('updates ReplicaSet counters in place and exposes a non-color-only deficit state', () => {
    const handle = new ReplicaSetVisualHandle(replicaSet, normal);
    const segmentUuids: string[] = [];
    handle.root.traverse((object) => {
      if (object.userData.role === 'counter-segment') segmentUuids.push(object.uuid);
    });
    const deficitReplicaSet: WorldEntity = {
      ...replicaSet,
      data: { specReplicas: 3, statusReplicas: 2, readyReplicas: 2 },
    };
    handle.update(deficitReplicaSet, normal);
    const updatedSegmentUuids: string[] = [];
    let deficitVisible = false;
    handle.root.traverse((object) => {
      if (object.userData.role === 'counter-segment') updatedSegmentUuids.push(object.uuid);
      if (object.userData.role === 'replicaset-deficit') deficitVisible = object.visible;
    });
    expect(updatedSegmentUuids).toEqual(segmentUuids);
    expect(handle.root.userData.counters).toEqual({ spec: 3, observed: 2, ready: 2 });
    expect(handle.root.userData.hasDeficit).toBe(true);
    expect(deficitVisible).toBe(true);
    expect(handle.setCounterAnimation('data.statusReplicas', 3)).toBe(true);
    expect(handle.root.userData.counters).toEqual({ spec: 3, observed: 3, ready: 2 });
    expect(handle.setCounterAnimation('data.statusReplicas')).toBe(true);
    expect(handle.root.userData.counters).toEqual({ spec: 3, observed: 2, ready: 2 });
    expect(handle.setCounterAnimation('data.unknownCounter', 9)).toBe(false);
    handle.dispose();
  });

  it('keeps a Running-but-NotReady Pod shell intact and exposes a NOT READY rail state', () => {
    const handle = new PodVisualHandle(pod, normal);
    const shellUuid = handle.shell.uuid;
    const notReady: WorldEntity = {
      ...pod,
      status: 'not-ready',
      data: {
        ...pod.data,
        conditions: {
          podScheduled: true,
          initialized: true,
          containersReady: false,
          ready: false,
        },
      },
    };

    handle.update(notReady, normal);
    let runningMarkerVisible = true;
    let notReadyMarkerVisible = false;
    handle.root.traverse((object) => {
      if (object.userData.role === 'pod-running-marker') runningMarkerVisible = object.visible;
      if (object.userData.role === 'pod-pending-marker') notReadyMarkerVisible = object.visible;
    });

    expect(handle.shell.uuid).toBe(shellUuid);
    expect(handle.root.userData.phase).toBe('Running');
    expect(handle.root.userData.statusText).toBe('NOT READY');
    expect(handle.root.userData.visibleText).toContain('RUNNING · NOT READY');
    expect(runningMarkerVisible).toBe(false);
    expect(notReadyMarkerVisible).toBe(true);
    handle.dispose();
  });

  it('marks fallback visuals and can reject them for a golden scene', () => {
    const registry = new VisualFactoryRegistry();
    const unknown = makeEntity('api:custom', 'UnsupportedKind', {});
    const fallback = registry.create(unknown, normal);
    expect(fallback).toBeInstanceOf(GenericVisualHandle);
    expect(fallback.root.userData.genericVisual).toBe(true);
    fallback.dispose();
    expect(() => registry.create(unknown, normal, { allowGeneric: false })).toThrow(
      UnsupportedVisualError,
    );
  });

  it('composes and updates a Container inside an unchanged Pod shell', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene, new VisualFactoryRegistry(), { allowGeneric: false });
    const world = snapshot();
    const view = viewFor(world);
    registry.sync(world, view);
    const podHandle = registry.get(pod.id);
    const containerHandle = registry.get(container.id);
    expect(podHandle).toBeInstanceOf(PodVisualHandle);
    expect(containerHandle).toBeInstanceOf(ContainerVisualHandle);
    if (
      !(podHandle instanceof PodVisualHandle) ||
      !(containerHandle instanceof ContainerVisualHandle)
    ) {
      return;
    }
    const shellUuid = podHandle.shell.uuid;
    const containerUuid = containerHandle.root.uuid;
    expect(containerHandle.root.parent).toBe(podHandle.containerBay);
    expect(podHandle.hasContainer(container.id)).toBe(true);

    const restarted: WorldEntity = {
      ...container,
      data: {
        ...container.data,
        containerID: 'containerd://visual-api-old-02',
        restartCount: 1,
        state: { kind: 'running', startedAt: '2026-08-08T00:00:12Z' },
        lastState: {
          kind: 'terminated',
          reason: 'Error',
          exitCode: 1,
          finishedAt: '2026-08-08T00:00:10Z',
          containerID: 'containerd://visual-api-old-01',
        },
      },
    };
    const after = snapshot(
      [node, pod, restarted, replicaSet, kubelet, apiServer, controller, scheduler, kubectl],
      [contains, scheduled, owns],
      2,
    );
    registry.sync(after, viewFor(after));
    expect(registry.get(pod.id)).toBe(podHandle);
    expect(registry.get(container.id)).toBe(containerHandle);
    expect(podHandle.shell.uuid).toBe(shellUuid);
    expect(containerHandle.root.uuid).toBe(containerUuid);
    expect(podHandle.root.userData.restartCount).toBe(1);
    expect(containerHandle.root.userData.containerID).toBe('containerd://visual-api-old-02');
    registry.clear();
  });
});

describe('SceneRegistry lifecycle', () => {
  it('disposes owned resources before dropping a removed handle', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene);
    const handle = registry.ensure(node, normal);
    const mesh = handle.selectableObjects[0];
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    if (!(mesh instanceof THREE.Mesh)) return;
    let geometryDisposed = false;
    let materialDisposed = false;
    mesh.geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    material?.addEventListener('dispose', () => {
      materialDisposed = true;
    });
    registry.remove(node.id);
    expect(handle.isDisposed).toBe(true);
    expect(geometryDisposed).toBe(true);
    expect(materialDisposed).toBe(true);
    expect(registry.get(node.id)).toBeUndefined();
    expect(handle.root.parent).toBeNull();
  });

  it('exposes only visible, selectable, active-world raycast targets', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene);
    const handle = registry.ensure(node, normal);
    expect(registry.raycastTargets().length).toBeGreaterThan(0);
    handle.update(node, { ...normal, visible: false });
    expect(registry.raycastTargets()).toEqual([]);
    handle.update(node, normal);
    handle.root.userData.activeWorld = false;
    expect(registry.raycastTargets()).toEqual([]);
    registry.remove(node.id);
    expect(registry.raycastTargets()).toEqual([]);
  });

  it('owns and diffs pending/control layout guides without exposing them to raycasting', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene, new VisualFactoryRegistry(), { allowGeneric: false });
    const world = snapshot();
    const view = viewFor(world);
    registry.sync(world, view);
    registry.applyLayout(calculateLayout({ world, view }));
    expect(registry.guideCount).toBe(4);
    expect(registry.semanticIslandCount).toBe(4);
    const tray = scene.getObjectByName('layout-guide:pending-lane');
    expect(tray?.userData.role).toBe('unscheduled-pods-tray');
    expect(tray?.userData.empty).toBe(true);
    const labels = registry.layoutLabels();
    expect(labels.map((label) => label.id)).toEqual([
      'layout:control-plane-zone',
      'layout:workload-state-zone',
      'layout:pending-lane',
      'layout:worker-nodes-zone',
    ]);
    expect(labels.find((label) => label.kind === 'tray-title')).toMatchObject({
      text: 'UNSCHEDULED PODS',
      zoneId: 'workload-state',
      kind: 'tray-title',
    });
    expect(labels.filter((label) => label.kind === 'zone-title')).toHaveLength(3);
    expect(labels.every((label) => label.worldPosition.every(Number.isFinite))).toBe(true);
    expect(registry.raycastTargets().every((item) => item.userData.role !== 'layout-guide')).toBe(
      true,
    );
    registry.clear();
    expect(registry.guideCount).toBe(0);
    expect(registry.semanticIslandCount).toBe(0);
    expect(registry.layoutLabels()).toEqual([]);
  });

  it('mounts the Kubelet entity into the owning Node instead of leaving it at scene root', () => {
    const scene = new THREE.Scene();
    const registry = new SceneRegistry(scene, new VisualFactoryRegistry(), { allowGeneric: false });
    const world = snapshot();
    const view = viewFor(world);
    registry.sync(world, view);
    const layout = calculateLayout({ world, view });
    registry.applyLayout(layout);
    const nodeHandle = registry.get(node.id);
    const kubeletHandle = registry.get(kubelet.id);
    expect(nodeHandle).toBeInstanceOf(NodeVisualHandle);
    expect(kubeletHandle).toBeInstanceOf(KubeletVisualHandle);
    if (
      !(nodeHandle instanceof NodeVisualHandle) ||
      !(kubeletHandle instanceof KubeletVisualHandle)
    ) {
      return;
    }
    expect(kubeletHandle.root.parent).toBe(nodeHandle.kubeletMount);
    expect(nodeHandle.hasKubelet(kubelet.id)).toBe(true);
    const worldPosition = kubeletHandle.root.getWorldPosition(new THREE.Vector3());
    expect(worldPosition.toArray()).toEqual(layout.entities.get(kubelet.id)?.position);
    registry.clear();
  });
});

describe('lesson stage semantics', () => {
  it('owns one bounded foundation without duplicating view-specific islands or a dominant grid', () => {
    const parent = new THREE.Group();
    const stage = new SceneStage(parent);
    expect(stage.root.userData.foundation).toMatchObject({
      bounded: true,
      semanticIslandOwner: 'layout-registry',
    });
    expect(stage.diagnostics()).toEqual({
      foundationMeshes: 3,
      localAlignmentMarks: 14,
      dominantGridMarks: 0,
    });
    expect(stage.getFramingBounds().isEmpty()).toBe(false);
    expect(stage.root.children.some((child) => child.userData.role === 'semantic-island')).toBe(
      false,
    );
    expect(stage.labelAnchors.get('logical-layout-note')?.userData.domLabel.labelClass).toBe(
      'fixed-legend',
    );
    stage.dispose();
    expect(stage.labelAnchors.size).toBe(0);
  });
});

describe('RelationRegistry', () => {
  it('defines shape, dash, arrow and label differences beyond color', () => {
    const ownership = getRelationStyle('ownership');
    const placement = getRelationStyle('placement');
    const composition = getRelationStyle('composition');
    expect(ownership.curve).toBe('arc');
    expect(ownership.dashed).toBe(false);
    expect(placement.curve).toBe('orthogonal');
    expect(placement.dashed).toBe(true);
    expect(composition.dashSize).not.toBe(placement.dashSize);
    expect(ownership.arrowhead && placement.arrowhead && composition.arrowhead).toBe(true);
    expect(placement.labelMode).toBe('always');
  });

  it('diffs by RelationId, applies emphasis, updates endpoints, and disposes on removal', () => {
    const scene = new THREE.Scene();
    const entityRegistry = new SceneRegistry(scene, new VisualFactoryRegistry(), {
      allowGeneric: false,
    });
    const relationRegistry = new RelationRegistry(scene);
    const world = snapshot();
    const view = viewFor(world);
    entityRegistry.sync(world, view);
    const layout = calculateLayout({ world, view });
    entityRegistry.applyLayout(layout);
    const first = relationRegistry.sync(world, view, layout, entityRegistry);
    expect(first.added).toEqual([contains.id, owns.id, scheduled.id].sort());
    expect(relationRegistry.size).toBe(3);
    const placementHandle = relationRegistry.get(scheduled.id);
    expect(placementHandle?.style.curve).toBe('orthogonal');
    const originalHandle = placementHandle;

    const focusedView: ViewProjection = {
      ...view,
      relationStates: {
        ...view.relationStates,
        [scheduled.id]: { visible: true, emphasis: 'focused' },
      },
    };
    relationRegistry.sync(world, focusedView, layout, entityRegistry);
    expect(relationRegistry.get(scheduled.id)).toBe(originalHandle);
    expect(relationRegistry.get(scheduled.id)?.root.userData.emphasis).toBe('focused');

    const removedHandle = relationRegistry.get(contains.id);
    let geometryDisposed = false;
    removedHandle?.line.geometry.addEventListener('dispose', () => {
      geometryDisposed = true;
    });
    const hiddenView: ViewProjection = {
      ...focusedView,
      relationStates: {
        ...focusedView.relationStates,
        [contains.id]: { visible: false, emphasis: 'normal' },
      },
    };
    const hiddenLayout = calculateLayout({ world, view: hiddenView });
    const result = relationRegistry.sync(world, hiddenView, hiddenLayout, entityRegistry);
    expect(result.removed).toEqual([contains.id]);
    expect(geometryDisposed).toBe(true);
    expect(removedHandle?.isDisposed).toBe(true);
    expect(relationRegistry.get(contains.id)).toBeUndefined();
    relationRegistry.clear();
    entityRegistry.clear();
  });
});
