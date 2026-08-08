import * as THREE from 'three';
import type { EntityViewState, ViewProjection } from '../course/types';
import type { EntityId, WorldEntity, WorldSnapshot } from '../world/types';
import type { LayoutContainer, LayoutResult } from './LayoutEngine';
import { VisualFactoryRegistry, type EntityVisualFactoryResolver } from './VisualFactoryRegistry';
import { dimensions } from './design/dimensions';
import { createRoundedBoxGeometry } from './design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from './design/materials';
import { palette } from './design/palette';
import type { EntityVisualHandle, VisualContext } from './visuals/BaseVisualHandle';
import { ContainerRuntimeVisualHandle } from './visuals/ContainerRuntimeVisual';
import { ContainerVisualHandle } from './visuals/ContainerVisual';
import { KubeletVisualHandle } from './visuals/KubeletVisual';
import { NodeVisualHandle } from './visuals/NodeVisual';
import { PodVisualHandle } from './visuals/PodVisual';

export interface SceneSyncResult {
  readonly added: readonly EntityId[];
  readonly updated: readonly EntityId[];
  readonly removed: readonly EntityId[];
}

export interface LayoutLabelAnchor {
  readonly id: string;
  readonly text: string;
  readonly worldPosition: readonly [number, number, number];
  readonly zoneId?: 'control-plane' | 'workload-state' | 'worker-nodes';
  readonly kind: 'zone-title' | 'tray-title';
}

export interface RuntimeHierarchyDiagnostics {
  readonly nodeHandles: number;
  readonly podHandles: number;
  readonly mountedKubelets: number;
  readonly mountedContainerRuntimes: number;
  readonly orphanKubelets: number;
  readonly orphanContainerRuntimes: number;
  readonly containedContainers: number;
  readonly containersOutsidePods: number;
}

interface LayoutGuideHandle {
  readonly root: THREE.Group;
  readonly shapeKey: string;
  readonly labelAnchor?: THREE.Object3D;
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
  if (container.kind === 'workload-lane') return palette.scheduling;
  if (container.kind === 'worker-lane') return palette.dataFlow;
  return 0x5eb6ff;
};

const layoutGuideShapeKey = (container: LayoutContainer): string =>
  [
    container.kind,
    container.bounds.size.join(','),
    String(container.slots.length),
    container.slots.map((slot) => slot.occupiedBy ?? '-').join(','),
    container.label,
    container.labelAnchor?.join(',') ?? '',
  ].join(':');

const configureGuideRoot = (root: THREE.Group, container: LayoutContainer): void => {
  root.name = `layout-guide:${container.id}`;
  root.userData.role = container.kind === 'pending-lane' ? 'unscheduled-pods-tray' : 'layout-guide';
  root.userData.containerId = container.id;
  root.userData.containerKind = container.kind;
  root.userData.label = container.label;
  root.userData.zoneId = container.zoneId;
  root.userData.labelAnchor = container.labelAnchor;
  root.userData.selectable = false;
};

const addDomLabelAnchor = (
  root: THREE.Group,
  container: LayoutContainer,
): THREE.Object3D | undefined => {
  if (!container.labelAnchor) return undefined;
  const anchor = new THREE.Object3D();
  anchor.name = `layout-label-anchor:${container.id}`;
  anchor.position.set(
    container.labelAnchor[0] - container.bounds.center[0],
    container.labelAnchor[1] - container.bounds.center[1],
    container.labelAnchor[2] - container.bounds.center[2],
  );
  anchor.userData.role = 'dom-label-anchor';
  anchor.userData.domLabel = Object.freeze({
    id: `layout:${container.id}`,
    labelClass: container.kind === 'pending-lane' ? 'entity-short-name' : 'zone-title',
    text: container.label,
    ...(container.zoneId ? { zoneId: container.zoneId } : {}),
  });
  root.add(anchor);
  return anchor;
};

