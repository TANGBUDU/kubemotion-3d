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

/** External command entry point. The prompt chevron and command rails avoid a text billboard. */
export class KubectlVisualHandle extends BaseVisualHandle {
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.35);
    this.root.userData.visualKind = 'kubectl-command-entry';
    this.root.userData.externalActor = true;

    const consoleGeometry = this.ownGeometry(createRoundedBoxGeometry(2.25, 0.28, 1.45, 0.16, 4));
    const consoleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x253447, roughness: 0.55, metalness: 0.1 }),
    );
    const console = this.markSelectable(
      new THREE.Mesh(consoleGeometry, consoleMaterial),
      'kubectl-console',
    );
    console.position.y = 0.14;
    console.castShadow = true;
    this.addContent(console);

    const screenGeometry = this.ownGeometry(createRoundedBoxGeometry(1.86, 0.045, 1.04, 0.1));
    const screenMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.02 }),
    );
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.y = 0.31;
    screen.userData.role = 'kubectl-command-screen';
    this.addContent(screen);

    const promptMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.94));
    const promptStrokeGeometry = this.ownGeometry(new THREE.BoxGeometry(0.28, 0.035, 0.055));
    for (const sign of [-1, 1]) {
      const stroke = new THREE.Mesh(promptStrokeGeometry, promptMaterial);
      stroke.position.set(-0.68, 0.35, -sign * 0.09);
      stroke.rotation.y = sign * 0.62;
      stroke.userData.role = 'kubectl-prompt-chevron';
      this.addContent(stroke);
    }

    const commandGeometry = this.ownGeometry(new THREE.BoxGeometry(0.82, 0.035, 0.055));
    for (let index = 0; index < 3; index += 1) {
      const command = new THREE.Mesh(commandGeometry, promptMaterial);
      command.position.set(-0.05 + index * 0.13, 0.35, -0.26 + index * 0.26);
      command.scale.x = 1 - index * 0.18;
      command.userData.role = 'kubectl-command-rail';
      this.addContent(command);
    }

    const triggerGeometry = this.ownGeometry(createRoundedBoxGeometry(0.38, 0.12, 0.38, 0.08));
    const triggerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.failed, 0.9));
    const trigger = new THREE.Mesh(triggerGeometry, triggerMaterial);
    trigger.position.set(0.78, 0.37, 0.46);
    trigger.userData.role = 'kubectl-delete-trigger';
    this.addContent(trigger);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.045, 14));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(0.88, 0.35, -0.5);
    status.userData.role = 'kubectl-status';
    this.addContent(status);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'kubectl';
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'kubectl',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.83, 0);
    if (anchor === 'control') return new THREE.Vector3(1.12, 0.38, 0);
    if (anchor === 'data-path') return new THREE.Vector3(1.12, 0.38, 0);
    return super.anchorOffset(anchor);
  }
}
