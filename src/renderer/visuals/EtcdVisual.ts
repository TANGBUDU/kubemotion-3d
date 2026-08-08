import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import {
  applyMaterialStatus,
  createFlatAccentMaterial,
  createSurfaceMaterial,
} from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

const STORAGE_CELL_COUNT = 3;
const STORAGE_TIERS = 3;

/** Compact replicated storage cells, intentionally unlike the API Server gateway silhouette. */
export class EtcdVisualHandle extends BaseVisualHandle {
  private readonly storageMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.55);
    this.root.userData.visualKind = 'etcd-storage-cells';
    this.root.userData.storageCellCount = STORAGE_CELL_COUNT;
    this.root.userData.apiAccess = 'api-server-only-basic-model';

    const plinthGeometry = this.ownGeometry(createRoundedBoxGeometry(2.62, 0.24, 1.5, 0.16, 4));
    const plinthMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.58, metalness: 0.12 }),
    );
    const plinth = this.markSelectable(
      new THREE.Mesh(plinthGeometry, plinthMaterial),
      'etcd-storage-plinth',
    );
    plinth.position.y = 0.12;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.addContent(plinth);

    const cellGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.3, 0.3, 0.17, 24));
    this.storageMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x26745f, roughness: 0.42, metalness: 0.12 }),
    );
    for (let column = 0; column < STORAGE_CELL_COUNT; column += 1) {
      const storageColumn = new THREE.Group();
      storageColumn.position.set(-0.72 + column * 0.72, 0, 0);
      storageColumn.userData.role = 'etcd-storage-column';
      storageColumn.userData.replicaIndex = column;
      for (let tier = 0; tier < STORAGE_TIERS; tier += 1) {
        const cell = new THREE.Mesh(cellGeometry, this.storageMaterial);
        cell.position.y = 0.34 + tier * 0.18;
        cell.castShadow = true;
        cell.userData.role = 'etcd-storage-cell';
        cell.userData.tier = tier;
        storageColumn.add(cell);
      }
      this.addContent(storageColumn);
    }

    const linkGeometry = this.ownGeometry(new THREE.BoxGeometry(0.42, 0.045, 0.06));
    const linkMaterial = this.ownMaterial(createFlatAccentMaterial(palette.storage, 0.9));
    for (const x of [-0.36, 0.36]) {
      const link = new THREE.Mesh(linkGeometry, linkMaterial);
      link.position.set(x, 0.88, 0);
      link.userData.role = 'etcd-replication-link';
      this.addContent(link);
    }

    const portGeometry = this.ownGeometry(createRoundedBoxGeometry(0.22, 0.22, 0.38, 0.06));
    const portMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.94));
    const apiPort = new THREE.Mesh(portGeometry, portMaterial);
    apiPort.position.set(-1.31, 0.42, 0);
    apiPort.userData.role = 'etcd-api-server-port';
    this.addContent(apiPort);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.085, 0.085, 0.055, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(1.02, 0.3, 0.6);
    status.userData.role = 'etcd-status';
    this.addContent(status);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.storageMaterial.color.setHex(entity.status === 'failed' ? 0x66434b : 0x26745f);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'etcd';
    this.root.userData.statusText = entity.status.toUpperCase();
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'etcd · API DATA STORE',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.22, 0);
    if (anchor === 'control' || anchor === 'api-in') return new THREE.Vector3(-1.31, 0.42, 0);
    if (anchor === 'api-out' || anchor === 'storage') return new THREE.Vector3(1.31, 0.42, 0);
    return super.anchorOffset(anchor);
  }
}