const createPendingTray = (container: LayoutContainer): LayoutGuideHandle => {
  const root = new THREE.Group();
  configureGuideRoot(root, container);
  root.userData.empty = container.slots.every((slot) => !slot.occupiedBy);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const ownGeometry = <TGeometry extends THREE.BufferGeometry>(geometry: TGeometry): TGeometry => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <TMaterial extends THREE.Material>(material: TMaterial): TMaterial => {
    materials.add(material);
    return material;
  };

  const baseGeometry = ownGeometry(
    createRoundedBoxGeometry(
      container.bounds.size[0],
      Math.max(0.14, container.bounds.size[1]),
      container.bounds.size[2],
      0.2,
      4,
    ),
  );
  const baseMaterial = ownMaterial(
    createSurfaceMaterial({
      color: palette.surfaceRecessed,
      roughness: 0.72,
      metalness: 0.03,
      transparent: true,
      opacity: 0.88,
    }),
  );
  const base = new THREE.Mesh(baseGeometry, baseMaterial);
  base.receiveShadow = true;
  base.userData.role = 'unscheduled-tray-base';
  base.userData.selectable = false;
  root.add(base);

  const railMaterial = ownMaterial(createFlatAccentMaterial(palette.scheduling, 0.88));
  const longRailGeometry = ownGeometry(
    createRoundedBoxGeometry(container.bounds.size[0], 0.2, 0.09, 0.035),
  );
  const shortRailGeometry = ownGeometry(
    createRoundedBoxGeometry(0.09, 0.2, container.bounds.size[2] - 0.14, 0.035),
  );
  for (const z of [-1, 1]) {
    const rail = new THREE.Mesh(longRailGeometry, railMaterial);
    rail.position.set(0, 0.13, (z * (container.bounds.size[2] - 0.09)) / 2);
    rail.userData.role = 'unscheduled-tray-rail';
    root.add(rail);
  }
  for (const x of [-1, 1]) {
    const rail = new THREE.Mesh(shortRailGeometry, railMaterial);
    rail.position.set((x * (container.bounds.size[0] - 0.09)) / 2, 0.13, 0);
    rail.userData.role = 'unscheduled-tray-rail';
    root.add(rail);
  }

  const slotGeometry = ownGeometry(createRoundedBoxGeometry(1.58, 0.035, 1.22, 0.12));
  for (const slot of container.slots) {
    const slotMaterial = ownMaterial(
      createFlatAccentMaterial(slot.occupiedBy ? palette.pending : palette.borderSubtle, 0.32),
    );
    const well = new THREE.Mesh(slotGeometry, slotMaterial);
    well.position.set(
      slot.position[0] - container.bounds.center[0],
      0.13,
      slot.position[2] - container.bounds.center[2],
    );
    well.userData.role = 'unscheduled-pod-slot';
    well.userData.slotIndex = slot.index;
    well.userData.occupiedBy = slot.occupiedBy;
    root.add(well);
  }

  const warningGeometry = ownGeometry(new THREE.BoxGeometry(0.32, 0.035, 0.075));
  for (let index = 0; index < 5; index += 1) {
    const warning = new THREE.Mesh(warningGeometry, railMaterial);
    warning.position.set(
      -container.bounds.size[0] / 2 + 0.36 + index * 0.45,
      0.25,
      -container.bounds.size[2] / 2,
    );
    warning.rotation.y = -0.58;
    warning.userData.role = 'unscheduled-warning-mark';
    root.add(warning);
  }
  const labelAnchor = addDomLabelAnchor(root, container);
  root.position.set(...container.bounds.center);
  return {
    root,
    shapeKey: layoutGuideShapeKey(container),
    ...(labelAnchor ? { labelAnchor } : {}),
    dispose: () => {
      root.removeFromParent();
      root.clear();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
};

const createSemanticIsland = (container: LayoutContainer): LayoutGuideHandle => {
  const root = new THREE.Group();
  configureGuideRoot(root, container);
  root.userData.role = 'semantic-island';
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const ownGeometry = <TGeometry extends THREE.BufferGeometry>(geometry: TGeometry): TGeometry => {
    geometries.add(geometry);
    return geometry;
  };
  const ownMaterial = <TMaterial extends THREE.Material>(material: TMaterial): TMaterial => {
    materials.add(material);
    return material;
  };

  const height = Math.max(0.09, container.bounds.size[1]);
  const geometry = ownGeometry(
    createRoundedBoxGeometry(container.bounds.size[0], height, container.bounds.size[2], 0.24, 4),
  );
  const material = ownMaterial(
    createSurfaceMaterial({
      color: palette.surfaceSecondary,
      roughness: 0.76,
      metalness: 0.04,
      transparent: true,
      opacity: 0.94,
    }),
  );
  const base = new THREE.Mesh(geometry, material);
  base.receiveShadow = true;
  base.userData.role = 'semantic-island-base';
  base.userData.islandKind = container.kind;
  base.userData.selectable = false;
  root.add(base);

  const edgeGeometry = ownGeometry(new THREE.EdgesGeometry(geometry, 24));
  const edgeMaterial = ownMaterial(createFlatAccentMaterial(guideColor(container), 0.74));
  const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edge.userData.role = 'semantic-island-edge';
  edge.userData.islandKind = container.kind;
  edge.userData.selectable = false;
  root.add(edge);

  const markerWidth = Math.min(3.4, Math.max(1.4, container.bounds.size[0] * 0.24));
  const markerGeometry = ownGeometry(createRoundedBoxGeometry(markerWidth, 0.055, 0.09, 0.025));
  const markerMaterial = ownMaterial(createFlatAccentMaterial(guideColor(container), 0.9));
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  marker.position.set(
    -container.bounds.size[0] / 2 + markerWidth / 2 + 0.36,
    height / 2 + 0.035,
    -container.bounds.size[2] / 2 + 0.17,
  );
  marker.userData.role = 'semantic-island-heading-rail';
  marker.userData.selectable = false;
  root.add(marker);

  const labelAnchor = addDomLabelAnchor(root, container);
  root.position.set(...container.bounds.center);
  return {
    root,
    shapeKey: layoutGuideShapeKey(container),
    ...(labelAnchor ? { labelAnchor } : {}),
    dispose: () => {
      root.removeFromParent();
      root.clear();
      for (const ownedGeometry of geometries) ownedGeometry.dispose();
      for (const ownedMaterial of materials) ownedMaterial.dispose();
    },
  };
};

const createLayoutGuide = (container: LayoutContainer): LayoutGuideHandle => {
  if (container.kind === 'pending-lane') return createPendingTray(container);
  if (
    container.kind === 'control-lane' ||
    container.kind === 'worker-lane' ||
    container.kind === 'workload-lane'
  ) {
    return createSemanticIsland(container);
  }
  const root = new THREE.Group();
  configureGuideRoot(root, container);
  const geometry = new THREE.BoxGeometry(
    container.bounds.size[0],
    Math.max(0.05, container.bounds.size[1]),
    container.bounds.size[2],
  );
  const material = new THREE.MeshBasicMaterial({
    color: guideColor(container),
    transparent: true,
    opacity: 0.045,
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
    dashSize: 0.5,
    gapSize: 0.22,
  });
  const border = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  border.computeLineDistances();
  border.userData.role = `${container.kind}-boundary`;
  border.userData.selectable = false;
  root.add(border);
  const labelAnchor = addDomLabelAnchor(root, container);
  root.position.set(...container.bounds.center);
  return {
    root,
    shapeKey: layoutGuideShapeKey(container),
    ...(labelAnchor ? { labelAnchor } : {}),
    dispose: () => {
      root.removeFromParent();
      root.clear();
      geometry.dispose();
      edgeGeometry.dispose();
      material.dispose();
      edgeMaterial.dispose();
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

const disposalRank = (handle: EntityVisualHandle): number => {
  if (handle instanceof ContainerVisualHandle) return 0;
  if (handle instanceof PodVisualHandle) return 1;
  if (handle instanceof KubeletVisualHandle || handle instanceof ContainerRuntimeVisualHandle)
    return 2;
  if (handle instanceof NodeVisualHandle) return 3;
  return 4;
};

const isNodeSystemModule = (
  handle: EntityVisualHandle,
): handle is KubeletVisualHandle | ContainerRuntimeVisualHandle =>
  handle instanceof KubeletVisualHandle || handle instanceof ContainerRuntimeVisualHandle;

const isContainedInPod = (
  handle: ContainerVisualHandle,
  pod: EntityVisualHandle | undefined,
): pod is PodVisualHandle => {
  if (!(pod instanceof PodVisualHandle) || !pod.hasContainer(handle.entityId)) return false;
  if (handle.root.parent !== pod.containerBay) return false;
  const slotIndex = handle.root.userData.containerSlotIndex;
  const slotAnchor = handle.root.userData.containerSlotAnchor;
  const slotCount = pod.root.userData.containerSlotCount;
  if (
    typeof slotIndex !== 'number' ||
    !Number.isInteger(slotIndex) ||
    typeof slotCount !== 'number' ||
    slotIndex < 0 ||
    slotIndex >= slotCount ||
    !Array.isArray(slotAnchor) ||
    slotAnchor.length !== 3 ||
    !slotAnchor.every((value) => typeof value === 'number' && Number.isFinite(value))
  ) {
    return false;
  }
  const epsilon = 1e-5;
  if (
    Math.abs(handle.root.position.x - slotAnchor[0]) > epsilon ||
    Math.abs(handle.root.position.y - slotAnchor[1]) > epsilon ||
    Math.abs(handle.root.position.z - slotAnchor[2]) > epsilon
  ) {
    return false;
  }
  const halfWidth = (dimensions.container.width * Math.abs(handle.root.scale.x)) / 2;
  const halfDepth = (dimensions.container.depth * Math.abs(handle.root.scale.z)) / 2;
  return (
    Math.abs(handle.root.position.x) + halfWidth <= dimensions.pod.width / 2 + epsilon &&
    Math.abs(handle.root.position.z) + halfDepth <= dimensions.pod.depth / 2 + epsilon
  );
};

const LAYOUT_LABEL_ORDER: Readonly<Record<string, number>> = Object.freeze({
  'control-plane-island': 0,
  'control-plane-zone': 0,
  'workload-state-zone': 1,
  'unscheduled-transit-lane': 2,
  'pending-lane': 2,
  'worker-nodes-island': 3,
  'worker-nodes-zone': 3,
});

/** Owns entity handles and non-entity layout guides attached to one THREE.Scene. */
export class SceneRegistry {
  private readonly handles = new Map<EntityId, EntityVisualHandle>();
  private readonly guides = new Map<string, LayoutGuideHandle>();

  public constructor(
    private readonly scene: THREE.Object3D,
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
  public sync(
    world: WorldSnapshot,
    view: ViewProjection,
    retainedEntityIds: ReadonlySet<EntityId> = new Set(),
  ): SceneSyncResult {
    const desired = Object.values(world.entities)
      .filter((entity) => isRendered(view.entityStates[entity.id]))
      .sort((left, right) => left.id.localeCompare(right.id));
    const desiredIds = new Set(desired.map((entity) => entity.id));
    const removed: EntityId[] = [];
    const stale = [...this.handles.values()]
      .filter(
        (handle) => !desiredIds.has(handle.entityId) && !retainedEntityIds.has(handle.entityId),
      )
      .sort((left, right) => {
        return (
          disposalRank(left) - disposalRank(right) || left.entityId.localeCompare(right.entityId)
        );
      });
    for (const handle of stale) {
      removed.push(handle.entityId);
      this.remove(handle.entityId);
    }

    for (const handle of this.handles.values()) {
      if (!desiredIds.has(handle.entityId) && retainedEntityIds.has(handle.entityId)) {
        handle.root.userData.activeWorld = false;
      }
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
      if (handle.root.userData.activeWorld !== true) continue;
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
    this.syncNodeComposition(layout);
    for (const [entityId, entityLayout] of layout.entities) {
      const handle = this.handles.get(entityId);
      if (!handle) continue;
      if (entityLayout.lane === 'composition' && handle instanceof ContainerVisualHandle) continue;
      if (
        entityLayout.lane === 'node-agent' &&
        isNodeSystemModule(handle) &&
        handle.root.userData.composedInNode === entityLayout.parentId
      ) {
        continue;
      }
      handle.root.position.set(...entityLayout.position);
      handle.root.updateWorldMatrix(true, false);
    }
  }

  private syncNodeComposition(layout: LayoutResult): void {
    for (const handle of this.handles.values()) {
      if (!isNodeSystemModule(handle)) continue;
      const entityLayout = layout.entities.get(handle.entityId);
      const desiredNodeId = entityLayout?.lane === 'node-agent' ? entityLayout.parentId : undefined;
      const currentNodeId =
        typeof handle.root.userData.composedInNode === 'string'
          ? handle.root.userData.composedInNode
          : undefined;
      if (currentNodeId && currentNodeId !== desiredNodeId) {
        const currentNode = this.handles.get(currentNodeId);
        if (currentNode instanceof NodeVisualHandle) {
          if (handle instanceof KubeletVisualHandle) {
            currentNode.detachKubelet(handle.entityId, this.scene);
          } else {
            currentNode.detachRuntime(handle.entityId, this.scene);
          }
        }
      }
      const desiredNode = desiredNodeId ? this.handles.get(desiredNodeId) : undefined;
      if (desiredNode instanceof NodeVisualHandle) {
        if (handle instanceof KubeletVisualHandle) desiredNode.attachKubelet(handle);
        else desiredNode.attachRuntime(handle);
      } else if (handle.root.parent !== this.scene) {
        this.scene.attach(handle.root);
        delete handle.root.userData.composedInNode;
      }
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
      const sameShape = current?.shapeKey === layoutGuideShapeKey(container);
      if (current && sameShape) {
        current.root.position.set(...container.bounds.center);
        current.root.userData.label = container.label;
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
    if (handle instanceof KubeletVisualHandle) {
      const nodeId =
        typeof handle.root.userData.composedInNode === 'string'
          ? handle.root.userData.composedInNode
          : undefined;
      const node = nodeId ? this.handles.get(nodeId) : undefined;
      if (node instanceof NodeVisualHandle) node.detachKubelet(entityId);
    }
    if (handle instanceof ContainerRuntimeVisualHandle) {
      const nodeId =
        typeof handle.root.userData.composedInNode === 'string'
          ? handle.root.userData.composedInNode
          : undefined;
      const node = nodeId ? this.handles.get(nodeId) : undefined;
      if (node instanceof NodeVisualHandle) node.detachRuntime(entityId);
    }
    if (handle instanceof NodeVisualHandle) {
      for (const candidate of this.handles.values()) {
        if (
          candidate instanceof KubeletVisualHandle &&
          candidate.root.userData.composedInNode === handle.entityId
        ) {
          handle.detachKubelet(candidate.entityId, this.scene);
        }
        if (
          candidate instanceof ContainerRuntimeVisualHandle &&
          candidate.root.userData.composedInNode === handle.entityId
        ) {
          handle.detachRuntime(candidate.entityId, this.scene);
        }
      }
    }
    handle.root.removeFromParent();
    handle.dispose();
    this.handles.delete(entityId);
  }

  public clear(): void {
    const ids = [...this.handles.values()]
      .sort((left, right) => {
        return (
          disposalRank(left) - disposalRank(right) || left.entityId.localeCompare(right.entityId)
        );
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

  /** Stable world-space anchors consumed by the DOM label layer after each layout pass. */
  public layoutLabels(): readonly LayoutLabelAnchor[] {
    return [...this.guides.entries()]
      .filter(([, guide]) => guide.labelAnchor !== undefined)
      .sort(
        ([leftId], [rightId]) =>
          (LAYOUT_LABEL_ORDER[leftId] ?? 100) - (LAYOUT_LABEL_ORDER[rightId] ?? 100) ||
          leftId.localeCompare(rightId),
      )
      .map(([id, guide]) => {
        const position =
          guide.labelAnchor?.getWorldPosition(new THREE.Vector3()) ?? new THREE.Vector3();
        const zoneId = guide.root.userData.zoneId;
        const text = guide.root.userData.label;
        return {
          id: `layout:${id}`,
          text: typeof text === 'string' ? text : id,
          worldPosition: [position.x, position.y, position.z] as const,
          ...(zoneId === 'control-plane' || zoneId === 'workload-state' || zoneId === 'worker-nodes'
            ? { zoneId }
            : {}),
          kind: guide.root.userData.containerKind === 'pending-lane' ? 'tray-title' : 'zone-title',
        } satisfies LayoutLabelAnchor;
      });
  }

  public values(): Iterable<EntityVisualHandle> {
    return this.handles.values();
  }

  /** Returns the rendered teaching object's bounds, excluding its selection halo. */
  public worldBoundsFor(entityId: EntityId): THREE.Box3 | undefined {
    const handle = this.handles.get(entityId);
    if (!handle || handle.isDisposed || handle.root.userData.activeWorld !== true) return undefined;
    return handle.getWorldBounds?.();
  }

  public get size(): number {
    return this.handles.size;
  }

  public get guideCount(): number {
    return this.guides.size;
  }

  public get semanticIslandCount(): number {
    return [...this.guides.values()].filter(
      (guide) =>
        guide.root.userData.role === 'semantic-island' ||
        guide.root.userData.role === 'unscheduled-pods-tray',
    ).length;
  }

  public get runtimeHierarchyDiagnostics(): RuntimeHierarchyDiagnostics {
    let nodeHandles = 0;
    let podHandles = 0;
    let mountedKubelets = 0;
    let mountedContainerRuntimes = 0;
    let orphanKubelets = 0;
    let orphanContainerRuntimes = 0;
    let containedContainers = 0;
    let containersOutsidePods = 0;
    for (const handle of this.handles.values()) {
      if (handle instanceof NodeVisualHandle) {
        nodeHandles += 1;
        continue;
      }
      if (handle instanceof PodVisualHandle) {
        podHandles += 1;
        continue;
      }
      if (handle instanceof ContainerVisualHandle) {
        const podId =
          typeof handle.root.userData.composedInPod === 'string'
            ? handle.root.userData.composedInPod
            : undefined;
        if (isContainedInPod(handle, podId ? this.handles.get(podId) : undefined)) {
          containedContainers += 1;
        } else {
          containersOutsidePods += 1;
        }
        continue;
      }
      if (!isNodeSystemModule(handle)) continue;
      const nodeId =
        typeof handle.root.userData.composedInNode === 'string'
          ? handle.root.userData.composedInNode
          : undefined;
      const node = nodeId ? this.handles.get(nodeId) : undefined;
      const mounted =
        node instanceof NodeVisualHandle &&
        (handle instanceof KubeletVisualHandle
          ? node.hasKubelet(handle.entityId) && handle.root.parent === node.kubeletMount
          : node.hasRuntime(handle.entityId) && handle.root.parent === node.runtimeMount);
      if (handle instanceof KubeletVisualHandle) {
        if (mounted) mountedKubelets += 1;
        else orphanKubelets += 1;
      } else if (mounted) mountedContainerRuntimes += 1;
      else orphanContainerRuntimes += 1;
    }
    return {
      nodeHandles,
      podHandles,
      mountedKubelets,
      mountedContainerRuntimes,
      orphanKubelets,
      orphanContainerRuntimes,
      containedContainers,
      containersOutsidePods,
    };
  }
}
