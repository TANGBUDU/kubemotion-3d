import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { EntityViewState, ViewProjection } from '../../src/course/types';
import {
  type EntityLayout,
  type LayoutResult,
  type Position,
} from '../../src/renderer/LayoutEngine';
import { SceneRegistry } from '../../src/renderer/SceneRegistry';
import { dimensions } from '../../src/renderer/design/dimensions';
import { VisualFactoryRegistry } from '../../src/renderer/VisualFactoryRegistry';
import {
  ContainerRuntimeVisualHandle,
  KubeletVisualHandle,
  NodeVisualHandle,
} from '../../src/renderer/VisualHandles';
import type {
  EntityId,
  LocalizedText,
  WorldEntity,
  WorldRelation,
  WorldSnapshot,
} from '../../src/world/types';

const text = (value: string): LocalizedText => ({ en: value, ja: value, 'zh-CN': value });
const normal: EntityViewState = { visible: true, emphasis: 'normal', labelMode: 'short' };

const makeEntity = (
  id: EntityId,
  kind: 'Node' | 'Kubelet' | 'ContainerRuntime',
  data: Readonly<Record<string, unknown>> = {},
): WorldEntity => ({
  id,
  category: kind === 'Node' ? 'infrastructure' : 'runtime-component',
  kind,
  name: id.split(':').at(-1) ?? id,
  status: 'healthy',
  data,
  title: text(id),
  summary: text(id),
  sourceIds: ['source'],
  visual: { archetype: kind === 'Node' ? 'node' : 'runtime', size: 'sm' },
});

const node = makeEntity('node:worker-a', 'Node', { rackOrder: 0 });
const kubelet = makeEntity('runtime:kubelet:worker-a', 'Kubelet', {
  nodeName: node.name,
  reconciling: true,
});
const runtime = makeEntity('runtime:containerd:worker-a', 'ContainerRuntime', {
  nodeName: node.name,
  runtimeName: 'containerd',
  executing: true,
});

const pod: WorldEntity = {
  id: 'pod:worker-a:api',
  category: 'api-object',
  kind: 'Pod',
  name: 'api-a',
  namespace: 'shop',
  status: 'ready',
  data: {
    uid: 'uid-api-a',
    nodeName: node.name,
    phase: 'Running',
    restartPolicy: 'Always',
    conditions: { podScheduled: true, initialized: true, containersReady: true, ready: true },
  },
  title: text('api-a'),
  summary: text('api-a'),
  sourceIds: ['source'],
  visual: { archetype: 'pod', size: 'md' },
};

const container: WorldEntity = {
  id: 'container:worker-a:api',
  category: 'runtime-status',
  kind: 'Container',
  name: 'api',
  namespace: 'shop',
  status: 'running',
  data: {
    podId: pod.id,
    name: 'api',
    image: 'example/api:v1',
    containerID: 'containerd://api-01',
    restartCount: 0,
    ready: true,
    started: true,
    state: { kind: 'running', startedAt: '2026-08-08T00:00:00Z' },
  },
  title: text('api Container'),
  summary: text('api Container'),
  sourceIds: ['source'],
  visual: { archetype: 'container', size: 'sm' },
};

const containsContainer: WorldRelation = {
  id: 'contains:api',
  type: 'contains-runtime',
  semantic: 'composition',
  from: pod.id,
  to: container.id,
  directed: true,
  title: text('contains'),
  sourceIds: ['source'],
};

const world = (
  entities: readonly WorldEntity[] = [node, kubelet, runtime],
  relations: readonly WorldRelation[] = [],
): WorldSnapshot => ({
  schemaVersion: 2,
  scenarioId: 'node-runtime-visual-test',
  revision: 1,
  entities: Object.fromEntries(entities.map((entity) => [entity.id, entity])),
  relations: Object.fromEntries(relations.map((relation) => [relation.id, relation])),
});

const viewFor = (snapshot: WorldSnapshot): ViewProjection => ({
  view: 'placement',
  cameraPresetId: 'placement',
  entityStates: Object.fromEntries(Object.keys(snapshot.entities).map((id) => [id, normal])),
  relationStates: {},
  callouts: [],
  activeRoutes: [],
});

