import * as THREE from 'three';
import type { EntityViewState, ViewProjection } from '../course/types';
import type { EntityId, WorldEntity, WorldSnapshot } from '../world/types';
import type { LayoutContainer, LayoutResult } from './LayoutEngine';
import { VisualFactoryRegistry, type EntityVisualFactoryResolver } from './VisualFactoryRegistry';
import {
  ContainerVisualHandle,
  PodVisualHandle,
  TextBadge,
  type EntityVisualHandle,
  type VisualContext,
} from './VisualHandles';

export interface SceneSyncResult {
  readonly added: readonly EntityId[];
  readonly updated: readonly EntityId[];
  readonly removed: readonly EntityId[];
}

interface LayoutGuideHandle {
  readonly root: THREE.Group;
  readonly shapeKey: string;
  readonly geometry: THREE.BufferGeometry;
  readonly edgeGeometry: THREE.BufferGeometry;
  readonly material: THREE.Material;
  readonly edgeMaterial: THREE.Material;
  readonly label: TextBadge;
  dispose(): void;
}

const DEFAULT_VIEW: EntityViewState = Object.freeze({
  visible: true,
  emphasis: 'normal',
  labelMode: 'short',
});

const isRendered = (state: EntityViewState | undefined): state is EntityViewState =>
  state?.visible === true && state.emphasis !== 'hidden';

const guideColor = (container: LayoutContainer): number => {
  if (container.kind === 'pending-lane') return 0xf0b44d;
  if (container.kind === 'control-lane') return 0xb792ff;
  return 0x5eb6ff;
};

const createLayoutGuide = (container: LayoutContainer): LayoutGuideHandle => {
  const root = new THREE.Group();
  root.name = `layout-guide:${container.id}`;
  root.userData.role = 'layout-guide';
  root.userData.containerId = container.id;
  root.userData.containerKind = container.kind;
  root.userData.label = container.label;
  root.userData.selectable = false;
  const geometry = new THREE.BoxGeometry(
    container.bounds.size[0],
    Math.max(0.05, container.bounds.size[1]),
    container.bounds.size[2],
  );
  const material = new THREE.MeshBasicMaterial({
    color: guideColor(container),
    transparent: true,
    opacity: container.kind === 'pending-lane' ? 0.11 : 0.08,
    depthWrite: false,
  });
  const surface = new THREE.Mesh(geometry, material);
  surface.userData.role = `${container.kind}-surface`;
  surface.userData.selectable = false;
  root.add(surface);
  const edgeGeometry = new THREE.EdgesGeometry(geometry);
  const edgeMaterial = new THREE.LineDashedMaterial({
    color: guideColor(container),
    transparent: true,
    opacity: 0.72,
    dashSize: container.kind === 'pending-lane' ? 0.28 : 0.5,
    gapSize: container.kind === 'pending-lane' ? 0.16 : 0.22,
  });
  const border = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  border.computeLineDistances();
  border.userData.role = `${container.kind}-boundary`;
  border.userData.selectable = false;
  root.add(border);
  const label = new TextBadge(
    container.kind === 'control-lane' ? 4.1 : 3.5,
    0.4,
    container.kind === 'pending-lane' ? '#ffd891' : '#e8dfff',
  );
  label.setText(container.label.toUpperCase());
  label.sprite.position.set(
    0,
    Math.max(0.42, container.bounds.size[1] / 2 + 0.34),
    -container.bounds.size[2] / 2,
  );
  label.sprite.userData.role = `${container.kind}-label`;
  root.add(label.sprite);
  root.position.set(...container.bounds.center);
  return {
    root,
    shapeKey: `${container.kind}:${container.bounds.size.join(',')}`,
    geometry,
    edgeGeometry,
    material,
    edgeMaterial,
    label,
    dispose: () => {
      root.removeFromParent();
      root.clear();
      geometry.dispose();
      edgeGeometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
      label.dispose();
    },
  };
};

