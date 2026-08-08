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

/** A standalone developer CLI station outside the cluster foundation. */
export class DeveloperVisualHandle extends BaseVisualHandle {
  private readonly terminalMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.72);
    this.root.userData.visualKind = 'developer-cli-station';
    this.root.userData.externalActor = true;
    this.root.userData.outsideCluster = true;

    const baseGeometry = this.ownGeometry(createRoundedBoxGeometry(2.82, 0.24, 1.76, 0.2, 5));
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x2b3548, roughness: 0.53, metalness: 0.13 }),
    );
    const base = this.markSelectable(
      new THREE.Mesh(baseGeometry, baseMaterial),
      'developer-station-base',
    );
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const keyboardGeometry = this.ownGeometry(createRoundedBoxGeometry(2.1, 0.1, 0.68, 0.1));
    const keyboardMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.7, metalness: 0.03 }),
    );
    const keyboard = new THREE.Mesh(keyboardGeometry, keyboardMaterial);
    keyboard.position.set(0, 0.29, 0.42);
    keyboard.userData.role = 'developer-keyboard-deck';
    this.addContent(keyboard);

    const keyGeometry = this.ownGeometry(createRoundedBoxGeometry(0.18, 0.035, 0.1, 0.025));
    const keyMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.74));
    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        const key = new THREE.Mesh(keyGeometry, keyMaterial);
        key.position.set(-0.73 + column * 0.21, 0.35, 0.22 + row * 0.15);
        key.userData.role = 'developer-key';
        this.addContent(key);
      }
    }

    const terminalGeometry = this.ownGeometry(createRoundedBoxGeometry(2.38, 1.36, 0.24, 0.16, 5));
    this.terminalMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x40395c, roughness: 0.45, metalness: 0.14 }),
    );
    const terminal = this.markSelectable(
      new THREE.Mesh(terminalGeometry, this.terminalMaterial),
      'developer-terminal',
    );
    terminal.position.set(0, 1.1, -0.48);
    terminal.castShadow = true;
    this.addContent(terminal);

    const screenGeometry = this.ownGeometry(createRoundedBoxGeometry(2.02, 1.02, 0.065, 0.1));
    const screenMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.75, metalness: 0.01 }),
    );
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 1.08, -0.345);
    screen.userData.role = 'developer-cli-screen';
    this.addContent(screen);

    const promptMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.94));
    const promptGeometry = this.ownGeometry(new THREE.BoxGeometry(0.28, 0.045, 0.055));
    for (const sign of [-1, 1]) {
      const stroke = new THREE.Mesh(promptGeometry, promptMaterial);
      stroke.position.set(-0.72, 1.34 - sign * 0.08, -0.3);
      stroke.rotation.z = sign * 0.62;
      stroke.userData.role = 'developer-prompt';
      this.addContent(stroke);
    }

    const commandGeometry = this.ownGeometry(new THREE.BoxGeometry(1.15, 0.05, 0.05));
    for (let index = 0; index < 3; index += 1) {
      const command = new THREE.Mesh(commandGeometry, promptMaterial);
      command.position.set(-0.03, 1.34 - index * 0.25, -0.3);
      command.scale.x = 1 - index * 0.2;
      command.userData.role = 'developer-command-rail';
      this.addContent(command);
    }

    const apiPortGeometry = this.ownGeometry(new THREE.TorusGeometry(0.19, 0.05, 8, 24));
    const apiPort = new THREE.Mesh(apiPortGeometry, promptMaterial);
    apiPort.position.set(1.23, 0.98, -0.48);
    apiPort.rotation.y = Math.PI / 2;
    apiPort.userData.role = 'developer-api-port';
    this.addContent(apiPort);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(0.96, 1.58, -0.345);
    status.userData.role = 'developer-status';
    this.addContent(status);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const command =
      typeof entity.data.command === 'string' && entity.data.command.length > 0
        ? entity.data.command
        : 'kubectl apply';
    const apiTarget =
      typeof entity.data.apiTarget === 'string' && entity.data.apiTarget.length > 0
        ? entity.data.apiTarget
        : 'kube-apiserver';
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.terminalMaterial.color.setHex(entity.status === 'failed' ? 0x573447 : 0x40395c);

    this.root.userData.actorType = 'developer';
    this.root.userData.command = command;
    this.root.userData.apiTarget = apiTarget;
    this.root.userData.statusText = entity.status.toUpperCase();
    this.root.userData.shortLabel = `Developer · ${shortResourceName(entity.name, 14)}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Developer · ${shortResourceName(entity.name, 14)}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 2.02, -0.28);
    if (anchor === 'control') return new THREE.Vector3(1.43, 0.98, -0.48);
    if (anchor === 'data-path') return new THREE.Vector3(1.43, 0.98, -0.48);
    return super.anchorOffset(anchor);
  }
}
