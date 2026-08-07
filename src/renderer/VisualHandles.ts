import * as THREE from 'three';
import type { EntityViewState } from '../course/types';
import { getContainerData, getPodData, getReplicaSetData } from '../world/dataGuards';
import type { EntityId, EntityStatus, WorldEntity } from '../world/types';

export const ANCHOR_KINDS = [
  'center',
  'label',
  'ownership',
  'placement',
  'control',
  'data-path',
  'composition',
] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export interface VisualContext {
  /** Unsupported entities may use the visibly marked fallback only outside the golden lesson. */
  readonly allowGeneric?: boolean;
}

export interface EntityVisualHandle {
  readonly entityId: EntityId;
  readonly entity: WorldEntity;
  readonly root: THREE.Group;
  readonly selectableObjects: readonly THREE.Object3D[];
  readonly isDisposed: boolean;
  update(entity: WorldEntity, view: EntityViewState): void;
  setSelected(selected: boolean): void;
  getAnchor(anchor: AnchorKind): THREE.Vector3;
  dispose(): void;
}

const STATUS_COLORS: Readonly<Record<EntityStatus, number>> = {
  healthy: 0x45c486,
  ready: 0x45c486,
  'not-ready': 0xf0b44d,
  pending: 0xf0b44d,
  starting: 0x5eb6ff,
  running: 0x45c486,
  waiting: 0xf0b44d,
  terminating: 0xef936a,
  terminated: 0xef6a78,
  succeeded: 0x45c486,
  failed: 0xef6a78,
  unknown: 0x9fb3c8,
};

const STATUS_GLYPHS: Readonly<Record<EntityStatus, string>> = {
  healthy: '✓',
  ready: '✓',
  'not-ready': '!',
  pending: '◷',
  starting: '▷',
  running: '●',
  waiting: '…',
  terminating: '◌',
  terminated: '×',
  succeeded: '✓',
  failed: '×',
  unknown: '?',
};

const viewScale = (view: EntityViewState): number => {
  if (view.emphasis === 'focused') return 1.08;
  if (view.emphasis === 'dimmed') return 0.96;
  return 1;
};

const viewOpacity = (view: EntityViewState): number =>
  view.emphasis === 'dimmed' ? 0.28 : view.emphasis === 'focused' ? 1 : 0.88;

/** Canvas-backed in browsers and deterministic texture-backed in non-canvas test environments. */
export class TextBadge {
  public readonly sprite: THREE.Sprite;
  private readonly texture: THREE.Texture;
  private readonly material: THREE.SpriteMaterial;
  private readonly canvas: HTMLCanvasElement | undefined;
  private readonly context: CanvasRenderingContext2D | null;
  private currentText = '';

  public constructor(
    width: number,
    height: number,
    private readonly foreground = '#e8f4ff',
    private readonly background = 'rgba(8,17,31,0.88)',
  ) {
    const canvasIsAvailable =
      typeof document !== 'undefined' &&
      (typeof navigator === 'undefined' || !navigator.userAgent.toLowerCase().includes('jsdom'));
    if (!canvasIsAvailable) {
      const pixel = new Uint8Array([8, 17, 31, 255]);
      const texture = new THREE.DataTexture(pixel, 1, 1, THREE.RGBAFormat);
      texture.needsUpdate = true;
      this.texture = texture;
      this.canvas = undefined;
      this.context = null;
    } else {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 512;
      this.canvas.height = 96;
      this.context = this.canvas.getContext('2d');
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.minFilter = THREE.LinearFilter;
    }
    this.material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
    });
    this.sprite = new THREE.Sprite(this.material);
    this.sprite.scale.set(width, height, 1);
    this.sprite.renderOrder = 8;
    this.sprite.userData.role = 'text-badge';
  }

  public setText(text: string): void {
    if (text === this.currentText) return;
    this.currentText = text;
    this.sprite.userData.text = text;
    const context = this.context;
    const canvas = this.canvas;
    if (!context || !canvas) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = this.background;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, 16);
    context.fill();
    context.strokeStyle = 'rgba(139,211,255,0.55)';
    context.lineWidth = 3;
    context.stroke();
    context.fillStyle = this.foreground;
    context.font = '600 35px ui-monospace, SFMono-Regular, Consolas, monospace';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 30);
    this.texture.needsUpdate = true;
  }

  public setOpacity(opacity: number): void {
    this.material.opacity = Math.min(1, Math.max(0, opacity));
    this.material.needsUpdate = true;
  }

  public dispose(): void {
    this.sprite.removeFromParent();
    this.material.dispose();
    this.texture.dispose();
  }
}

