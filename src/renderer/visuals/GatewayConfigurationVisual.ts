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

const configurationKind = (entity: WorldEntity): 'Gateway' | 'HTTPRoute' =>
  entity.kind === 'HTTPRoute' ? 'HTTPRoute' : 'Gateway';

/** A read-only API configuration card. It is intentionally incapable of acting as a route hop. */
export class GatewayConfigurationVisualHandle extends BaseVisualHandle {
  private readonly cardMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;
  private readonly gatewayGlyph: THREE.Group;
  private readonly routeGlyph: THREE.Group;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.66);
    this.root.userData.configurationOnly = true;
    this.root.userData.dataPlane = false;
    this.root.userData.applicationPacketHop = false;

    const shadowGeometry = this.ownGeometry(createRoundedBoxGeometry(2.62, 0.18, 1.9, 0.16, 4));
    const shadowMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x142236, roughness: 0.74, metalness: 0.01 }),
    );
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.position.set(0.1, 0.1, 0.1);
    shadow.userData.role = 'configuration-card-shadow';
    this.addContent(shadow);

    const cardGeometry = this.ownGeometry(createRoundedBoxGeometry(2.62, 0.28, 1.9, 0.16, 4));
    this.cardMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x2b3655, roughness: 0.5, metalness: 0.08 }),
    );
    const card = this.markSelectable(
      new THREE.Mesh(cardGeometry, this.cardMaterial),
      'gateway-api-configuration-card',
    );
    card.position.y = 0.2;
    card.castShadow = true;
    card.receiveShadow = true;
    this.addContent(card);

    const headerGeometry = this.ownGeometry(createRoundedBoxGeometry(2.22, 0.1, 0.24, 0.045));
    const headerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.9));
    const header = new THREE.Mesh(headerGeometry, headerMaterial);
    header.position.set(0, 0.38, -0.64);
    header.userData.role = 'configuration-card-header';
    this.addContent(header);

    const ruleGeometry = this.ownGeometry(createRoundedBoxGeometry(1.62, 0.08, 0.12, 0.035));
    const ruleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x556887, roughness: 0.52, metalness: 0.03 }),
    );
    for (let index = 0; index < 3; index += 1) {
      const rule = new THREE.Mesh(ruleGeometry, ruleMaterial);
      rule.position.set(-0.2, 0.39, -0.16 + index * 0.32);
      rule.scale.x = 1 - index * 0.18;
      rule.userData.role = 'configuration-rule-row';
      this.addContent(rule);
    }

    this.gatewayGlyph = new THREE.Group();
    this.gatewayGlyph.userData.role = 'gateway-configuration-glyph';
    const postGeometry = this.ownGeometry(new THREE.BoxGeometry(0.12, 0.12, 0.48));
    const glyphMaterial = this.ownMaterial(createFlatAccentMaterial(0x8ea8ff, 0.96));
    for (const x of [-0.24, 0.24]) {
      const post = new THREE.Mesh(postGeometry, glyphMaterial);
      post.position.x = x;
      this.gatewayGlyph.add(post);
    }
    const capGeometry = this.ownGeometry(new THREE.BoxGeometry(0.62, 0.12, 0.12));
    const cap = new THREE.Mesh(capGeometry, glyphMaterial);
    cap.position.z = -0.2;
    this.gatewayGlyph.add(cap);
    this.gatewayGlyph.position.set(0.84, 0.49, 0.34);
    this.addContent(this.gatewayGlyph);

    this.routeGlyph = new THREE.Group();
    this.routeGlyph.userData.role = 'http-route-configuration-glyph';
    const hubGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 14));
    const routeMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.96));
    const lineGeometry = this.ownGeometry(new THREE.BoxGeometry(0.46, 0.045, 0.055));
    for (const [index, z] of [-0.2, 0, 0.2].entries()) {
      const hub = new THREE.Mesh(hubGeometry, routeMaterial);
      hub.position.set(index === 0 ? -0.22 : 0.22, 0, z);
      this.routeGlyph.add(hub);
      if (index > 0) {
        const line = new THREE.Mesh(lineGeometry, routeMaterial);
        line.rotation.y = index === 1 ? 0 : -0.42;
        line.position.set(0, 0, z / 2);
        this.routeGlyph.add(line);
      }
    }
    this.routeGlyph.position.set(0.82, 0.5, 0.32);
    this.addContent(this.routeGlyph);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(1.08, 0.4, -0.62);
    status.userData.role = 'configuration-card-status';
    this.addContent(status);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const kind = configurationKind(entity);
    const isHttpRoute = kind === 'HTTPRoute';
    this.gatewayGlyph.visible = !isHttpRoute;
    this.routeGlyph.visible = isHttpRoute;
    this.cardMaterial.color.setHex(isHttpRoute ? 0x25445a : 0x2b3655);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.configurationKind = kind;
    this.root.userData.visualKind = isHttpRoute
      ? 'http-route-configuration-card'
      : 'gateway-configuration-card';
    this.root.userData.parentGatewayRef =
      typeof entity.data.parentGatewayRef === 'string' ? entity.data.parentGatewayRef : null;
    this.root.userData.backendServiceRef =
      typeof entity.data.backendServiceRef === 'string' ? entity.data.backendServiceRef : null;
    this.root.userData.shortLabel = `${kind} · ${shortResourceName(entity.name, 16)}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `${kind} config · ${shortResourceName(entity.name, 13)}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.96, 0);
    if (anchor === 'control' || anchor === 'api-out') return new THREE.Vector3(1.38, 0.34, 0);
    if (anchor === 'api-in' || anchor === 'left') return new THREE.Vector3(-1.38, 0.34, 0);
    return super.anchorOffset(anchor);
  }
}
