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

/** Two explicit reconcile arrows orbiting a controller hub. */
export class ControllerManagerVisualHandle extends BaseVisualHandle {
  private readonly hubMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.7);
    this.root.userData.visualKind = 'controller-manager-reconcile';

    const baseGeometry = this.ownGeometry(createRoundedBoxGeometry(2.72, 0.25, 2.08, 0.18, 4));
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.58, metalness: 0.13 }),
    );
    const base = this.markSelectable(
      new THREE.Mesh(baseGeometry, baseMaterial),
      'controller-manager-base',
    );
    base.position.y = 0.125;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const loopMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.94));
    const arcGeometry = this.ownGeometry(
      new THREE.TorusGeometry(0.68, 0.06, 8, 36, Math.PI * 1.42),
    );
    for (let index = 0; index < 2; index += 1) {
      const loop = new THREE.Mesh(arcGeometry, loopMaterial);
      loop.rotation.x = Math.PI / 2;
      loop.rotation.z = index === 0 ? -0.12 : Math.PI - 0.12;
      loop.position.y = 0.48 + index * 0.18;
      loop.scale.setScalar(index === 0 ? 1 : 0.78);
      loop.userData.role = 'reconcile-loop';
      loop.userData.direction = index === 0 ? 'clockwise' : 'counter-clockwise';
      this.addContent(loop);
    }

    const chevronGeometry = this.ownGeometry(new THREE.BoxGeometry(0.22, 0.045, 0.065));
    for (const [index, x] of [-0.62, 0.49].entries()) {
      const arrow = new THREE.Group();
      arrow.position.set(x, 0.68 - index * 0.18, index === 0 ? -0.36 : 0.4);
      arrow.rotation.y = index === 0 ? -0.5 : Math.PI - 0.42;
      arrow.userData.role = 'reconcile-arrowhead';
      for (const sign of [-1, 1]) {
        const stroke = new THREE.Mesh(chevronGeometry, loopMaterial);
        stroke.rotation.y = sign * 0.52;
        arrow.add(stroke);
      }
      this.addContent(arrow);
    }

    const hubGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.36, 0.42, 0.48, 24));
    this.hubMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x5e4f96, roughness: 0.42, metalness: 0.16 }),
    );
    const hub = this.markSelectable(
      new THREE.Mesh(hubGeometry, this.hubMaterial),
      'controller-hub',
    );
    hub.position.y = 0.48;
    hub.castShadow = true;
    this.addContent(hub);

    const coreGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 16));
    const coreMaterial = this.ownMaterial(createFlatAccentMaterial(0xd8d0ff, 0.92));
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.y = 0.51;
    core.userData.role = 'controller-core';
    this.addContent(core);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(1.08, 0.3, 0.75);
    status.userData.role = 'controller-manager-status';
    this.addContent(status);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.hubMaterial.color.setHex(entity.status === 'failed' ? 0x663c67 : 0x5e4f96);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'Controller Manager';
    this.root.userData.responsibleController = 'ReplicaSet controller';
    this.root.userData.reconcileLoops = 2;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'Controller Manager',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.28, 0);
    if (anchor === 'control') return new THREE.Vector3(-1.36, 0.5, 0);
    if (anchor === 'ownership') return new THREE.Vector3(1.36, 0.5, 0);
    return super.anchorOffset(anchor);
  }
}