abstract class BaseEntityVisualHandle implements EntityVisualHandle {
  public readonly entityId: EntityId;
  public readonly root = new THREE.Group();
  public readonly selectableObjects: THREE.Object3D[] = [];
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly baseOpacity = new Map<THREE.Material, number>();
  private readonly badges = new Set<TextBadge>();
  private readonly selectionRing: THREE.Mesh;
  private currentEntity: WorldEntity;
  private currentView: EntityViewState;
  private disposed = false;
  private selected = false;

  protected constructor(entity: WorldEntity, view: EntityViewState, selectionRadius: number) {
    this.entityId = entity.id;
    this.currentEntity = entity;
    this.currentView = view;
    this.root.name = `entity:${entity.id}`;
    this.root.userData.entityId = entity.id;
    this.root.userData.activeWorld = true;
    this.root.userData.selectable = true;

    const geometry = this.ownGeometry(new THREE.TorusGeometry(selectionRadius, 0.045, 8, 40));
    const material = this.ownMaterial(
      new THREE.MeshBasicMaterial({ color: 0x8bd3ff, depthTest: false, transparent: true }),
    );
    this.selectionRing = new THREE.Mesh(geometry, material);
    this.selectionRing.name = 'selection-ring';
    this.selectionRing.rotation.x = Math.PI / 2;
    this.selectionRing.position.y = 0.06;
    this.selectionRing.visible = false;
    this.selectionRing.renderOrder = 20;
    this.selectionRing.userData.selectable = false;
    this.root.add(this.selectionRing);
  }

  public get entity(): WorldEntity {
    return this.currentEntity;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  protected get view(): EntityViewState {
    return this.currentView;
  }

  protected ownGeometry<TGeometry extends THREE.BufferGeometry>(geometry: TGeometry): TGeometry {
    this.ownedGeometries.add(geometry);
    return geometry;
  }

  protected ownMaterial<TMaterial extends THREE.Material>(material: TMaterial): TMaterial {
    this.ownedMaterials.add(material);
    this.baseOpacity.set(material, material.opacity);
    return material;
  }

  protected ownBadge(badge: TextBadge): TextBadge {
    this.badges.add(badge);
    return badge;
  }

  protected markSelectable<TObject extends THREE.Object3D>(object: TObject, role: string): TObject {
    object.userData.entityId = this.entityId;
    object.userData.selectable = true;
    object.userData.role = role;
    this.selectableObjects.push(object);
    return object;
  }

  protected applyStatus(material: THREE.Material, status: EntityStatus): void {
    if ('color' in material && material.color instanceof THREE.Color) {
      material.color.setHex(STATUS_COLORS[status]);
    }
  }

  public update(entity: WorldEntity, view: EntityViewState): void {
    if (this.disposed) throw new Error(`Cannot update disposed visual handle "${this.entityId}".`);
    if (entity.id !== this.entityId) {
      throw new Error(`Visual handle "${this.entityId}" cannot update entity "${entity.id}".`);
    }
    this.currentEntity = entity;
    this.currentView = view;
    const visible = view.visible && view.emphasis !== 'hidden';
    this.root.visible = visible;
    this.root.userData.selectable = visible;
    this.root.scale.setScalar(viewScale(view));
    const opacityFactor = viewOpacity(view);
    for (const material of this.ownedMaterials) {
      const opacity = (this.baseOpacity.get(material) ?? 1) * opacityFactor;
      material.opacity = opacity;
      material.transparent = material.transparent || opacity < 1;
      material.needsUpdate = true;
    }
    for (const badge of this.badges) badge.setOpacity(opacityFactor);
    for (const object of this.selectableObjects) object.userData.selectable = visible;
    this.selectionRing.visible = this.selected && visible;
    this.updateVisual(entity, view);
  }

  protected abstract updateVisual(entity: WorldEntity, view: EntityViewState): void;

  public setSelected(selected: boolean): void {
    if (this.disposed) return;
    this.selected = selected;
    this.selectionRing.visible = selected && this.root.visible;
    this.root.userData.selected = selected;
  }

  protected anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    switch (anchor) {
      case 'label':
        return new THREE.Vector3(0, 1, 0);
      case 'ownership':
        return new THREE.Vector3(-0.55, 0.5, 0);
      case 'placement':
        return new THREE.Vector3(0.55, 0.35, 0);
      case 'control':
        return new THREE.Vector3(0, 0.65, -0.35);
      case 'data-path':
        return new THREE.Vector3(0, 0.35, 0.55);
      case 'composition':
        return new THREE.Vector3(0, 0.35, 0);
      case 'center':
        return new THREE.Vector3();
    }
  }

