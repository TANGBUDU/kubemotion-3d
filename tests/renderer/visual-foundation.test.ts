import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState, RelationViewState, ViewProjection } from '../../src/course/types';
import { calculateLayout } from '../../src/renderer/LayoutEngine';
import { getRelationStyle, RelationRegistry } from '../../src/renderer/RelationRegistry';
import { SceneRegistry } from '../../src/renderer/SceneRegistry';
import {
  UnsupportedVisualError,
  VisualFactoryRegistry,
} from '../../src/renderer/VisualFactoryRegistry';
import {
  ContainerVisualHandle,
  ControllerManagerVisualHandle,
  GenericVisualHandle,
  KubeletVisualHandle,
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
      ? 'runtime-instance'
      : kind === 'Node'
        ? 'infrastructure'
        : kind === 'Kubelet' || kind === 'ControllerManager' || kind === 'Scheduler'
          ? 'runtime-component'
          : 'api-object',
  kind,
  name: id.split(':').at(-1) ?? id,
  ...(kind === 'Node' || kind === 'Kubelet' || kind === 'ControllerManager' || kind === 'Scheduler'
    ? {}
    : { namespace: 'shop' }),
  status: kind === 'Container' || kind === 'Pod' ? 'running' : 'healthy',
  data,
  title: text(id),
  summary: text(id),
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
                : 'control-plane',
  },
});

const node = makeEntity('node:atlas', 'Node', {});
const pod = makeEntity('pod:api-old', 'Pod', {
  uid: 'uid-old',
  nodeName: node.name,
  phase: 'Running',
  restartPolicy: 'Always',
});
const container = makeEntity('container:api-old', 'Container', {
  podId: pod.id,
  image: 'example/api:v1',
  restartCount: 0,
  instanceGeneration: 1,
});
const replicaSet = makeEntity('rs:api', 'ReplicaSet', {
  desiredReplicas: 3,
  currentReplicas: 3,
  readyReplicas: 3,
});
const kubelet = makeEntity('component:kubelet', 'Kubelet', { nodeName: node.name });
const controller = makeEntity('component:controller', 'ControllerManager', {});
const scheduler = makeEntity('component:scheduler', 'Scheduler', {});

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
    controller,
    scheduler,
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
  };
};

describe('visual factory foundation', () => {
  it('uses a specialized visual for every golden-lesson kind', () => {
    const registry = new VisualFactoryRegistry();
    const expectations: readonly (readonly [WorldEntity, object])[] = [
      [node, NodeVisualHandle.prototype],
      [pod, PodVisualHandle.prototype],
      [container, ContainerVisualHandle.prototype],
      [replicaSet, ReplicaSetVisualHandle.prototype],
      [kubelet, KubeletVisualHandle.prototype],
      [controller, ControllerManagerVisualHandle.prototype],
      [scheduler, SchedulerVisualHandle.prototype],
    ];
    for (const [item, prototype] of expectations) {
      const handle = registry.create(item, normal, { allowGeneric: false });
      expect(Object.prototype.isPrototypeOf.call(prototype, handle)).toBe(true);
      expect(handle.root.userData.genericVisual).not.toBe(true);
      handle.dispose();
    }
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
      data: { ...container.data, restartCount: 1, instanceGeneration: 2 },
    };
    const after = snapshot(
      [node, pod, restarted, replicaSet, kubelet, controller, scheduler],
      [contains, scheduled, owns],
      2,
    );
    registry.sync(after, viewFor(after));
    expect(registry.get(pod.id)).toBe(podHandle);
    expect(registry.get(container.id)).toBe(containerHandle);
    expect(podHandle.shell.uuid).toBe(shellUuid);
    expect(containerHandle.root.uuid).toBe(containerUuid);
    expect(podHandle.root.userData.restartCount).toBe(1);
    expect(containerHandle.root.userData.instanceGeneration).toBe(2);
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
    expect(registry.guideCount).toBe(1);
    expect(registry.raycastTargets().every((item) => item.userData.role !== 'layout-guide')).toBe(
      true,
    );
    registry.clear();
    expect(registry.guideCount).toBe(0);
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
