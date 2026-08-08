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

/** A Node-local CRI/execution module, intentionally distinct from kubelet's reconcile agent. */
export class ContainerRuntimeVisualHandle extends BaseVisualHandle {
  private readonly statusMaterial: THREE.MeshBasicMaterial;
  private readonly executionCells = new THREE.Group();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.74);
    this.root.userData.visualKind = 'container-runtime-cri-executor';
    this.root.userData.embeddedOnly = true;
    this.root.userData.runtimeInterface = 'CRI';
    this.root.userData.executesContainers = true;

    const housingGeometry = this.ownGeometry(createRoundedBoxGeometry(1.12, 0.34, 0.56, 0.07, 4));
    const housingMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x29384a, roughness: 0.4, metalness: 0.3 }),
    );
    const housing = this.markSelectable(
      new THREE.Mesh(housingGeometry, housingMaterial),
      'container-runtime-module',
    );
    housing.position.y = 0.17;
    housing.castShadow = true;
    this.addContent(housing);

    const capGeometry = this.ownGeometry(createRoundedBoxGeometry(0.72, 0.05, 0.36, 0.045));
    const capMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: palette.runtimeModuleCap, roughness: 0.34, metalness: 0.24 }),
    );
    const cap = new THREE.Mesh(capGeometry, capMaterial);
    cap.position.set(0.08, 0.36, 0);
    cap.userData.role = 'container-runtime-execution-deck';
    this.addContent(cap);

    const criPortGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 16));
    const criPortMaterial = this.ownMaterial(createFlatAccentMaterial(palette.scheduling, 0.92));
    const criPort = new THREE.Mesh(criPortGeometry, criPortMaterial);
    criPort.rotation.z = Math.PI / 2;
    criPort.position.set(-0.57, 0.2, 0);
    criPort.userData.role = 'container-runtime-cri-port';
    criPort.userData.protocol = 'CRI';
    this.addContent(criPort);

    const cellGeometry = this.ownGeometry(createRoundedBoxGeometry(0.22, 0.08, 0.18, 0.025));
    const cellMaterial = this.ownMaterial(createFlatAccentMaterial(palette.runtimeModule, 0.96));
    for (let index = 0; index < 2; index += 1) {
      const cell = new THREE.Mesh(cellGeometry, cellMaterial);
      cell.position.set(-0.08 + index * 0.34, 0.41, 0);
      cell.userData.role = 'container-runtime-execution-cell';
      cell.userData.slotIndex = index;
      this.executionCells.add(cell);
    }
    this.executionCells.userData.role = 'container-runtime-execution-pool';
    this.addContent(this.executionCells);

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.06, 0.06, 0.035, 14));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.position.set(0.43, 0.38, -0.19);
    status.userData.role = 'container-runtime-status';
    this.addContent(status);

    const exhaustGeometry = this.ownGeometry(new THREE.BoxGeometry(0.04, 0.07, 0.18));
    const exhaustMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.82));
    for (let index = 0; index < 3; index += 1) {
      const exhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
      exhaust.position.set(0.48, 0.16, -0.16 + index * 0.16);
      exhaust.userData.role = 'container-runtime-exhaust';
      this.addContent(exhaust);
    }
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity, view: EntityViewState): void {
    applyMaterialStatus(this.statusMaterial, entity.status);
    const executing = entity.data.executing !== false;
    this.executionCells.visible = executing;
    const runtimeName =
      typeof entity.data.runtimeName === 'string'
        ? entity.data.runtimeName
        : shortResourceName(entity.name, 18);
    this.root.userData.executing = executing;
    this.root.userData.runtimeName = runtimeName;
    this.root.userData.focused = view.emphasis === 'focused';
    this.root.userData.shortLabel = runtimeName;
    this.root.userData.labelVisibility = 'focused';
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: runtimeName,
      anchor: 'label',
      visibility: 'focused',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.72, 0);
    if (anchor === 'control') return new THREE.Vector3(-0.58, 0.2, 0);
    if (anchor === 'local-runtime') return new THREE.Vector3(0.58, 0.2, 0);
    if (anchor === 'composition') return new THREE.Vector3(0.56, 0.2, 0);
    return super.anchorOffset(anchor);
  }
}