  public getAnchor(anchor: AnchorKind): THREE.Vector3 {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(this.anchorOffset(anchor));
  }

  protected onDispose(): void {}

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.userData.activeWorld = false;
    this.root.userData.selectable = false;
    for (const object of this.selectableObjects) object.userData.selectable = false;
    this.onDispose();
    for (const badge of this.badges) badge.dispose();
    this.badges.clear();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.root.clear();
    this.root.removeFromParent();
  }
}

export class NodeVisualHandle extends BaseEntityVisualHandle {
  public static readonly footprint = Object.freeze({ width: 5.2, depth: 3.8 });
  private readonly platformMaterial: THREE.MeshStandardMaterial;
  private readonly nameBadge: TextBadge;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 3.05);
    this.root.userData.visualKind = 'node-rack';
    const platformGeometry = this.ownGeometry(
      new THREE.BoxGeometry(
        NodeVisualHandle.footprint.width,
        0.28,
        NodeVisualHandle.footprint.depth,
      ),
    );
    this.platformMaterial = this.ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x183453,
        roughness: 0.62,
        metalness: 0.28,
        transparent: true,
        opacity: 0.84,
      }),
    );
    const platform = this.markSelectable(
      new THREE.Mesh(platformGeometry, this.platformMaterial),
      'node-platform',
    );
    platform.receiveShadow = true;
    platform.position.y = 0.15;
    this.root.add(platform);

    const edgeGeometry = this.ownGeometry(new THREE.EdgesGeometry(platformGeometry));
    const edgeMaterial = this.ownMaterial(
      new THREE.LineBasicMaterial({ color: 0x5eb6ff, transparent: true, opacity: 0.9 }),
    );
    const boundary = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    boundary.position.copy(platform.position);
    boundary.userData.role = 'node-boundary';
    boundary.userData.selectable = false;
    this.root.add(boundary);

    const slotGeometry = this.ownGeometry(new THREE.BoxGeometry(1.72, 0.045, 1.2));
    const slotMaterial = this.ownMaterial(
      new THREE.MeshBasicMaterial({
        color: 0x294d6e,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    );
    const offsets: readonly (readonly [number, number])[] = [
      [-1.22, -0.82],
      [1.22, -0.82],
      [-1.22, 0.82],
      [1.22, 0.82],
    ];
    offsets.forEach(([x, z], slotIndex) => {
      const slot = new THREE.Mesh(slotGeometry, slotMaterial);
      slot.position.set(x, 0.34, z);
      slot.userData.role = 'pod-slot';
      slot.userData.slotIndex = slotIndex;
      slot.userData.selectable = false;
      this.root.add(slot);
    });

    this.nameBadge = this.ownBadge(new TextBadge(2.55, 0.46));
    this.nameBadge.sprite.position.set(0, 0.63, -2.06);
    this.root.add(this.nameBadge.sprite);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.nameBadge.setText(`NODE  ${entity.name}`);
    if (entity.status === 'ready' || entity.status === 'healthy') {
      this.platformMaterial.color.setHex(0x183f53);
    } else {
      this.applyStatus(this.platformMaterial, entity.status);
    }
    this.root.userData.nodeName = entity.name;
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.7, -2.05);
    if (anchor === 'placement') return new THREE.Vector3(0, 0.45, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.45, -1.8);
    return super.anchorOffset(anchor);
  }
}

