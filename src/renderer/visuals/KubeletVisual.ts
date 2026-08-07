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

/** Selectable local agent designed to be mounted into a Node's kubelet bay. */
export class KubeletVisualHandle extends BaseVisualHandle {
  private readonly statusMaterial: THREE.MeshBasicMaterial;
  private readonly pulseGroup = new THREE.Group();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.72);
    this.root.userData.visualKind = 'kubelet-embedded-agent';
    this.root.userData.embeddedOnly = true;

    const moduleGeometry = this.ownGeometry(createRoundedBoxGeometry(1.12, 0.3, 0.52, 0.08));
    const moduleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x28536b, roughness: 0.48, metalness: 0.12 }),
    );
    const module = this.markSelectable(
      new THREE.Mesh(moduleGeometry, moduleMaterial),
      'kubelet-module',
    );
    module.position.y = 0.15;
    module.castShadow = true;
    this.addContent(module);

    const insetGeometry = this.ownGeometry(createRoundedBoxGeometry(0.78, 0.035, 0.24, 0.045));
    const insetMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.68, metalness: 0.04 }),
    );
    const inset = new THREE.Mesh(insetGeometry, insetMaterial);
    inset.position.set(-0.08, 0.32, 0);
    inset.userData.role = 'kubelet-activity-deck';
    this.addContent(inset);

    const pulseGeometry = this.ownGeometry(new THREE.BoxGeometry(0.055, 0.035, 0.16));
    const pulseMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.9));
    for (let index = 0; index < 4; index += 1) {
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.set(-0.32 + index * 0.18, 0.35, 0);
      pulse.scale.z = index % 2 === 0 ? 0.55 : 1;
      pulse.userData.role = 'kubelet-pulse';
      this.pulseGroup.add(pulse);
    }
    this.pulseGroup.userData.role = 'kubelet-reconcile-pulse';
    this.addContent(this.pulseGroup);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 14));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(0.43, 0.34, 0);
    status.userData.role = 'kubelet-status';
    this.addContent(status);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity, view: EntityViewState): void {
    const reconciling = entity.data.reconciling === true || view.emphasis === 'focused';
    this.pulseGroup.visible = reconciling;
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.reconciling = reconciling;
    this.root.userData.shortLabel = 'kubelet';
    this.root.userData.labelVisibility = 'focused';
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'kubelet',
      anchor: 'label',
      visibility: 'focused',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.72, 0);
    if (anchor === 'control') return new THREE.Vector3(-0.56, 0.25, 0);
    if (anchor === 'composition') return new THREE.Vector3(0.56, 0.25, 0);
    return super.anchorOffset(anchor);
  }
}
