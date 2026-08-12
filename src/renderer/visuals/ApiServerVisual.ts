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

export const API_SERVER_CONTROL_PORTS = [
  'client',
  'controller',
  'scheduler',
  'workers',
  'workload-state',
] as const;

export type ApiServerControlPort = (typeof API_SERVER_CONTROL_PORTS)[number];

const PORT_OFFSETS: Readonly<Record<ApiServerControlPort, THREE.Vector3>> = Object.freeze({
  client: new THREE.Vector3(-1.42, 0.5, 0),
  controller: new THREE.Vector3(-0.72, 0.5, -1.05),
  scheduler: new THREE.Vector3(0.72, 0.5, -1.05),
  workers: new THREE.Vector3(1.42, 0.5, 0),
  'workload-state': new THREE.Vector3(0, 0.5, 1.05),
});

/** A control-plane gateway with explicit request ports instead of a generic labeled block. */
export class ApiServerVisualHandle extends BaseVisualHandle {
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.9);
    this.root.userData.visualKind = 'api-server-gateway';
    this.root.userData.controlPorts = API_SERVER_CONTROL_PORTS.map((id) => ({
      id,
      offset: PORT_OFFSETS[id].toArray(),
    }));

    const plinthGeometry = this.ownGeometry(createRoundedBoxGeometry(3, 0.28, 2.18, 0.2, 4));
    const plinthMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.55, metalness: 0.16 }),
    );
    const plinth = this.markSelectable(
      new THREE.Mesh(plinthGeometry, plinthMaterial),
      'api-server-plinth',
    );
    plinth.position.y = 0.14;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.addContent(plinth);

    const bodyGeometry = this.ownGeometry(createRoundedBoxGeometry(2.12, 0.92, 1.42, 0.18, 4));
    this.bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x334363, roughness: 0.44, metalness: 0.18 }),
    );
    const body = this.markSelectable(
      new THREE.Mesh(bodyGeometry, this.bodyMaterial),
      'api-server-gateway',
    );
    body.position.y = 0.72;
    body.castShadow = true;
    this.addContent(body);

    const slotGeometry = this.ownGeometry(createRoundedBoxGeometry(0.28, 0.72, 0.08, 0.035));
    const slotMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.65, metalness: 0.04 }),
    );
    const requestSlot = new THREE.Mesh(slotGeometry, slotMaterial);
    requestSlot.position.set(0, 0.74, 0.75);
    requestSlot.userData.role = 'api-request-slot';
    this.addContent(requestSlot);

    const glyphMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.92));
    const glyphHubGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 20));
    const glyphHub = new THREE.Mesh(glyphHubGeometry, glyphMaterial);
    glyphHub.position.set(0, 1.225, 0);
    glyphHub.userData.role = 'api-glyph-hub';
    this.addContent(glyphHub);

    const glyphNodeGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.07, 0.07, 0.065, 14));
    const glyphLinkGeometry = this.ownGeometry(new THREE.BoxGeometry(0.48, 0.035, 0.045));
    for (let index = 0; index < 3; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 3;
      const node = new THREE.Mesh(glyphNodeGeometry, glyphMaterial);
      node.position.set(Math.cos(angle) * 0.48, 1.225, Math.sin(angle) * 0.48);
      node.userData.role = 'api-glyph-node';
      const link = new THREE.Mesh(glyphLinkGeometry, glyphMaterial);
      link.position.set(Math.cos(angle) * 0.24, 1.225, Math.sin(angle) * 0.24);
      link.rotation.y = -angle;
      link.userData.role = 'api-glyph-link';
      this.addContent(node, link);
    }

    const portGeometry = this.ownGeometry(createRoundedBoxGeometry(0.34, 0.18, 0.34, 0.07));
    for (const port of API_SERVER_CONTROL_PORTS) {
      const material = this.ownMaterial(
        createFlatAccentMaterial(
          port === 'workload-state' ? palette.ownership : palette.controlFlow,
          0.88,
        ),
      );
      const marker = new THREE.Mesh(portGeometry, material);
      marker.position.copy(PORT_OFFSETS[port]);
      marker.userData.role = 'api-control-port';
      marker.userData.port = port;
      this.addContent(marker);
    }

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 18));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(1.14, 0.36, 0.75);
    status.userData.role = 'api-server-status';
    this.addContent(status);
    this.update(entity, view);
  }

  public getControlPortAnchor(port: ApiServerControlPort): THREE.Vector3 {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(PORT_OFFSETS[port].clone());
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.bodyMaterial.color.setHex(entity.status === 'failed' ? 0x543049 : 0x334363);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'API Server';
    this.root.userData.statusText = entity.status.toUpperCase();
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'API Server',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.58, 0);
    if (anchor === 'api-in' || anchor === 'network-in') return PORT_OFFSETS.client.clone();
    if (anchor === 'api-out') return PORT_OFFSETS['workload-state'].clone();
    if (anchor === 'network-out') return PORT_OFFSETS.workers.clone();
    if (anchor === 'control') return PORT_OFFSETS.controller.clone();
    if (anchor === 'ownership') return PORT_OFFSETS['workload-state'].clone();
    return super.anchorOffset(anchor);
  }
}