export class ContainerVisualHandle extends BaseEntityVisualHandle {
  public readonly block: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  private readonly statusBadge: TextBadge;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.48);
    this.root.userData.visualKind = 'container-instance';
    const geometry = this.ownGeometry(new THREE.BoxGeometry(0.72, 0.58, 0.62));
    const material = this.ownMaterial(
      new THREE.MeshStandardMaterial({ color: 0x45c486, roughness: 0.5, metalness: 0.08 }),
    );
    this.block = this.markSelectable(new THREE.Mesh(geometry, material), 'container-block');
    this.block.castShadow = true;
    this.root.add(this.block);
    this.statusBadge = this.ownBadge(new TextBadge(0.75, 0.25, '#ffffff', 'rgba(8,17,31,0.82)'));
    this.statusBadge.sprite.position.set(0, 0.5, 0.02);
    this.root.add(this.statusBadge.sprite);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = getContainerData(entity);
    const failed = entity.status === 'failed' || entity.status === 'terminated';
    const waiting = entity.status === 'waiting' || entity.status === 'pending';
    this.applyStatus(this.block.material, entity.status);
    this.block.scale.set(1, failed ? 0.36 : waiting ? 0.72 : 1, 1);
    this.block.rotation.z = failed ? -0.18 : 0;
    this.statusBadge.setText(`${STATUS_GLYPHS[entity.status]} ${entity.status.toUpperCase()}`);
    this.root.userData.podId = data.podId;
    this.root.userData.restartCount = data.restartCount;
    this.root.userData.instanceGeneration = data.instanceGeneration;
    this.block.userData.instanceGeneration = data.instanceGeneration;
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'composition') return new THREE.Vector3(0, 0.18, 0);
    if (anchor === 'label') return new THREE.Vector3(0, 0.62, 0);
    return super.anchorOffset(anchor);
  }
}

