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

const listenerText = (entity: WorldEntity): string => {
  const address =
    typeof entity.data.listenerAddress === 'string' ? entity.data.listenerAddress : '?';
  const port =
    typeof entity.data.listenerPort === 'number' ? String(entity.data.listenerPort) : '?';
  const protocol = typeof entity.data.protocol === 'string' ? entity.data.protocol : 'HTTPS';
  return `${protocol} ${address}:${port}`;
};

/** A packet-processing ingress plane, explicitly separate from Gateway and HTTPRoute API cards. */
export class GatewayDataPlaneVisualHandle extends BaseVisualHandle {
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.02);
    this.root.userData.visualKind = 'gateway-data-plane';
    this.root.userData.dataPlane = true;
    this.root.userData.configurationObject = false;
    this.root.userData.applicationPacketHop = true;

    const foundationGeometry = this.ownGeometry(
      createRoundedBoxGeometry(3.18, 0.28, 2.28, 0.22, 5),
    );
    const foundationMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x22354c, roughness: 0.52, metalness: 0.16 }),
    );
    const foundation = this.markSelectable(
      new THREE.Mesh(foundationGeometry, foundationMaterial),
      'gateway-data-plane-foundation',
    );
    foundation.position.y = 0.14;
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    this.addContent(foundation);

    const towerGeometry = this.ownGeometry(createRoundedBoxGeometry(0.62, 1.56, 0.68, 0.14, 4));
    this.bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x234f69, roughness: 0.39, metalness: 0.18 }),
    );
    for (const x of [-1.02, 1.02]) {
      const tower = this.markSelectable(
        new THREE.Mesh(towerGeometry, this.bodyMaterial),
        'gateway-data-plane-tower',
      );
      tower.position.set(x, 0.93, 0);
      tower.castShadow = true;
      this.addContent(tower);
    }

    const bridgeGeometry = this.ownGeometry(createRoundedBoxGeometry(2.58, 0.42, 0.68, 0.14, 4));
    const bridge = this.markSelectable(
      new THREE.Mesh(bridgeGeometry, this.bodyMaterial),
      'gateway-data-plane-bridge',
    );
    bridge.position.y = 1.5;
    bridge.castShadow = true;
    this.addContent(bridge);

    const apertureGeometry = this.ownGeometry(createRoundedBoxGeometry(1.16, 1.02, 0.12, 0.18, 5));
    const apertureMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.01 }),
    );
    const aperture = new THREE.Mesh(apertureGeometry, apertureMaterial);
    aperture.position.set(0, 0.72, 0.36);
    aperture.userData.role = 'gateway-data-plane-packet-aperture';
    this.addContent(aperture);

    const flowMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.96));
    const directionGeometry = this.ownGeometry(new THREE.ConeGeometry(0.18, 0.46, 20));
    for (const x of [-0.46, 0, 0.46]) {
      const arrow = new THREE.Mesh(directionGeometry, flowMaterial);
      arrow.position.set(x, 0.72, 0.47);
      arrow.rotation.z = -Math.PI / 2;
      arrow.userData.role = 'gateway-data-plane-forward-arrow';
      this.addContent(arrow);
    }

    const listenerGeometry = this.ownGeometry(createRoundedBoxGeometry(2.1, 0.12, 0.11, 0.045));
    const listener = new THREE.Mesh(listenerGeometry, flowMaterial);
    listener.position.set(0, 1.76, 0.38);
    listener.userData.role = 'gateway-data-plane-listener';
    this.addContent(listener);

    const portGeometry = this.ownGeometry(new THREE.TorusGeometry(0.19, 0.055, 8, 24));
    for (const x of [-1.56, 1.56]) {
      const port = new THREE.Mesh(portGeometry, flowMaterial);
      port.position.set(x, 0.72, 0);
      port.rotation.y = Math.PI / 2;
      port.userData.role = x < 0 ? 'gateway-data-plane-ingress' : 'gateway-data-plane-egress';
      this.addContent(port);
    }

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(1.25, 1.72, 0.43);
    status.userData.role = 'gateway-data-plane-status';
    this.addContent(status);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const listener = listenerText(entity);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.bodyMaterial.color.setHex(entity.status === 'failed' ? 0x563449 : 0x234f69);
    this.root.userData.listener = listener;
    this.root.userData.gatewayRef =
      typeof entity.data.gatewayRef === 'string' ? entity.data.gatewayRef : null;
    this.root.userData.visibleText = listener;
    this.root.userData.shortLabel = 'Gateway data plane';
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Gateway data plane · ${listener}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 2.2, 0);
    if (anchor === 'network-in' || anchor === 'left') return new THREE.Vector3(-1.72, 0.74, 0);
    if (anchor === 'network-out' || anchor === 'right') return new THREE.Vector3(1.72, 0.74, 0);
    if (anchor === 'control' || anchor === 'api-in') return new THREE.Vector3(0, 1.68, -0.52);
    return super.anchorOffset(anchor);
  }
}
