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
import { shortResourceName } from '../design/typography';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

const textField = (entity: WorldEntity, key: string, fallback: string): string => {
  const value = entity.data[key];
  return typeof value === 'string' && value.length > 0 ? value : fallback;
};

/** Public DNS is a DNS support system, never part of the later HTTP data path. */
export class PublicDNSVisualHandle extends BaseVisualHandle {
  private readonly statusMaterial: THREE.MeshBasicMaterial;
  private readonly resolverMaterial: THREE.MeshStandardMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.72);
    this.root.userData.visualKind = 'public-dns-resolver';
    this.root.userData.dnsDataPlane = true;
    this.root.userData.applicationPacketHop = false;
    this.root.userData.outsideCluster = true;

    const baseGeometry = this.ownGeometry(createRoundedBoxGeometry(2.68, 0.24, 1.84, 0.18, 4));
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x183847, roughness: 0.54, metalness: 0.11 }),
    );
    const base = this.markSelectable(new THREE.Mesh(baseGeometry, baseMaterial), 'public-dns-base');
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const resolverGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.78, 0.92, 0.74, 30));
    this.resolverMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x205165, roughness: 0.39, metalness: 0.16 }),
    );
    const resolver = this.markSelectable(
      new THREE.Mesh(resolverGeometry, this.resolverMaterial),
      'public-dns-resolver-stack',
    );
    resolver.position.y = 0.59;
    resolver.castShadow = true;
    this.addContent(resolver);

    const dnsMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dnsFlow, 0.94));
    const orbitGeometry = this.ownGeometry(new THREE.TorusGeometry(0.94, 0.075, 10, 36));
    for (const [index, tilt] of [0, Math.PI / 3, -Math.PI / 3].entries()) {
      const orbit = new THREE.Mesh(orbitGeometry, dnsMaterial);
      orbit.position.y = 0.94;
      orbit.rotation.set(Math.PI / 2, tilt, 0);
      orbit.userData.role = 'public-dns-resolution-orbit';
      orbit.userData.orbitIndex = index;
      this.addContent(orbit);
    }

    const recordGeometry = this.ownGeometry(createRoundedBoxGeometry(1.46, 0.12, 0.22, 0.045));
    const recordMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x3a7080, roughness: 0.5, metalness: 0.04 }),
    );
    for (let index = 0; index < 3; index += 1) {
      const record = new THREE.Mesh(recordGeometry, recordMaterial);
      record.position.set(0, 0.43 + index * 0.18, 0.86);
      record.scale.x = 1 - index * 0.16;
      record.userData.role = 'public-dns-record-row';
      this.addContent(record);
    }

    const portGeometry = this.ownGeometry(new THREE.TorusGeometry(0.16, 0.045, 8, 22));
    for (const x of [-1.18, 1.18]) {
      const port = new THREE.Mesh(portGeometry, dnsMaterial);
      port.position.set(x, 0.68, 0);
      port.rotation.y = Math.PI / 2;
      port.userData.role = x < 0 ? 'public-dns-query-port' : 'public-dns-response-port';
      this.addContent(port);
    }

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.08, 0.08, 0.045, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(1.02, 1.14, 0.56);
    status.userData.role = 'public-dns-status';
    this.addContent(status);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const queryName = textField(entity, 'queryName', 'shop.example');
    const answer = textField(entity, 'answer', '203.0.113.80');
    const recordType = textField(entity, 'recordType', 'A');
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.resolverMaterial.color.setHex(entity.status === 'failed' ? 0x533344 : 0x205165);
    this.root.userData.queryName = queryName;
    this.root.userData.answer = answer;
    this.root.userData.recordType = recordType;
    this.root.userData.syntheticAnswer = entity.data.syntheticAddress === true;
    this.root.userData.visibleText = `${queryName} ${recordType} ${answer}`;
    this.root.userData.shortLabel = `Public DNS · ${shortResourceName(queryName, 18)}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Public DNS · ${shortResourceName(queryName, 16)}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.52, 0);
    if (anchor === 'network-in' || anchor === 'left') return new THREE.Vector3(-1.34, 0.7, 0);
    if (anchor === 'network-out' || anchor === 'right') return new THREE.Vector3(1.34, 0.7, 0);
    return super.anchorOffset(anchor);
  }
}
