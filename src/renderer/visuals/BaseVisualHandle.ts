import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { EntityId, EntityStatus, WorldEntity } from '../../world/types';
import { emphasisEmissiveIntensity, emphasisOpacity, emphasisScale } from '../design/effects';
import { palette, statusColor } from '../design/palette';

export const ROUTE_ANCHOR_KINDS = [
  'api-in',
  'api-out',
  'control',
  'network-in',
  'network-out',
  'storage',
  'ownership',
  'placement',
  'local-runtime',
  'top',
  'bottom',
  'left',
  'right',
] as const;

export const ANCHOR_KINDS = ['center', 'label', 'composition', ...ROUTE_ANCHOR_KINDS] as const;

export type AnchorKind = (typeof ANCHOR_KINDS)[number];

export interface VisualContext {
  /** Unsupported entities may use the visibly marked fallback only outside verified lessons. */
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
  getWorldBounds?(target?: THREE.Box3): THREE.Box3;
  dispose(): void;
}

interface MaterialBaseline {
  readonly opacity: number;
  readonly transparent: boolean;
  readonly emissiveIntensity: number;
}

const materialEmissiveIntensity = (material: THREE.Material): number =>
  material instanceof THREE.MeshStandardMaterial && material.emissive.getHex() !== 0
    ? material.emissiveIntensity
    : 0;

const MIN_FOCUS_HALO_RADIUS = 0.42;
const MAX_FOCUS_HALO_RADIUS = 1.22;
const FOCUS_HALO_RADIUS_FACTOR = 0.55;
const FOCUS_HALO_RENDER_ORDER = 1;

/**
 * Owns all per-entity GPU resources. The content group intentionally excludes focus effects so
 * camera framing and route obstacles use the teaching object rather than its selection halo.
 */
export abstract class BaseVisualHandle implements EntityVisualHandle {
  public readonly entityId: EntityId;
  public readonly root = new THREE.Group();
  public readonly selectableObjects: THREE.Object3D[] = [];
  protected readonly content = new THREE.Group();
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly materialBaselines = new Map<THREE.Material, MaterialBaseline>();
  private readonly focusHalo: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> | null;
  private currentEntity: WorldEntity;
  private currentView: EntityViewState;
  private disposed = false;
  private selected = false;

  protected constructor(entity: WorldEntity, view: EntityViewState, focusRadius: number) {
    this.entityId = entity.id;
    this.currentEntity = entity;
    this.currentView = view;
    this.root.name = `entity:${entity.id}`;
    this.root.userData.entityId = entity.id;
    this.root.userData.activeWorld = true;
    this.root.userData.selectable = true;
    this.root.add(this.content);

    if (focusRadius > 0) {
      const haloRadius = THREE.MathUtils.clamp(
        focusRadius * FOCUS_HALO_RADIUS_FACTOR,
        MIN_FOCUS_HALO_RADIUS,
        MAX_FOCUS_HALO_RADIUS,
      );
      const focusGeometry = this.ownGeometry(new THREE.CircleGeometry(haloRadius, 40));
      const focusMaterial = this.ownMaterial(
        new THREE.MeshBasicMaterial({
          color: palette.focus,
          transparent: true,
          opacity: 0.18,
          depthTest: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        }),
      );
      this.focusHalo = new THREE.Mesh(focusGeometry, focusMaterial);
      this.focusHalo.name = 'focus-halo';
      this.focusHalo.rotation.x = -Math.PI / 2;
      this.focusHalo.position.y = 0.035;
      this.focusHalo.renderOrder = FOCUS_HALO_RENDER_ORDER;
      this.focusHalo.visible = false;
      this.focusHalo.userData.role = 'focus-halo';
      this.focusHalo.userData.excludeFromBounds = true;
      this.focusHalo.userData.selectable = false;
      this.root.add(this.focusHalo);
    } else {
      this.focusHalo = null;
    }
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
    this.materialBaselines.set(material, {
      opacity: material.opacity,
      transparent: material.transparent,
      emissiveIntensity: materialEmissiveIntensity(material),
    });
    return material;
  }

  protected markSelectable<TObject extends THREE.Object3D>(object: TObject, role: string): TObject {
    object.userData.entityId = this.entityId;
    object.userData.role = role;
    object.userData.selectable = true;
    this.selectableObjects.push(object);
    return object;
  }