export class PodVisualHandle extends BaseEntityVisualHandle {
  public readonly shell: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  public readonly containerBay = new THREE.Group();
  private readonly shellEdges: THREE.LineSegments;
  private readonly statusStrip: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
  private readonly statusBadge: TextBadge;
  private readonly uidBadge: TextBadge;
  private readonly nodeBadge: TextBadge;
  private readonly phaseBadge: TextBadge;
  private readonly restartBadge: TextBadge;
  private readonly metadataCard = new THREE.Group();
  private readonly containers = new Map<EntityId, ContainerVisualHandle>();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.1);
    this.root.userData.visualKind = 'pod-shell';
    const shellGeometry = this.ownGeometry(new THREE.BoxGeometry(1.72, 1.42, 1.3));
    const shellMaterial = this.ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x5eb6ff,
        roughness: 0.42,
        metalness: 0.12,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
      }),
    );
    this.shell = this.markSelectable(new THREE.Mesh(shellGeometry, shellMaterial), 'pod-shell');
    this.shell.position.y = 0.82;
    this.root.add(this.shell);

    const edgeGeometry = this.ownGeometry(new THREE.EdgesGeometry(shellGeometry));
    const edgeMaterial = this.ownMaterial(
      new THREE.LineBasicMaterial({ color: 0x8bd3ff, transparent: true, opacity: 0.92 }),
    );
    this.shellEdges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    this.shellEdges.position.copy(this.shell.position);
    this.shellEdges.userData.role = 'pod-shell-outline';
    this.root.add(this.shellEdges);

    const bayGeometry = this.ownGeometry(new THREE.BoxGeometry(1.38, 0.06, 0.96));
    const bayMaterial = this.ownMaterial(
      new THREE.MeshBasicMaterial({ color: 0x142a42, transparent: true, opacity: 0.82 }),
    );
    const bay = new THREE.Mesh(bayGeometry, bayMaterial);
    bay.userData.role = 'container-bay';
    bay.userData.selectable = false;
    bay.position.y = 0.34;
    this.root.add(bay);
    this.containerBay.name = 'container-bay-contents';
    this.containerBay.position.y = 0.69;
    this.root.add(this.containerBay);

    const stripGeometry = this.ownGeometry(new THREE.BoxGeometry(1.55, 0.12, 0.08));
    const stripMaterial = this.ownMaterial(new THREE.MeshBasicMaterial({ color: 0x45c486 }));
    this.statusStrip = new THREE.Mesh(stripGeometry, stripMaterial);
    this.statusStrip.position.set(0, 1.47, 0.65);
    this.statusStrip.userData.role = 'status-strip';
    this.root.add(this.statusStrip);

    this.statusBadge = this.ownBadge(new TextBadge(1.18, 0.29));
    this.statusBadge.sprite.position.set(0, 1.68, 0.08);
    this.root.add(this.statusBadge.sprite);

    const cardGeometry = this.ownGeometry(new THREE.BoxGeometry(2.72, 1.46, 0.06));
    const cardMaterial = this.ownMaterial(
      new THREE.MeshBasicMaterial({ color: 0x08111f, transparent: true, opacity: 0.92 }),
    );
    const card = new THREE.Mesh(cardGeometry, cardMaterial);
    card.userData.role = 'pod-metadata-card';
    card.userData.selectable = false;
    this.metadataCard.position.set(0, 1.05, 1.08);
    this.metadataCard.add(card);
    this.root.add(this.metadataCard);

    this.uidBadge = this.addMetadataBadge(-0.45);
    this.nodeBadge = this.addMetadataBadge(-0.15);
    this.phaseBadge = this.addMetadataBadge(0.15);
    this.restartBadge = this.addMetadataBadge(0.45);
    this.update(entity, view);
  }

  private addMetadataBadge(y: number): TextBadge {
    const badge = this.ownBadge(new TextBadge(2.48, 0.25));
    badge.sprite.position.set(0, y, 0.05);
    this.metadataCard.add(badge.sprite);
    return badge;
  }

  public attachContainer(handle: ContainerVisualHandle): void {
    if (this.isDisposed || handle.isDisposed) return;
    const data = getContainerData(handle.entity);
    if (data.podId !== this.entityId) {
      throw new Error(
        `Container "${handle.entityId}" belongs to "${data.podId}", not "${this.entityId}".`,
      );
    }
    this.containers.set(handle.entityId, handle);
    this.containerBay.add(handle.root);
    handle.root.userData.composedInPod = this.entityId;
    this.layoutContainers();
    this.refreshRestartBadge();
  }

  public detachContainer(containerId: EntityId): void {
    const handle = this.containers.get(containerId);
    if (!handle) return;
    handle.root.removeFromParent();
    delete handle.root.userData.composedInPod;
    this.containers.delete(containerId);
    this.layoutContainers();
    this.refreshRestartBadge();
  }

  public hasContainer(containerId: EntityId): boolean {
    return this.containers.has(containerId);
  }

  private layoutContainers(): void {
    const handles = [...this.containers.values()].sort((left, right) =>
      left.entityId.localeCompare(right.entityId),
    );
    const center = (handles.length - 1) / 2;
    handles.forEach((handle, index) => {
      handle.root.position.set((index - center) * 0.76, 0, 0);
    });
  }

  private refreshRestartBadge(): void {
    const count = [...this.containers.values()].reduce(
      (total, handle) => total + getContainerData(handle.entity).restartCount,
      0,
    );
    this.restartBadge.setText(`RESTARTS  ${count}`);
    this.root.userData.restartCount = count;
  }

  protected override updateVisual(entity: WorldEntity, view: EntityViewState): void {
    const data = getPodData(entity);
    this.applyStatus(this.statusStrip.material, entity.status);
    const outlineMaterial = this.shellEdges.material;
    if (outlineMaterial instanceof THREE.LineBasicMaterial) {
      outlineMaterial.color.setHex(STATUS_COLORS[entity.status]);
    }
    this.statusBadge.setText(`${STATUS_GLYPHS[entity.status]} POD ${data.phase.toUpperCase()}`);
    this.uidBadge.setText(`UID  ${data.uid}`);
    this.nodeBadge.setText(`NODE  ${data.nodeName ?? 'Unscheduled'}`);
    this.phaseBadge.setText(`PHASE  ${data.phase}`);
    this.metadataCard.visible =
      view.emphasis === 'focused' ||
      view.inspectorMode === 'compact' ||
      view.inspectorMode === 'expanded';
    this.root.userData.uid = data.uid;
    this.root.userData.nodeName = data.nodeName ?? null;
    this.root.userData.phase = data.phase;
    this.refreshRestartBadge();
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.9, 0);
    if (anchor === 'ownership') return new THREE.Vector3(-0.86, 1, 0);
    if (anchor === 'placement') return new THREE.Vector3(0.86, 0.55, 0);
    if (anchor === 'composition') return new THREE.Vector3(0, 0.72, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 1.25, -0.65);
    if (anchor === 'data-path') return new THREE.Vector3(0, 0.85, 0.65);
    return super.anchorOffset(anchor);
  }

  protected override onDispose(): void {
    for (const handle of this.containers.values()) {
      handle.root.removeFromParent();
      delete handle.root.userData.composedInPod;
    }
    this.containers.clear();
  }
}

