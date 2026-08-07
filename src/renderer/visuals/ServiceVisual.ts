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

interface ServicePort {
  readonly port?: number;
  readonly protocol?: string;
}

function firstPort(entity: WorldEntity): ServicePort {
  const ports = entity.data.ports;
  if (!Array.isArray(ports)) return {};
  const candidate = ports[0];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return {};
  const record = candidate as Readonly<Record<string, unknown>>;
  return {
    ...(typeof record.port === 'number' ? { port: record.port } : {}),
    ...(typeof record.protocol === 'string' ? { protocol: record.protocol } : {}),
  };
}

/** A stable routing portal whose identity is visually separate from replaceable Pod backends. */
export class ServiceVisualHandle extends BaseVisualHandle {
  private readonly bodyMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.72);
    this.root.userData.visualKind = 'service-routing-hub';

    const plinthGeometry = this.ownGeometry(createRoundedBoxGeometry(2.72, 0.28, 2.08, 0.24, 5));
    const plinthMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.5, metalness: 0.13 }),
    );
    const plinth = this.markSelectable(
      new THREE.Mesh(plinthGeometry, plinthMaterial),
      'service-plinth',
    );
    plinth.position.y = 0.14;
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.addContent(plinth);

    const bodyGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.82, 1.02, 0.58, 32));
    this.bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x173f58, roughness: 0.38, metalness: 0.18 }),
    );
    const body = this.markSelectable(
      new THREE.Mesh(bodyGeometry, this.bodyMaterial),
      'service-hub',
    );
    body.position.y = 0.56;
    body.castShadow = true;
    this.addContent(body);

    const ringGeometry = this.ownGeometry(new THREE.TorusGeometry(1.03, 0.105, 12, 40));
    const ringMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.92));
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.9;
    ring.userData.role = 'service-stable-ring';
    this.addContent(ring);

    const spokeGeometry = this.ownGeometry(new THREE.BoxGeometry(0.82, 0.055, 0.09));
    for (let index = 0; index < 4; index += 1) {
      const spoke = new THREE.Mesh(spokeGeometry, ringMaterial);
      spoke.position.y = 0.905;
      spoke.rotation.y = (index * Math.PI) / 4;
      spoke.userData.role = 'service-route-spoke';
      this.addContent(spoke);
    }

    const portalGeometry = this.ownGeometry(new THREE.TorusGeometry(0.47, 0.09, 12, 32));
    const portalMaterial = this.ownMaterial(createFlatAccentMaterial(0xb6e8fb, 0.95));
    const portal = new THREE.Mesh(portalGeometry, portalMaterial);
    portal.rotation.x = Math.PI / 2;
    portal.position.y = 0.93;
    portal.userData.role = 'service-portal';
    this.addContent(portal);

    const statusGeometry = this.ownGeometry(createRoundedBoxGeometry(1.28, 0.09, 0.08, 0.035));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const statusRail = new THREE.Mesh(statusGeometry, this.statusMaterial);
    statusRail.position.set(0, 0.38, 1.075);
    statusRail.userData.role = 'service-status-rail';
    this.addContent(statusRail);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const clusterIP =
      typeof entity.data.clusterIP === 'string' ? entity.data.clusterIP : 'unassigned';
    const port = firstPort(entity);
    const protocol = port.protocol ?? 'TCP';
    const portText = port.port === undefined ? '?' : String(port.port);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.bodyMaterial.color.setHex(entity.status === 'not-ready' ? 0x4f4330 : 0x173f58);

    this.root.userData.clusterIP = clusterIP;
    this.root.userData.port = port.port ?? null;
    this.root.userData.protocol = protocol;
    this.root.userData.stableEntry = true;
    this.root.userData.shortLabel = `Service · ${shortResourceName(entity.name, 14)}`;
    this.root.userData.visibleText = `${entity.name} Service · ${clusterIP}:${portText}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Service · ${shortResourceName(entity.name, 12)} · ${clusterIP}:${portText}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.48, 0);
    if (anchor === 'data-path') return new THREE.Vector3(0, 0.72, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.75, -1.04);
    return super.anchorOffset(anchor);
  }
}