  protected addContent(...objects: readonly THREE.Object3D[]): void {
    this.content.add(...objects);
  }

  protected applyStatusColor(
    material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial,
    status: EntityStatus,
  ): void {
    material.color.setHex(statusColor(status));
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
    this.root.userData.emphasis = view.emphasis;
    this.root.userData.labelMode = view.labelMode;
    this.root.userData.status = entity.status;
    this.root.scale.setScalar(emphasisScale(view.emphasis));

    const opacityFactor = emphasisOpacity(view.emphasis);
    const emissive = emphasisEmissiveIntensity(view.emphasis);
    for (const material of this.ownedMaterials) {
      const baseline = this.materialBaselines.get(material);
      if (!baseline) continue;
      material.opacity = baseline.opacity * opacityFactor;
      material.transparent = baseline.transparent || opacityFactor < 1;
      if (material instanceof THREE.MeshStandardMaterial) {
        material.emissive.setHex(statusColor(entity.status));
        material.emissiveIntensity = Math.max(baseline.emissiveIntensity, emissive);
      }
      material.needsUpdate = true;
    }
    for (const object of this.selectableObjects) object.userData.selectable = visible;
    this.updateVisual(entity, view);
    this.refreshFocus();
  }

  protected abstract updateVisual(entity: WorldEntity, view: EntityViewState): void;

  public setSelected(selected: boolean): void {
    if (this.disposed) return;
    this.selected = selected;
    this.root.userData.selected = selected;
    this.refreshFocus();
  }

  private refreshFocus(): void {
    if (!this.focusHalo) return;
    this.focusHalo.visible =
      this.root.visible && (this.selected || this.currentView.emphasis === 'focused');
  }

  protected anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    switch (anchor) {
      case 'label':
        return new THREE.Vector3(0, 1, 0);
      case 'api-in':
        return new THREE.Vector3(-0.55, 0.55, 0);
      case 'api-out':
        return new THREE.Vector3(0.55, 0.55, 0);
      case 'ownership':
        return new THREE.Vector3(-0.55, 0.5, 0);
      case 'placement':
        return new THREE.Vector3(0.55, 0.35, 0);
      case 'control':
        return new THREE.Vector3(0, 0.65, -0.35);
      case 'network-in':
        return new THREE.Vector3(-0.55, 0.35, 0.55);
      case 'network-out':
        return new THREE.Vector3(0.55, 0.35, 0.55);
      case 'storage':
        return new THREE.Vector3(0.55, 0.3, -0.25);
      case 'local-runtime':
        return new THREE.Vector3(0, 0.22, -0.55);
      case 'top':
        return new THREE.Vector3(0, 1, 0);
      case 'bottom':
        return new THREE.Vector3(0, 0, 0);
      case 'left':
        return new THREE.Vector3(-0.65, 0.4, 0);
      case 'right':
        return new THREE.Vector3(0.65, 0.4, 0);
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

  public getWorldBounds(target: THREE.Box3 = new THREE.Box3()): THREE.Box3 {
    this.content.updateWorldMatrix(true, true);
    target.makeEmpty();
    const objectBounds = new THREE.Box3();
    this.content.traverseVisible((object) => {
      if (object.userData.excludeFromBounds === true) return;
      const geometry = (object as THREE.Mesh | THREE.Line | THREE.Points).geometry;
      if (!(geometry instanceof THREE.BufferGeometry)) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      if (!geometry.boundingBox) return;
      objectBounds.copy(geometry.boundingBox).applyMatrix4(object.matrixWorld);
      target.union(objectBounds);
    });
    return target;
  }

  protected onDispose(): void {}

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.userData.activeWorld = false;
    this.root.userData.selectable = false;
    for (const object of this.selectableObjects) object.userData.selectable = false;
    this.onDispose();
    for (const geometry of this.ownedGeometries) geometry.dispose();
    for (const material of this.ownedMaterials) material.dispose();
    this.ownedGeometries.clear();
    this.ownedMaterials.clear();
    this.materialBaselines.clear();
    this.root.clear();
    this.root.removeFromParent();
  }
}