export class ReplicaSetVisualHandle extends BaseEntityVisualHandle {
  private readonly plateMaterial: THREE.MeshStandardMaterial;
  private readonly titleBadge: TextBadge;
  private readonly desiredBadge: TextBadge;
  private readonly currentBadge: TextBadge;
  private readonly readyBadge: TextBadge;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.55);
    this.root.userData.visualKind = 'replicaset-counter';
    const geometry = this.ownGeometry(new THREE.BoxGeometry(2.55, 1.75, 0.48));
    this.plateMaterial = this.ownMaterial(
      new THREE.MeshStandardMaterial({ color: 0x563f82, roughness: 0.52, metalness: 0.14 }),
    );
    const plate = this.markSelectable(
      new THREE.Mesh(geometry, this.plateMaterial),
      'replicaset-card',
    );
    plate.position.y = 0.9;
    plate.castShadow = true;
    this.root.add(plate);
    this.titleBadge = this.addBadge(1.48, 2.08);
    this.desiredBadge = this.addBadge(1.12, 1.96);
    this.currentBadge = this.addBadge(0.78, 1.96);
    this.readyBadge = this.addBadge(0.44, 1.96);
    this.update(entity, view);
  }

  private addBadge(y: number, width: number): TextBadge {
    const badge = this.ownBadge(new TextBadge(width, 0.3));
    badge.sprite.position.set(0, y, 0.27);
    this.root.add(badge.sprite);
    return badge;
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = getReplicaSetData(entity);
    this.titleBadge.setText(`REPLICASET  ${entity.name}`);
    this.desiredBadge.setText(`DESIRED  ${data.desiredReplicas}`);
    this.currentBadge.setText(`CURRENT  ${data.currentReplicas}`);
    this.readyBadge.setText(`READY  ${data.readyReplicas}`);
    this.root.userData.counters = Object.freeze({
      desired: data.desiredReplicas,
      current: data.currentReplicas,
      ready: data.readyReplicas,
    });
    this.plateMaterial.color.setHex(0x563f82);
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.7, 0);
    if (anchor === 'ownership') return new THREE.Vector3(1.3, 0.9, 0);
    if (anchor === 'control') return new THREE.Vector3(-1.3, 0.9, 0);
    return super.anchorOffset(anchor);
  }
}