const visibleInHierarchy = (object: THREE.Object3D, root: THREE.Object3D): boolean => {
  let current: THREE.Object3D | null = object;
  while (current) {
    if (!current.visible) return false;
    if (current === root) return true;
    current = current.parent;
  }
  return false;
};

/** Owns entity handles and non-entity layout guides attached to one THREE.Scene. */
export class SceneRegistry {
  private readonly handles = new Map<EntityId, EntityVisualHandle>();
  private readonly guides = new Map<string, LayoutGuideHandle>();

  public constructor(
    private readonly scene: THREE.Scene,
    private readonly factory: EntityVisualFactoryResolver = new VisualFactoryRegistry(),
    private readonly context: VisualContext = {},
  ) {}

  public get(entityId: EntityId): EntityVisualHandle | undefined {
    return this.handles.get(entityId);
  }

  public ensure(entity: WorldEntity, view: EntityViewState = DEFAULT_VIEW): EntityVisualHandle {
    const current = this.handles.get(entity.id);
    if (current) {
      current.root.userData.activeWorld = true;
      current.update(entity, view);
      return current;
    }
    const handle = this.factory.create(entity, view, this.context);
    handle.root.userData.activeWorld = true;
    handle.update(entity, view);
    this.handles.set(entity.id, handle);
    this.scene.add(handle.root);
    return handle;
  }

  /**
   * Diffs handles by EntityId. Hidden entities are removed rather than kept as invisible raycast
   * targets; callers that need an exit animation must retain its handle until that cue finishes.
   */
  public sync(world: WorldSnapshot, view: ViewProjection): SceneSyncResult {
    const desired = Object.values(world.entities)
      .filter((entity) => isRendered(view.entityStates[entity.id]))
      .sort((left, right) => left.id.localeCompare(right.id));
    const desiredIds = new Set(desired.map((entity) => entity.id));
    const removed: EntityId[] = [];
    const stale = [...this.handles.values()]
      .filter((handle) => !desiredIds.has(handle.entityId))
      .sort((left, right) => {
        const leftOrder =
          left instanceof ContainerVisualHandle ? 0 : left instanceof PodVisualHandle ? 1 : 2;
        const rightOrder =
          right instanceof ContainerVisualHandle ? 0 : right instanceof PodVisualHandle ? 1 : 2;
        return leftOrder - rightOrder || left.entityId.localeCompare(right.entityId);
      });
    for (const handle of stale) {
      removed.push(handle.entityId);
      this.remove(handle.entityId);
    }

    const added: EntityId[] = [];
    const updated: EntityId[] = [];
    for (const entity of desired) {
      const state = view.entityStates[entity.id];
      if (!state) continue;
      if (this.handles.has(entity.id)) updated.push(entity.id);
      else added.push(entity.id);
      this.ensure(entity, state);
    }
    this.syncPodComposition(world);
    return { added, updated, removed };
  }

  private syncPodComposition(world: WorldSnapshot): void {
    const podByContainer = new Map<EntityId, EntityId>();
    for (const relation of Object.values(world.relations)) {
      if (relation.semantic === 'composition' && relation.type === 'contains-runtime') {
        podByContainer.set(relation.to, relation.from);
      }
    }
    for (const handle of this.handles.values()) {
      if (!(handle instanceof ContainerVisualHandle)) continue;
      const desiredPodId = podByContainer.get(handle.entityId);
      const currentPodId =
        typeof handle.root.userData.composedInPod === 'string'
          ? handle.root.userData.composedInPod
          : undefined;
      if (currentPodId && currentPodId !== desiredPodId) {
        const currentPod = this.handles.get(currentPodId);
        if (currentPod instanceof PodVisualHandle) currentPod.detachContainer(handle.entityId);
      }
      const desiredPod = desiredPodId ? this.handles.get(desiredPodId) : undefined;
      if (desiredPod instanceof PodVisualHandle) {
        desiredPod.attachContainer(handle);
      } else if (handle.root.parent !== this.scene) {
        handle.root.removeFromParent();
        this.scene.add(handle.root);
      }
    }
  }

