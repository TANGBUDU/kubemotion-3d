import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import { getContainerData } from '../../world/dataGuards';
import type { WorldEntity } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { createFailureStripeGeometry, createRoundedBoxGeometry } from '../design/geometry';
import {
  applyMaterialStatus,
  createFlatAccentMaterial,
  createSurfaceMaterial,
} from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName, statusLabel } from '../design/typography';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

export class ContainerVisualHandle extends BaseVisualHandle {
  public readonly block: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly topCap: THREE.Mesh;
  private readonly grooves = new THREE.Group();
  private readonly failureStripe: THREE.Mesh;
  private readonly stateIndicator: THREE.Mesh;
  private readonly waitingIndicator: THREE.Mesh;
  private readonly stateMaterial: THREE.MeshBasicMaterial;
  private readonly evidenceListeners = new Set<() => void>();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.5);
    this.root.userData.visualKind = 'container-module';
    const blockGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.container.width,
        dimensions.container.height,
        dimensions.container.depth,
        dimensions.container.cornerRadius,
        4,
      ),
    );
    const blockMaterial = this.ownMaterial(
      createSurfaceMaterial({
        color: palette.runtimeModule,
        roughness: 0.48,
        metalness: 0.08,
      }),
    );
    this.block = this.markSelectable(
      new THREE.Mesh(blockGeometry, blockMaterial),
      'container-body',
    );
    this.block.position.y = dimensions.container.height / 2;
    this.block.castShadow = true;
    this.block.receiveShadow = true;
    this.addContent(this.block);

    const capGeometry = this.ownGeometry(createRoundedBoxGeometry(0.58, 0.08, 0.5, 0.035));
    const capMaterial = this.ownMaterial(
      createSurfaceMaterial({
        color: palette.runtimeModuleCap,
        roughness: 0.42,
        metalness: 0.1,
      }),
    );
    this.topCap = new THREE.Mesh(capGeometry, capMaterial);
    this.topCap.position.y = 0.66;
    this.topCap.userData.role = 'container-top-cap';
    this.addContent(this.topCap);

    this.addGrooves();

    const stateGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 16));
    this.stateMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    this.stateIndicator = new THREE.Mesh(stateGeometry, this.stateMaterial);
    this.stateIndicator.rotation.x = Math.PI / 2;
    this.stateIndicator.position.set(0.25, 0.5, -0.325);
    this.stateIndicator.userData.role = 'container-state-indicator';
    this.addContent(this.stateIndicator);

    const waitingGeometry = this.ownGeometry(new THREE.TorusGeometry(0.07, 0.022, 8, 18));
    this.waitingIndicator = new THREE.Mesh(waitingGeometry, this.stateMaterial);
    this.waitingIndicator.position.set(0.25, 0.5, -0.338);
    this.waitingIndicator.userData.role = 'container-waiting-indicator';
    this.waitingIndicator.visible = false;
    this.addContent(this.waitingIndicator);

    const stripeGeometry = this.ownGeometry(createFailureStripeGeometry(0.62, 0.5, 0.032));
    const stripeMaterial = this.ownMaterial(createFlatAccentMaterial(palette.failed));
    this.failureStripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
    this.failureStripe.position.set(0, 0.26, -0.335);
    this.failureStripe.renderOrder = 7;
    this.failureStripe.userData.role = 'container-failure-stripe';
    this.failureStripe.visible = false;
    this.addContent(this.failureStripe);
    this.update(entity, view);
  }

  /** Pod anatomy subscribes to restart evidence without depending on registry sync ordering. */
  public onEvidenceChange(listener: () => void): () => void {
    this.evidenceListeners.add(listener);
    return () => {
      this.evidenceListeners.delete(listener);
    };
  }

  private addGrooves(): void {
    const geometry = this.ownGeometry(new THREE.BoxGeometry(0.38, 0.035, 0.025));
    const material = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.86));
    for (let index = 0; index < 3; index += 1) {
      const groove = new THREE.Mesh(geometry, material);
      groove.position.set(-0.06, 0.24 + index * 0.13, -0.325);
      groove.userData.role = 'container-groove';
      this.grooves.add(groove);
    }
    this.grooves.userData.role = 'container-grooves';
    this.addContent(this.grooves);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = getContainerData(entity);
    const terminated = data.state.kind === 'terminated';
    const completed = terminated && data.state.exitCode === 0 && data.state.reason === 'Completed';
    const failed = terminated && !completed;
    const waiting = data.state.kind === 'waiting';
    applyMaterialStatus(this.stateMaterial, completed ? 'succeeded' : data.state.kind);

    this.block.scale.set(1, failed ? 0.3 : waiting ? 0.62 : 1, 1);
    this.block.position.y = failed ? 0.12 : waiting ? 0.2 : dimensions.container.height / 2;
    this.block.rotation.z = failed ? -0.12 : 0;
    this.block.material.color.setHex(failed ? 0x3a2a35 : palette.runtimeModule);
    this.topCap.visible = !failed;
    this.topCap.position.y = waiting ? 0.61 : 0.66;
    this.grooves.visible = !failed;
    this.failureStripe.visible = failed;
    this.stateIndicator.visible = !failed && !waiting;
    this.stateIndicator.scale.setScalar(1);
    this.waitingIndicator.visible = waiting;
    this.stateIndicator.userData.stateShape = completed ? 'success-dot' : 'solid-dot';
    this.waitingIndicator.userData.stateShape = 'open-ring';
    this.failureStripe.userData.stateShape = 'failure-stripe';

    this.root.userData.podId = data.podId;
    this.root.userData.containerName = data.name;
    this.root.userData.containerID = data.containerID ?? null;
    this.root.userData.restartCount = data.restartCount;
    this.root.userData.ready = data.ready;
    this.root.userData.started = data.started;
    this.root.userData.containerState = data.state.kind;
    this.root.userData.lastState = data.lastState ?? null;
    this.root.userData.image = data.image;
    this.root.userData.shortLabel = shortResourceName(entity.name, 14);
    this.root.userData.statusText = completed ? 'COMPLETED' : statusLabel(data.state.kind);
    this.root.userData.stateForm = failed
      ? 'collapsed'
      : waiting
        ? 'waiting'
        : completed
          ? 'completed'
          : 'upright';
    this.root.userData.stateShape = failed
      ? 'failure-stripe'
      : waiting
        ? 'open-ring'
        : completed
          ? 'success-dot'
          : 'solid-dot';
    this.root.userData.terminationOutcome = terminated
      ? completed
        ? 'completed'
        : 'failed'
      : null;
    this.block.userData.containerID = data.containerID ?? null;
    for (const listener of this.evidenceListeners) listener();
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'composition') return new THREE.Vector3(0, 0.32, 0);
    if (anchor === 'label') return new THREE.Vector3(0, 0.82, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.42, -0.34);
    if (anchor === 'network-in') return new THREE.Vector3(-0.42, 0.35, 0.34);
    if (anchor === 'network-out') return new THREE.Vector3(0.42, 0.35, 0.34);
    if (anchor === 'local-runtime') return new THREE.Vector3(0, 0.32, -0.34);
    return super.anchorOffset(anchor);
  }

  protected override onDispose(): void {
    this.evidenceListeners.clear();
  }
}