const add = (left: Position, right: Position): Position => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2],
];

const layoutFor = (nodePosition: Position, moduleMode: 'mounted' | 'orphan'): LayoutResult => {
  const layouts = new Map<EntityId, EntityLayout>();
  layouts.set(node.id, { entityId: node.id, position: nodePosition, lane: 'node' });
  const moduleLayouts: readonly (readonly [WorldEntity, Position])[] =
    moduleMode === 'mounted'
      ? [
          [kubelet, add(nodePosition, dimensions.node.kubeletMountOffset)],
          [runtime, add(nodePosition, dimensions.node.runtimeMountOffset)],
        ]
      : [
          [kubelet, [7.2, 0.3, -1.4]],
          [runtime, [8.8, 0.3, -1.4]],
        ];
  for (const [entity, position] of moduleLayouts) {
    layouts.set(entity.id, {
      entityId: entity.id,
      position,
      lane: moduleMode === 'mounted' ? 'node-agent' : 'semantic',
      ...(moduleMode === 'mounted' ? { parentId: node.id } : {}),
    });
  }
  return {
    entities: layouts,
    containers: [],
    routes: new Map(),
    positions: new Map([...layouts].map(([id, item]) => [id, item.position])),
  };
};

const roles = (root: THREE.Object3D): string[] => {
  const result: string[] = [];
  root.traverse((object) => {
    if (typeof object.userData.role === 'string') result.push(object.userData.role);
  });
  return result;
};

const expectPosition = (actual: THREE.Vector3, expected: Position): void => {
  expect(actual.x).toBeCloseTo(expected[0], 6);
  expect(actual.y).toBeCloseTo(expected[1], 6);
  expect(actual.z).toBeCloseTo(expected[2], 6);
};