  public applyLayout(layout: LayoutResult): void {
    this.syncLayoutGuides(layout.containers);
    for (const [entityId, entityLayout] of layout.entities) {
      const handle = this.handles.get(entityId);
      if (!handle) continue;
      if (entityLayout.lane === 'composition' && handle instanceof ContainerVisualHandle) continue;
      handle.root.position.set(...entityLayout.position);
      handle.root.updateWorldMatrix(true, false);
    }
  }

  private syncLayoutGuides(containers: readonly LayoutContainer[]): void {
    const desired = containers.filter((container) => container.kind !== 'node-rack');
    const desiredIds = new Set(desired.map((container) => container.id));
    for (const [id, guide] of this.guides) {
      if (desiredIds.has(id)) continue;
      guide.dispose();
      this.guides.delete(id);
    }
    for (const container of desired) {
      const current = this.guides.get(container.id);
      const sameShape =
        current?.shapeKey === `${container.kind}:${container.bounds.size.join(',')}`;
      if (current && sameShape) {
        current.root.position.set(...container.bounds.center);
        current.root.userData.label = container.label;
        current.label.setText(container.label.toUpperCase());
        continue;
      }
      if (current) current.dispose();
      const guide = createLayoutGuide(container);
      this.guides.set(container.id, guide);
      this.scene.add(guide.root);
    }
  }

  public remove(entityId: EntityId): void {
    const handle = this.handles.get(entityId);
    if (!handle) return;
    if (handle instanceof ContainerVisualHandle) {
      const podId =
        typeof handle.root.userData.composedInPod === 'string'
          ? handle.root.userData.composedInPod
          : undefined;
      const pod = podId ? this.handles.get(podId) : undefined;
      if (pod instanceof PodVisualHandle) pod.detachContainer(entityId);
    }
    handle.root.removeFromParent();
    handle.dispose();
    this.handles.delete(entityId);
  }

  public clear(): void {
    const ids = [...this.handles.values()]
      .sort((left, right) => {
        const leftOrder =
          left instanceof ContainerVisualHandle ? 0 : left instanceof PodVisualHandle ? 1 : 2;
        const rightOrder =
          right instanceof ContainerVisualHandle ? 0 : right instanceof PodVisualHandle ? 1 : 2;
        return leftOrder - rightOrder || left.entityId.localeCompare(right.entityId);
      })
      .map((handle) => handle.entityId);
    for (const id of ids) this.remove(id);
    for (const guide of this.guides.values()) guide.dispose();
    this.guides.clear();
  }

  public setSelected(entityId?: EntityId): void {
    for (const handle of this.handles.values()) handle.setSelected(handle.entityId === entityId);
  }

  public raycastTargets(): readonly THREE.Object3D[] {
    const targets: THREE.Object3D[] = [];
    for (const handle of this.handles.values()) {
      if (
        handle.isDisposed ||
        !handle.root.visible ||
        handle.root.userData.activeWorld !== true ||
        handle.root.userData.selectable !== true
      ) {
        continue;
      }
      for (const object of handle.selectableObjects) {
        if (object.userData.selectable === true && visibleInHierarchy(object, handle.root)) {
          targets.push(object);
        }
      }
    }
    return targets;
  }

  public entityIdForObject(object: THREE.Object3D | undefined): EntityId | undefined {
    let current: THREE.Object3D | null = object ?? null;
    while (current) {
      const entityId = current.userData.entityId;
      if (typeof entityId === 'string') {
        const handle = this.handles.get(entityId);
        if (
          handle &&
          !handle.isDisposed &&
          handle.root.visible &&
          handle.root.userData.activeWorld === true
        ) {
          return entityId;
        }
        return undefined;
      }
      current = current.parent;
    }
    return undefined;
  }

  public values(): Iterable<EntityVisualHandle> {
    return this.handles.values();
  }

  public get size(): number {
    return this.handles.size;
  }

  public get guideCount(): number {
    return this.guides.size;
  }
}
