import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { EntityId, WorldEntity } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { createRoundedBoxGeometry, createVentGeometry } from '../design/geometry';
import {
  applyMaterialStatus,
  createFlatAccentMaterial,
  createSurfaceMaterial,
} from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName, statusLabel } from '../design/typography';
import { BaseVisualHandle, type AnchorKind, type EntityVisualHandle } from './BaseVisualHandle';

export class NodeVisualHandle extends BaseVisualHandle {
  public static readonly footprint = Object.freeze({
    width: dimensions.node.width,
    depth: dimensions.node.depth,
  });
  public static readonly kubeletOffset = dimensions.node.kubeletMountOffset;
  public static readonly runtimeOffset = dimensions.node.runtimeMountOffset;

  public readonly embeddedKubelet = new THREE.Group();
  public readonly embeddedRuntime = new THREE.Group();
  public readonly kubeletMount = new THREE.Group();
  public readonly runtimeMount = new THREE.Group();
  private readonly chassisMaterial: THREE.MeshStandardMaterial;
  private readonly statusMaterial: THREE.MeshBasicMaterial;
  private readonly statusIndicator: THREE.Mesh;
  private readonly alertBars = new THREE.Group();
  private readonly kubeletPlaceholder = new THREE.Group();
  private readonly runtimePlaceholder = new THREE.Group();
  private mountedKubeletId: EntityId | undefined;
  private mountedRuntimeId: EntityId | undefined;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 3.65);
    this.root.userData.visualKind = 'node-chassis';
    this.root.userData.hasEmbeddedKubelet = true;
    this.root.userData.hasEmbeddedRuntime = true;
    this.root.userData.nodeBayCount = dimensions.node.bayAnchors.length;
    this.root.userData.nodeBayAnchors = Object.freeze(
      dimensions.node.bayAnchors.map(([x, z]) =>
        Object.freeze([x, dimensions.node.podLandingY, z]),
      ),
    );
    this.root.userData.nodeBaySize = Object.freeze([
      dimensions.node.bayWidth,
      dimensions.node.bayDepth,
    ]);
    this.root.userData.podLandingY = dimensions.node.podLandingY;
    this.root.userData.systemModuleMounts = Object.freeze({
      kubelet: dimensions.node.kubeletMountOffset,
      containerRuntime: dimensions.node.runtimeMountOffset,
    });

    const chassisGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.node.width,
        dimensions.node.chassisHeight,
        dimensions.node.depth,
        0.2,
        4,
      ),
    );
    this.chassisMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'primary', roughness: 0.62, metalness: 0.14 }),
    );
    const chassis = this.markSelectable(
      new THREE.Mesh(chassisGeometry, this.chassisMaterial),
      'node-chassis',
    );
    chassis.position.y = dimensions.node.chassisHeight / 2;
    chassis.receiveShadow = true;
    chassis.castShadow = true;
    this.addContent(chassis);

    const deckGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.node.width - 0.36,
        0.09,
        dimensions.node.depth - 0.4,
        0.14,
      ),
    );
    const deckMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72 }),
    );
    const deck = new THREE.Mesh(deckGeometry, deckMaterial);
    deck.position.y = dimensions.node.chassisHeight + 0.035;
    deck.receiveShadow = true;
    deck.userData.role = 'node-deck';
    this.addContent(deck);

    this.addSidewalls();
    this.addPodBays();
    this.addSystemModuleStrip();
    this.addFrontPanel();
    this.addEmbeddedKubelet();
    this.addEmbeddedRuntime();

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.105, 0.105, 0.055, 18));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    this.statusIndicator = new THREE.Mesh(statusGeometry, this.statusMaterial);
    this.statusIndicator.rotation.x = Math.PI / 2;
    this.statusIndicator.position.set(2.55, 0.49, -1.92);
    this.statusIndicator.userData.role = 'node-status-indicator';
    this.addContent(this.statusIndicator);
    this.addAlertBars();
    this.update(entity, view);
  }

  private addSidewalls(): void {
    const wallMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.56, metalness: 0.12 }),
    );
    const longWallGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.node.width - 0.2,
        dimensions.node.wallHeight,
        0.14,
        0.055,
      ),
    );
    const shortWallGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        0.14,
        dimensions.node.wallHeight,
        dimensions.node.depth - 0.34,
        0.055,
      ),
    );
    for (const z of [-1.76, 1.76]) {
      const wall = new THREE.Mesh(longWallGeometry, wallMaterial);
      wall.position.set(0, 0.6, z);
      wall.castShadow = true;
      wall.userData.role = 'node-sidewall';
      this.addContent(wall);
    }
    const sidewallX = dimensions.node.width / 2 - 0.1;
    for (const x of [-sidewallX, sidewallX]) {
      const wall = new THREE.Mesh(shortWallGeometry, wallMaterial);
      wall.position.set(x, 0.6, 0);
      wall.castShadow = true;
      wall.userData.role = 'node-sidewall';
      this.addContent(wall);
    }
  }

  private addPodBays(): void {
    const bayGeometry = this.ownGeometry(
      createRoundedBoxGeometry(dimensions.node.bayWidth, 0.055, dimensions.node.bayDepth, 0.1),
    );
    const bayMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.7, metalness: 0.04 }),
    );
    dimensions.node.bayAnchors.forEach(([x, z], slotIndex) => {
      const bay = new THREE.Mesh(bayGeometry, bayMaterial);
      bay.position.set(x, dimensions.node.podLandingY - 0.05, z);
      bay.receiveShadow = true;
      bay.userData.role = 'pod-bay';
      bay.userData.slotIndex = slotIndex;
      bay.userData.landingY = dimensions.node.podLandingY;
      this.addContent(bay);
    });

    const dividerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderSubtle, 0.72));
    const centerDividerGeometry = this.ownGeometry(new THREE.BoxGeometry(0.045, 0.025, 3.3));
    const crossDividerGeometry = this.ownGeometry(new THREE.BoxGeometry(4.28, 0.025, 0.045));
    const centerDivider = new THREE.Mesh(centerDividerGeometry, dividerMaterial);
    const crossDivider = new THREE.Mesh(crossDividerGeometry, dividerMaterial);
    centerDivider.position.set(-0.78, dimensions.node.podLandingY - 0.01, 0);
    crossDivider.position.set(-0.78, dimensions.node.podLandingY - 0.01, 0);
    centerDivider.userData.role = 'slot-divider';
    crossDivider.userData.role = 'slot-divider';
    this.addContent(centerDivider, crossDivider);
  }

  private addSystemModuleStrip(): void {
    const [centerX, centerY, centerZ] = dimensions.node.systemModuleStrip.center;
    const [width, height, depth] = dimensions.node.systemModuleStrip.size;
    const stripGeometry = this.ownGeometry(createRoundedBoxGeometry(width, height, depth, 0.1, 4));
    const stripMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.74, metalness: 0.05 }),
    );
    const strip = new THREE.Mesh(stripGeometry, stripMaterial);
    strip.position.set(centerX, centerY, centerZ);
    strip.receiveShadow = true;
    strip.userData.role = 'node-system-module-strip';
    strip.userData.mountCount = 2;
    this.addContent(strip);

    const dividerGeometry = this.ownGeometry(new THREE.BoxGeometry(width - 0.16, 0.025, 0.055));
    const dividerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.82));
    const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
    divider.position.set(centerX, centerY + height / 2 + 0.014, centerZ);
    divider.userData.role = 'node-system-module-divider';
    this.addContent(divider);
  }

  private addFrontPanel(): void {
    const plaqueGeometry = this.ownGeometry(createRoundedBoxGeometry(2.18, 0.28, 0.12, 0.055));
    const plaqueMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'elevated', roughness: 0.5, metalness: 0.1 }),
    );
    const plaque = new THREE.Mesh(plaqueGeometry, plaqueMaterial);
    plaque.position.set(-1.72, 0.42, -1.94);
    plaque.userData.role = 'node-name-plaque';
    this.addContent(plaque);

    const resourceStripGeometry = this.ownGeometry(
      createRoundedBoxGeometry(2.02, 0.18, 0.1, 0.045),
    );
    const resourceStripMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.68, metalness: 0.05 }),
    );
    const resourceStrip = new THREE.Mesh(resourceStripGeometry, resourceStripMaterial);
    resourceStrip.position.set(0.62, 0.42, -1.95);
    resourceStrip.userData.role = 'node-resource-strip';
    resourceStrip.userData.segmentCount = 4;
    this.addContent(resourceStrip);

    const segmentGeometry = this.ownGeometry(createRoundedBoxGeometry(0.36, 0.085, 0.025, 0.018));
    const segmentMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.78));
    for (let index = 0; index < 4; index += 1) {
      const segment = new THREE.Mesh(segmentGeometry, segmentMaterial);
      segment.position.set(0.02 + index * 0.4, 0.42, -2.015);
      segment.userData.role = 'node-resource-segment';
      segment.userData.segmentIndex = index;
      this.addContent(segment);
    }

    const statusDeckGeometry = this.ownGeometry(createRoundedBoxGeometry(0.62, 0.24, 0.1, 0.045));
    const statusDeckMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'elevated', roughness: 0.52, metalness: 0.08 }),
    );
    const statusDeck = new THREE.Mesh(statusDeckGeometry, statusDeckMaterial);
    statusDeck.position.set(2.55, 0.42, -1.95);
    statusDeck.userData.role = 'node-status-strip';
    this.addContent(statusDeck);

    const ventGeometry = this.ownGeometry(createVentGeometry(0.28, 0.035));
    const ventMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderSubtle));
    for (let index = 0; index < 6; index += 1) {
      const vent = new THREE.Mesh(ventGeometry, ventMaterial);
      vent.position.set(-2.14 + index * 0.18, 0.18, -1.93);
      vent.rotation.x = Math.PI / 2;
      vent.userData.role = 'node-vent';
      this.addContent(vent);
    }
  }

  private addEmbeddedKubelet(): void {
    this.embeddedKubelet.name = 'embedded-kubelet';
    this.embeddedKubelet.position.set(...NodeVisualHandle.kubeletOffset);
    this.embeddedKubelet.userData.role = 'embedded-kubelet';
    this.embeddedKubelet.userData.selectable = false;

    const bayGeometry = this.ownGeometry(createRoundedBoxGeometry(1.28, 0.12, 0.68, 0.075));
    const bayMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.7, metalness: 0.04 }),
    );
    const bay = new THREE.Mesh(bayGeometry, bayMaterial);
    bay.position.y = -0.055;
    bay.userData.role = 'kubelet-bay';
    this.embeddedKubelet.add(bay);

    this.kubeletPlaceholder.name = 'kubelet-placeholder';
    this.kubeletPlaceholder.userData.role = 'kubelet-placeholder';
    const moduleGeometry = this.ownGeometry(createRoundedBoxGeometry(1.05, 0.3, 0.48, 0.075));
    const moduleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x284b65, roughness: 0.48, metalness: 0.12 }),
    );
    const module = new THREE.Mesh(moduleGeometry, moduleMaterial);
    module.position.y = 0.15;
    module.castShadow = true;
    module.userData.role = 'kubelet-placeholder-module';
    this.kubeletPlaceholder.add(module);

    const pulseGeometry = this.ownGeometry(new THREE.BoxGeometry(0.055, 0.13, 0.02));
    const pulseMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.82));
    for (let index = 0; index < 4; index += 1) {
      const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
      pulse.position.set(-0.3 + index * 0.2, 0.33, -0.25);
      pulse.scale.y = index % 2 === 0 ? 0.65 : 1;
      pulse.userData.role = 'kubelet-activity-mark';
      this.kubeletPlaceholder.add(pulse);
    }
    this.embeddedKubelet.add(this.kubeletPlaceholder);

    this.kubeletMount.name = 'kubelet-entity-mount';
    this.kubeletMount.userData.role = 'kubelet-entity-mount';
    this.kubeletMount.userData.moduleKind = 'Kubelet';
    this.kubeletMount.userData.selectable = false;
    this.embeddedKubelet.add(this.kubeletMount);
    this.addContent(this.embeddedKubelet);
  }

  private addEmbeddedRuntime(): void {
    this.embeddedRuntime.name = 'embedded-container-runtime';
    this.embeddedRuntime.position.set(...NodeVisualHandle.runtimeOffset);
    this.embeddedRuntime.userData.role = 'embedded-container-runtime';
    this.embeddedRuntime.userData.selectable = false;

    const bayGeometry = this.ownGeometry(createRoundedBoxGeometry(1.28, 0.12, 0.68, 0.075));
    const bayMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.7, metalness: 0.04 }),
    );
    const bay = new THREE.Mesh(bayGeometry, bayMaterial);
    bay.position.y = -0.055;
    bay.userData.role = 'container-runtime-bay';
    this.embeddedRuntime.add(bay);

    this.runtimePlaceholder.name = 'container-runtime-placeholder';
    this.runtimePlaceholder.userData.role = 'container-runtime-placeholder';
    const moduleGeometry = this.ownGeometry(createRoundedBoxGeometry(1.08, 0.32, 0.5, 0.07));
    const moduleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: palette.surfaceSecondary, roughness: 0.5, metalness: 0.22 }),
    );
    const module = new THREE.Mesh(moduleGeometry, moduleMaterial);
    module.position.y = 0.16;
    module.castShadow = true;
    module.userData.role = 'container-runtime-placeholder-module';
    this.runtimePlaceholder.add(module);

    const socketGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12));
    const socketMaterial = this.ownMaterial(createFlatAccentMaterial(palette.scheduling, 0.76));
    const socket = new THREE.Mesh(socketGeometry, socketMaterial);
    socket.position.set(0, 0.34, 0);
    socket.userData.role = 'container-runtime-placeholder-cri-port';
    this.runtimePlaceholder.add(socket);
    this.embeddedRuntime.add(this.runtimePlaceholder);

    this.runtimeMount.name = 'container-runtime-entity-mount';
    this.runtimeMount.userData.role = 'container-runtime-entity-mount';
    this.runtimeMount.userData.moduleKind = 'ContainerRuntime';
    this.runtimeMount.userData.selectable = false;
    this.embeddedRuntime.add(this.runtimeMount);
    this.addContent(this.embeddedRuntime);
  }

  public attachKubelet(handle: EntityVisualHandle): void {
    if (handle.entityId === this.mountedKubeletId && handle.root.parent === this.kubeletMount)
      return;
    handle.root.removeFromParent();
    handle.root.position.set(0, 0, 0);
    handle.root.userData.composedInNode = this.entityId;
    this.kubeletMount.add(handle.root);
    this.mountedKubeletId = handle.entityId;
    this.kubeletPlaceholder.visible = false;
    this.root.userData.kubeletEntityId = handle.entityId;
  }

  public detachKubelet(entityId: EntityId, destination?: THREE.Object3D): THREE.Group | undefined {
    if (entityId !== this.mountedKubeletId) return undefined;
    const root = this.kubeletMount.children.find(
      (child): child is THREE.Group =>
        child instanceof THREE.Group && child.userData.entityId === entityId,
    );
    if (root && destination) destination.attach(root);
    else root?.removeFromParent();
    if (root) delete root.userData.composedInNode;
    this.mountedKubeletId = undefined;
    this.kubeletPlaceholder.visible = true;
    delete this.root.userData.kubeletEntityId;
    return root;
  }

  public hasKubelet(entityId: EntityId): boolean {
    return this.mountedKubeletId === entityId;
  }

  public attachRuntime(handle: EntityVisualHandle): void {
    if (handle.entityId === this.mountedRuntimeId && handle.root.parent === this.runtimeMount)
      return;
    handle.root.removeFromParent();
    handle.root.position.set(0, 0, 0);
    handle.root.userData.composedInNode = this.entityId;
    this.runtimeMount.add(handle.root);
    this.mountedRuntimeId = handle.entityId;
    this.runtimePlaceholder.visible = false;
    this.root.userData.runtimeEntityId = handle.entityId;
  }

  public detachRuntime(entityId: EntityId, destination?: THREE.Object3D): THREE.Group | undefined {
    if (entityId !== this.mountedRuntimeId) return undefined;
    const root = this.runtimeMount.children.find(
      (child): child is THREE.Group =>
        child instanceof THREE.Group && child.userData.entityId === entityId,
    );
    if (root && destination) destination.attach(root);
    else root?.removeFromParent();
    if (root) delete root.userData.composedInNode;
    this.mountedRuntimeId = undefined;
    this.runtimePlaceholder.visible = true;
    delete this.root.userData.runtimeEntityId;
    return root;
  }

  public hasRuntime(entityId: EntityId): boolean {
    return this.mountedRuntimeId === entityId;
  }

  private addAlertBars(): void {
    const geometry = this.ownGeometry(new THREE.BoxGeometry(0.22, 0.045, 0.035));
    const material = this.ownMaterial(createFlatAccentMaterial(palette.failed));
    for (const offset of [-0.055, 0.055]) {
      const bar = new THREE.Mesh(geometry, material);
      bar.position.y = offset;
      bar.rotation.z = offset < 0 ? Math.PI / 4 : -Math.PI / 4;
      this.alertBars.add(bar);
    }
    this.alertBars.position.copy(this.statusIndicator.position);
    this.alertBars.visible = false;
    this.alertBars.userData.role = 'node-status-alert';
    this.addContent(this.alertBars);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const healthy = entity.status === 'ready' || entity.status === 'healthy';
    this.chassisMaterial.color.setHex(palette.surfacePrimary);
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.statusIndicator.visible = healthy;
    this.alertBars.visible = !healthy;
    this.root.userData.nodeName = entity.name;
    this.root.userData.shortLabel = shortResourceName(entity.name, 18);
    this.root.userData.statusText = statusLabel(entity.status);
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: shortResourceName(entity.name, 18),
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(-1.72, 0.96, -1.95);
    if (anchor === 'placement') return new THREE.Vector3(0, 0.6, 0);
    if (anchor === 'control') {
      return new THREE.Vector3(...dimensions.node.kubeletMountOffset);
    }
    if (anchor === 'data-path') return new THREE.Vector3(0, 0.72, -1.75);
    return super.anchorOffset(anchor);
  }
}
