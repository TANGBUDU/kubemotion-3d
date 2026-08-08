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

const firstString = (entity: WorldEntity, keys: readonly string[]): string | undefined => {
  for (const key of keys) {
    const value = entity.data[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
};

/** An external browser terminal, deliberately unrelated to Pod runtime anatomy. */
export class ExternalClientVisualHandle extends BaseVisualHandle {
  private readonly frameMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.65);
    this.root.userData.visualKind = 'external-client-browser-terminal';
    this.root.userData.externalActor = true;
    this.root.userData.outsideCluster = true;

    const baseGeometry = this.ownGeometry(createRoundedBoxGeometry(2.7, 0.24, 1.36, 0.17, 4));
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x24364a, roughness: 0.54, metalness: 0.12 }),
    );
    const base = this.markSelectable(
      new THREE.Mesh(baseGeometry, baseMaterial),
      'external-client-terminal-base',
    );
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const standGeometry = this.ownGeometry(createRoundedBoxGeometry(0.34, 0.7, 0.3, 0.07));
    const stand = new THREE.Mesh(standGeometry, baseMaterial);
    stand.position.set(0, 0.58, -0.2);
    stand.userData.role = 'external-client-monitor-stand';
    stand.castShadow = true;
    this.addContent(stand);

    const frameGeometry = this.ownGeometry(createRoundedBoxGeometry(2.42, 1.5, 0.24, 0.16, 5));
    this.frameMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x2c4359, roughness: 0.43, metalness: 0.16 }),
    );
    const frame = this.markSelectable(
      new THREE.Mesh(frameGeometry, this.frameMaterial),
      'external-client-browser-frame',
    );
    frame.position.set(0, 1.32, 0);
    frame.castShadow = true;
    this.addContent(frame);

    const screenGeometry = this.ownGeometry(createRoundedBoxGeometry(2.1, 1.16, 0.075, 0.11));
    const screenMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.75, metalness: 0.01 }),
    );
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 1.28, 0.145);
    screen.userData.role = 'external-client-browser-screen';
    this.addContent(screen);

    const addressGeometry = this.ownGeometry(createRoundedBoxGeometry(1.62, 0.13, 0.035, 0.05));
    const addressMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x49647d, roughness: 0.5, metalness: 0.04 }),
    );
    const addressRail = new THREE.Mesh(addressGeometry, addressMaterial);
    addressRail.position.set(0.12, 1.67, 0.202);
    addressRail.userData.role = 'external-client-address-rail';
    this.addContent(addressRail);

    const chromeMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.92));
    const chromeGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 14));
    for (let index = 0; index < 3; index += 1) {
      const marker = new THREE.Mesh(chromeGeometry, chromeMaterial);
      marker.rotation.x = Math.PI / 2;
      marker.position.set(-0.82 + index * 0.14, 1.67, 0.208);
      marker.userData.role = 'external-client-browser-control';
      this.addContent(marker);
    }

    const contentGeometry = this.ownGeometry(new THREE.BoxGeometry(1.28, 0.055, 0.035));
    for (let index = 0; index < 3; index += 1) {
      const contentRail = new THREE.Mesh(contentGeometry, chromeMaterial);
      contentRail.position.set(-0.16, 1.42 - index * 0.24, 0.205);
      contentRail.scale.x = 1 - index * 0.2;
      contentRail.userData.role = 'external-client-page-rail';
      this.addContent(contentRail);
    }

    const requestPortGeometry = this.ownGeometry(new THREE.TorusGeometry(0.17, 0.045, 8, 22));
    const requestPort = new THREE.Mesh(requestPortGeometry, chromeMaterial);
    requestPort.position.set(1.25, 1.18, 0.02);
    requestPort.rotation.y = Math.PI / 2;
    requestPort.userData.role = 'external-client-request-port';
    this.addContent(requestPort);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(1.02, 1.78, 0.13);
    status.userData.role = 'external-client-status';
    this.addContent(status);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const actorType = entity.kind === 'Browser' ? 'browser' : 'external-client';
    const label = actorType === 'browser' ? 'Browser' : 'External client';
    const address =
      firstString(entity, ['url', 'requestUrl', 'address', 'host']) ?? 'synthetic://request';
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.frameMaterial.color.setHex(entity.status === 'failed' ? 0x533344 : 0x2c4359);

    this.root.userData.actorType = actorType;
    this.root.userData.address = address;
    this.root.userData.requestTarget =
      firstString(entity, ['requestTarget', 'serviceName', 'target']) ?? null;
    this.root.userData.statusText = entity.status.toUpperCase();
    this.root.userData.shortLabel = `${label} · ${shortResourceName(entity.name, 14)}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `${label} · ${shortResourceName(entity.name, 14)}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 2.28, 0);
    if (anchor === 'data-path') return new THREE.Vector3(1.42, 1.18, 0);
    if (anchor === 'control') return new THREE.Vector3(1.42, 1.18, 0);
    return super.anchorOffset(anchor);
  }
}