abstract class ComponentVisualHandle extends BaseEntityVisualHandle {
  protected readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly labelBadge: TextBadge;

  protected constructor(
    entity: WorldEntity,
    view: EntityViewState,
    visualKind: string,
    geometry: THREE.BufferGeometry,
    color: number,
  ) {
    super(entity, view, 0.82);
    this.root.userData.visualKind = visualKind;
    const ownedGeometry = this.ownGeometry(geometry);
    this.bodyMaterial = this.ownMaterial(
      new THREE.MeshStandardMaterial({ color, roughness: 0.46, metalness: 0.2 }),
    );
    const body = this.markSelectable(new THREE.Mesh(ownedGeometry, this.bodyMaterial), visualKind);
    body.position.y = 0.55;
    body.castShadow = true;
    this.root.add(body);
    this.labelBadge = this.ownBadge(new TextBadge(1.8, 0.3));
    this.labelBadge.sprite.position.set(0, 1.34, 0);
    this.root.add(this.labelBadge.sprite);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.labelBadge.setText(entity.name.toUpperCase());
    this.root.userData.status = entity.status;
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.45, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.68, 0);
    return super.anchorOffset(anchor);
  }
}

export class KubeletVisualHandle extends ComponentVisualHandle {
  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 'kubelet-agent', new THREE.BoxGeometry(1.18, 0.86, 0.66), 0x4aa3df);
    const pulseGeometry = this.ownGeometry(new THREE.BoxGeometry(0.1, 0.32, 0.72));
    const pulseMaterial = this.ownMaterial(new THREE.MeshBasicMaterial({ color: 0x8bd3ff }));
    for (let index = 0; index < 3; index += 1) {
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.set(-0.3 + index * 0.3, 0.55, 0.36);
      pulse.scale.y = 0.45 + index * 0.25;
      pulse.userData.role = 'kubelet-heartbeat';
      this.root.add(pulse);
    }
  }
}

export class ControllerManagerVisualHandle extends ComponentVisualHandle {
  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(
      entity,
      view,
      'controller-manager',
      new THREE.TorusKnotGeometry(0.42, 0.15, 48, 8),
      0xb792ff,
    );
  }
}

export class SchedulerVisualHandle extends ComponentVisualHandle {
  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 'scheduler', new THREE.ConeGeometry(0.58, 1.05, 5), 0x45d6d0);
  }
}

export class GenericVisualHandle extends BaseEntityVisualHandle {
  private readonly material: THREE.MeshStandardMaterial;
  private readonly badge: TextBadge;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.75);
    this.root.userData.visualKind = 'generic-fallback';
    this.root.userData.genericVisual = true;
    const geometry = this.ownGeometry(new THREE.OctahedronGeometry(0.62));
    this.material = this.ownMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x7f8b99,
        roughness: 0.75,
        wireframe: true,
      }),
    );
    const mesh = this.markSelectable(new THREE.Mesh(geometry, this.material), 'generic-fallback');
    mesh.position.y = 0.62;
    this.root.add(mesh);
    this.badge = this.ownBadge(new TextBadge(1.9, 0.32, '#ffd891', 'rgba(40,24,8,0.92)'));
    this.badge.sprite.position.set(0, 1.42, 0);
    this.root.add(this.badge.sprite);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.badge.setText(`? GENERIC ${entity.kind}`);
    this.applyStatus(this.material, entity.status);
  }
}
