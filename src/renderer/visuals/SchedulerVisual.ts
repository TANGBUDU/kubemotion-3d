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

const INPUT_OFFSET = new THREE.Vector3(0, 0.43, 1.18);
const CANDIDATE_OFFSETS = [
  new THREE.Vector3(-0.92, 0.43, -0.92),
  new THREE.Vector3(0, 0.43, -1.12),
  new THREE.Vector3(0.92, 0.43, -0.92),
] as const;

/** A routing fork: one unscheduled input and three candidate Node outputs. */
export class SchedulerVisualHandle extends BaseVisualHandle {
  private readonly discMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.75);
    this.root.userData.visualKind = 'scheduler-routing-fork';
    this.root.userData.unscheduledInput = INPUT_OFFSET.toArray();
    this.root.userData.candidateNodeOutputs = CANDIDATE_OFFSETS.map((offset) => offset.toArray());

    const baseGeometry = this.ownGeometry(createRoundedBoxGeometry(2.8, 0.24, 2.18, 0.18, 4));
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.6, metalness: 0.12 }),
    );
    const base = this.markSelectable(new THREE.Mesh(baseGeometry, baseMaterial), 'scheduler-base');
    base.position.y = 0.12;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const discGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.58, 0.64, 0.24, 24));
    this.discMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x6c532a, roughness: 0.44, metalness: 0.16 }),
    );
    const disc = this.markSelectable(
      new THREE.Mesh(discGeometry, this.discMaterial),
      'scheduler-decision-disc',
    );
    disc.position.y = 0.39;
    disc.castShadow = true;
    this.addContent(disc);

    const routeMaterial = this.ownMaterial(createFlatAccentMaterial(palette.scheduling, 0.96));
    const routeGeometry = this.ownGeometry(new THREE.BoxGeometry(0.075, 0.055, 0.78));
    const input = new THREE.Mesh(routeGeometry, routeMaterial);
    input.position.set(0, 0.48, 0.83);
    input.userData.role = 'scheduler-input-route';
    this.addContent(input);

    const forkStem = new THREE.Mesh(routeGeometry, routeMaterial);
    forkStem.position.set(0, 0.48, -0.64);
    forkStem.userData.role = 'scheduler-fork-stem';
    this.addContent(forkStem);

    const branchGeometry = this.ownGeometry(new THREE.BoxGeometry(0.78, 0.055, 0.07));
    for (const [index, offset] of CANDIDATE_OFFSETS.entries()) {
      const branch = new THREE.Mesh(branchGeometry, routeMaterial);
      branch.position.set(offset.x / 2, 0.48, -0.76 - index * 0.045);
      branch.rotation.y = Math.atan2(offset.z + 0.2, offset.x || 0.001);
      branch.userData.role = 'scheduler-candidate-route';
      branch.userData.candidateIndex = index;
      this.addContent(branch);
    }

    const portGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.105, 0.105, 0.07, 16));
    const inputPort = new THREE.Mesh(portGeometry, routeMaterial);
    inputPort.position.copy(INPUT_OFFSET);
    inputPort.userData.role = 'scheduler-unscheduled-input';
    this.addContent(inputPort);
    for (const [index, offset] of CANDIDATE_OFFSETS.entries()) {
      const port = new THREE.Mesh(portGeometry, routeMaterial);
      port.position.copy(offset);
      port.userData.role = 'scheduler-node-output';
      port.userData.candidateIndex = index;
      this.addContent(port);
    }

    const needleGeometry = this.ownGeometry(new THREE.BoxGeometry(0.09, 0.12, 0.7));
    const needleMaterial = this.ownMaterial(createFlatAccentMaterial(0xffd47c, 0.95));
    const needle = new THREE.Mesh(needleGeometry, needleMaterial);
    needle.position.set(0, 0.56, -0.12);
    needle.rotation.y = -0.62;
    needle.userData.role = 'scheduler-compass-needle';
    this.addContent(needle);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(1.12, 0.29, 0.78);
    status.userData.role = 'scheduler-status';
    this.addContent(status);
    this.update(entity, view);
  }

  public getUnscheduledInputAnchor(): THREE.Vector3 {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(INPUT_OFFSET.clone());
  }

  public getCandidateNodeAnchor(index: number): THREE.Vector3 | undefined {
    const offset = CANDIDATE_OFFSETS[index];
    if (!offset) return undefined;
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(offset.clone());
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.discMaterial.color.setHex(entity.status === 'failed' ? 0x6b3d35 : 0x6c532a);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'Scheduler';
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'Scheduler',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.16, 0);
    if (anchor === 'control') return new THREE.Vector3(-1.4, 0.45, 0);
    if (anchor === 'placement') return INPUT_OFFSET.clone();
    if (anchor === 'data-path') return CANDIDATE_OFFSETS[1].clone();
    return super.anchorOffset(anchor);
  }
}