describe('Node runtime anatomy', () => {
  it('renders four dimension-backed Pod bays and two explicit system-module mounts', () => {
    const handle = new NodeVisualHandle(node, normal);
    const anatomyRoles = roles(handle.root);

    expect(handle.root.userData).toMatchObject({
      visualKind: 'node-chassis',
      nodeBayCount: 4,
      nodeBaySize: [dimensions.node.bayWidth, dimensions.node.bayDepth],
      podLandingY: dimensions.node.podLandingY,
      systemModuleMounts: {
        kubelet: dimensions.node.kubeletMountOffset,
        containerRuntime: dimensions.node.runtimeMountOffset,
      },
    });
    expect(handle.root.userData.nodeBayAnchors).toEqual(
      dimensions.node.bayAnchors.map(([x, z]) => [x, dimensions.node.podLandingY, z]),
    );
    expect(anatomyRoles.filter((role) => role === 'pod-bay')).toHaveLength(4);
    expect(anatomyRoles).toEqual(
      expect.arrayContaining([
        'node-name-plaque',
        'node-status-strip',
        'node-status-indicator',
        'node-resource-strip',
        'node-system-module-strip',
        'kubelet-bay',
        'kubelet-entity-mount',
        'container-runtime-bay',
        'container-runtime-entity-mount',
      ]),
    );
    expect(handle.kubeletMount.position.toArray()).toEqual([0, 0, 0]);
    expect(handle.runtimeMount.position.toArray()).toEqual([0, 0, 0]);
    expect(handle.embeddedKubelet.position.toArray()).toEqual(dimensions.node.kubeletMountOffset);
    expect(handle.embeddedRuntime.position.toArray()).toEqual(dimensions.node.runtimeMountOffset);
    handle.dispose();
  });

  it('uses a dedicated CRI/execution visual that cannot be confused with kubelet or fallback', () => {
    const factory = new VisualFactoryRegistry();
    expect(factory.resolve(runtime)?.id).toBe('container-runtime-cri-executor');
    const runtimeHandle = factory.create(runtime, normal, { allowGeneric: false });
    const kubeletHandle = factory.create(kubelet, normal, { allowGeneric: false });

    expect(runtimeHandle).toBeInstanceOf(ContainerRuntimeVisualHandle);
    expect(kubeletHandle).toBeInstanceOf(KubeletVisualHandle);
    expect(runtimeHandle.root.userData).toMatchObject({
      visualKind: 'container-runtime-cri-executor',
      runtimeInterface: 'CRI',
      executesContainers: true,
      runtimeName: 'containerd',
    });
    expect(runtimeHandle.root.userData.genericVisual).not.toBe(true);
    const runtimeRoles = roles(runtimeHandle.root);
    const kubeletRoles = roles(kubeletHandle.root);
    expect(runtimeRoles).toEqual(
      expect.arrayContaining([
        'container-runtime-module',
        'container-runtime-cri-port',
        'container-runtime-execution-deck',
        'container-runtime-execution-pool',
        'container-runtime-status',
      ]),
    );
    expect(runtimeRoles.filter((role) => role === 'container-runtime-execution-cell')).toHaveLength(
      2,
    );
    expect(kubeletRoles).toContain('kubelet-reconcile-pulse');
    expect(kubeletRoles).not.toContain('container-runtime-cri-port');
    runtimeHandle.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      expect(object.geometry).not.toBeInstanceOf(THREE.ConeGeometry);
      expect(object.geometry).not.toBeInstanceOf(THREE.TorusKnotGeometry);
    });
    runtimeHandle.dispose();
    kubeletHandle.dispose();
  });

  it('mounts, detaches, reparents, and disposes both Node-local modules deterministically', () => {
    const scene = new THREE.Group();
    const registry = new SceneRegistry(scene, new VisualFactoryRegistry(), { allowGeneric: false });
    const snapshot = world();
    const projection = viewFor(snapshot);
    registry.sync(snapshot, projection);

    const firstLayout = layoutFor([1.5, 0, 2.4], 'mounted');
    registry.applyLayout(firstLayout);
    const nodeHandle = registry.get(node.id);
    const kubeletHandle = registry.get(kubelet.id);
    const runtimeHandle = registry.get(runtime.id);
    expect(nodeHandle).toBeInstanceOf(NodeVisualHandle);
    expect(kubeletHandle).toBeInstanceOf(KubeletVisualHandle);
    expect(runtimeHandle).toBeInstanceOf(ContainerRuntimeVisualHandle);
    if (
      !(nodeHandle instanceof NodeVisualHandle) ||
      !(kubeletHandle instanceof KubeletVisualHandle) ||
      !(runtimeHandle instanceof ContainerRuntimeVisualHandle)
    ) {
      return;
    }
    expect(kubeletHandle.root.parent).toBe(nodeHandle.kubeletMount);
    expect(runtimeHandle.root.parent).toBe(nodeHandle.runtimeMount);
    expectPosition(
      kubeletHandle.root.getWorldPosition(new THREE.Vector3()),
      firstLayout.positions.get(kubelet.id)!,
    );
    expectPosition(
      runtimeHandle.root.getWorldPosition(new THREE.Vector3()),
      firstLayout.positions.get(runtime.id)!,
    );
    expect(registry.runtimeHierarchyDiagnostics).toEqual({
      nodeHandles: 1,
      podHandles: 0,
      mountedKubelets: 1,
      mountedContainerRuntimes: 1,
      orphanKubelets: 0,
      orphanContainerRuntimes: 0,
      containedContainers: 0,
      containersOutsidePods: 0,
    });

    const orphanLayout = layoutFor([3.2, 0, 3.8], 'orphan');
    registry.applyLayout(orphanLayout);
    expect(kubeletHandle.root.parent).toBe(scene);
    expect(runtimeHandle.root.parent).toBe(scene);
    expectPosition(
      kubeletHandle.root.getWorldPosition(new THREE.Vector3()),
      orphanLayout.positions.get(kubelet.id)!,
    );
    expectPosition(
      runtimeHandle.root.getWorldPosition(new THREE.Vector3()),
      orphanLayout.positions.get(runtime.id)!,
    );
    expect(registry.runtimeHierarchyDiagnostics).toMatchObject({
      mountedKubelets: 0,
      mountedContainerRuntimes: 0,
      orphanKubelets: 1,
      orphanContainerRuntimes: 1,
    });

    const finalLayout = layoutFor([-2.3, 0, 1.1], 'mounted');
    registry.applyLayout(finalLayout);
    expect(kubeletHandle.root.parent).toBe(nodeHandle.kubeletMount);
    expect(runtimeHandle.root.parent).toBe(nodeHandle.runtimeMount);
    expectPosition(
      kubeletHandle.root.getWorldPosition(new THREE.Vector3()),
      finalLayout.positions.get(kubelet.id)!,
    );
    expectPosition(
      runtimeHandle.root.getWorldPosition(new THREE.Vector3()),
      finalLayout.positions.get(runtime.id)!,
    );

    const runtimeGeometries = new Set<THREE.BufferGeometry>();
    const runtimeMaterials = new Set<THREE.Material>();
    runtimeHandle.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      runtimeGeometries.add(object.geometry);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) runtimeMaterials.add(material);
    });
    const disposalSpies = [
      ...[...runtimeGeometries].map((geometry) => vi.spyOn(geometry, 'dispose')),
      ...[...runtimeMaterials].map((material) => vi.spyOn(material, 'dispose')),
    ];
    const beforeNodeRemoval = runtimeHandle.root.getWorldPosition(new THREE.Vector3());
    registry.remove(node.id);
    expect(nodeHandle.isDisposed).toBe(true);
    expect(runtimeHandle.root.parent).toBe(scene);
    expect(kubeletHandle.root.parent).toBe(scene);
    expectPosition(runtimeHandle.root.getWorldPosition(new THREE.Vector3()), [
      beforeNodeRemoval.x,
      beforeNodeRemoval.y,
      beforeNodeRemoval.z,
    ]);
    expect(registry.runtimeHierarchyDiagnostics).toMatchObject({
      nodeHandles: 0,
      orphanKubelets: 1,
      orphanContainerRuntimes: 1,
    });

    registry.clear();
    expect(runtimeHandle.isDisposed).toBe(true);
    expect(kubeletHandle.isDisposed).toBe(true);
    expect(disposalSpies.every((spy) => spy.mock.calls.length === 1)).toBe(true);
    expect(registry.runtimeHierarchyDiagnostics).toEqual({
      nodeHandles: 0,
      podHandles: 0,
      mountedKubelets: 0,
      mountedContainerRuntimes: 0,
      orphanKubelets: 0,
      orphanContainerRuntimes: 0,
      containedContainers: 0,
      containersOutsidePods: 0,
    });
  });

  it('reports Containers only when a valid slot keeps their scaled footprint inside the Pod', () => {
    const scene = new THREE.Group();
    const registry = new SceneRegistry(scene, new VisualFactoryRegistry(), { allowGeneric: false });
    const snapshot = world([pod, container], [containsContainer]);
    registry.sync(snapshot, viewFor(snapshot));
    const containerHandle = registry.get(container.id);
    expect(containerHandle?.root.userData.composedInPod).toBe(pod.id);
    expect(registry.runtimeHierarchyDiagnostics).toMatchObject({
      podHandles: 1,
      containedContainers: 1,
      containersOutsidePods: 0,
    });

    if (!containerHandle) return;
    containerHandle.root.position.x = dimensions.pod.width;
    expect(registry.runtimeHierarchyDiagnostics).toMatchObject({
      containedContainers: 0,
      containersOutsidePods: 1,
    });

    containerHandle.root.position.set(-0.42, 0, 0);
    containerHandle.root.userData.containerSlotAnchor = [-0.42, 0, 0];
    containerHandle.root.userData.containerSlotIndex = 99;
    expect(registry.runtimeHierarchyDiagnostics).toMatchObject({
      containedContainers: 0,
      containersOutsidePods: 1,
    });
    registry.clear();
  });
});
