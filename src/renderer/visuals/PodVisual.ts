import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import { getContainerData, getPodData } from '../../world/dataGuards';
import type { EntityId, WorldEntity } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { createRoundedBoxGeometry } from '../design/geometry';
import {
  applyMaterialStatus,
  createFlatAccentMaterial,
  createShellMaterial,
  createSurfaceMaterial,
} from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName } from '../design/typography';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';
import type { ContainerVisualHandle } from './ContainerVisual';

export class PodVisualHandle extends BaseVisualHandle {
  public readonly shell: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  public readonly containerBay = new THREE.Group();
  private readonly header: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly statusRailMaterial: THREE.MeshBasicMaterial;
  private readonly runningMarker: THREE.Mesh;
  private readonly pendingMarker: THREE.Mesh;
  private readonly failureMarker = new THREE.Group();
  private readonly containers = new Map<EntityId, ContainerVisualHandle>();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.08);
    this.root.userData.visualKind = 'pod-shell';

    const shellGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.pod.width,
        dimensions.pod.shellHeight,
        dimensions.pod.depth,
        dimensions.pod.cornerRadius,
        5,
      ),
    );
    const shellMaterial = this.ownMaterial(createShellMaterial());
    this.shell = this.markSelectable(new THREE.Mesh(shellGeometry, shellMaterial), 'pod-shell');
    this.shell.position.y = 0.78;
    this.shell.castShadow = true;
    this.addContent(this.shell);

    const outlineGeometry = this.ownGeometry(new THREE.EdgesGeometry(shellGeometry, 24));
    const outlineMaterial = this.ownMaterial(
      new THREE.LineBasicMaterial({
        color: palette.dataFlow,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
    outline.position.copy(this.shell.position);
    outline.renderOrder = 6;
    outline.userData.role = 'pod-shell-outline';
    outline.userData.selectable = false;
    this.addContent(outline);

    const headerGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.pod.width - 0.08,
        dimensions.pod.headerHeight,
        dimensions.pod.depth - 0.08,
        0.11,
      ),
    );
    const headerMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'elevated', roughness: 0.46, metalness: 0.08 }),
    );
    this.header = new THREE.Mesh(headerGeometry, headerMaterial);
    this.header.position.y = 1.38;
    this.header.castShadow = true;
    this.header.userData.role = 'pod-header';
    this.addContent(this.header);
    this.addPodPictogram();

    const bayGeometry = this.ownGeometry(createRoundedBoxGeometry(1.43, 0.075, 0.98, 0.08));
    const bayMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.03 }),
    );
    const bayFloor = new THREE.Mesh(bayGeometry, bayMaterial);
    bayFloor.position.y = 0.28;
    bayFloor.receiveShadow = true;
    bayFloor.userData.role = 'container-bay';
    this.addContent(bayFloor);

    this.containerBay.name = 'pod-container-bay';
    this.containerBay.position.y = 0.31;
    this.containerBay.userData.role = 'container-bay-contents';
    this.addContent(this.containerBay);

    const railGeometry = this.ownGeometry(createRoundedBoxGeometry(1.1, 0.085, 0.055, 0.028));
    this.statusRailMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const rail = new THREE.Mesh(railGeometry, this.statusRailMaterial);
    rail.position.set(-0.12, 1.39, -0.67);
    rail.userData.role = 'pod-status-rail';
    this.addContent(rail);

    this.runningMarker = this.createRunningMarker();
    this.pendingMarker = this.createPendingMarker();
    this.addFailureMarker();
    this.update(entity, view);
  }

  private addPodPictogram(): void {
    const dotGeometry = this.ownGeometry(new THREE.SphereGeometry(0.045, 10, 8));
    const dotMaterial = this.ownMaterial(createFlatAccentMaterial(0xedf5fb));
    const pictogram = new THREE.Group();
    pictogram.position.set(-0.58, 1.39, -0.67);
    pictogram.userData.role = 'pod-pictogram';
    for (let index = 0; index < 3; index += 1) {
      const angle = (index / 3) * Math.PI * 2 - Math.PI / 2;
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(Math.cos(angle) * 0.095, Math.sin(angle) * 0.095, 0);
      pictogram.add(dot);
    }
    this.addContent(pictogram);
  }

  private createRunningMarker(): THREE.Mesh {
    const geometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.026, 18));
    const material = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const marker = new THREE.Mesh(geometry, material);
    marker.rotation.x = Math.PI / 2;
    marker.position.set(0.68, 1.39, -0.69);
    marker.userData.role = 'pod-running-marker';
    this.addContent(marker);
    return marker;
  }

  private createPendingMarker(): THREE.Mesh {
    const geometry = this.ownGeometry(new THREE.TorusGeometry(0.075, 0.024, 8, 18));
    const material = this.ownMaterial(createFlatAccentMaterial(palette.pending));
    const marker = new THREE.Mesh(geometry, material);
    marker.position.set(0.68, 1.39, -0.69);
    marker.userData.role = 'pod-pending-marker';
    this.addContent(marker);
    return marker;
  }

  private addFailureMarker(): void {
    const geometry = this.ownGeometry(new THREE.BoxGeometry(0.19, 0.042, 0.025));
    const material = this.ownMaterial(createFlatAccentMaterial(palette.failed));
    for (const rotation of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(geometry, material);
      bar.rotation.z = rotation;
      this.failureMarker.add(bar);
    }
    this.failureMarker.position.set(0.68, 1.39, -0.69);
    this.failureMarker.userData.role = 'pod-failure-marker';
    this.addContent(this.failureMarker);
  }

  public attachContainer(handle: ContainerVisualHandle): void {
    if (this.isDisposed || handle.isDisposed) return;
    const data = getContainerData(handle.entity);
    if (data.podId !== this.entityId) {
      throw new Error(
        `Container "${handle.entityId}" belongs to "${data.podId}", not "${this.entityId}".`,
      );
    }
    this.containers.set(handle.entityId, handle);
    this.containerBay.add(handle.root);
    handle.root.userData.composedInPod = this.entityId;
    this.layoutContainers();
    this.refreshContainerEvidence();
  }

  public detachContainer(containerId: EntityId): void {
    const handle = this.containers.get(containerId);
    if (!handle) return;
    handle.root.removeFromParent();
    delete handle.root.userData.composedInPod;
    this.containers.delete(containerId);
    this.layoutContainers();
    this.refreshContainerEvidence();
  }

  public hasContainer(containerId: EntityId): boolean {
    return this.containers.has(containerId);
  }

  private layoutContainers(): void {
    const handles = [...this.containers.values()].sort((left, right) =>
      left.entityId.localeCompare(right.entityId),
    );
    const center = (handles.length - 1) / 2;
    handles.forEach((handle, index) => {
      handle.root.position.set((index - center) * 0.7, 0, 0);
    });
  }

  private refreshContainerEvidence(): void {
    const restartCount = [...this.containers.values()].reduce(
      (total, handle) => total + getContainerData(handle.entity).restartCount,
      0,
    );
    this.root.userData.restartCount = restartCount;
    this.root.userData.containerCount = this.containers.size;
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = getPodData(entity);
    const failed = data.phase === 'Failed';
    const pending = data.phase === 'Pending';
    const ready = data.conditions.ready;
    const derivedStatus: WorldEntity['status'] = failed
      ? 'failed'
      : pending
        ? 'pending'
        : ready
          ? 'ready'
          : 'not-ready';
    applyMaterialStatus(this.statusRailMaterial, derivedStatus);
    this.header.material.color.setHex(pending || !ready ? 0x3a3540 : palette.surfaceElevated);
    this.runningMarker.visible = !failed && !pending && ready;
    this.pendingMarker.visible = !failed && (pending || !ready);
    this.failureMarker.visible = failed;

    this.root.userData.uid = data.uid;
    this.root.userData.nodeName = data.nodeName ?? null;
    this.root.userData.phase = data.phase;
    this.root.userData.conditions = Object.freeze({ ...data.conditions });
    this.root.userData.ready = ready;
    this.root.userData.shortLabel = shortResourceName(entity.name, 18);
    this.root.userData.statusText = ready ? 'READY' : 'NOT READY';
    this.root.userData.visibleText = `${shortResourceName(entity.name, 18)} · ${data.phase.toUpperCase()} · ${ready ? 'READY' : 'NOT READY'}`;
    this.refreshContainerEvidence();
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.72, 0);
    if (anchor === 'ownership') return new THREE.Vector3(-0.88, 1.08, 0);
    if (anchor === 'placement') return new THREE.Vector3(0.88, 0.5, 0);
    if (anchor === 'composition') return new THREE.Vector3(0, 0.63, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 1.16, -0.67);
    if (anchor === 'data-path') return new THREE.Vector3(0, 0.78, 0.68);
    return super.anchorOffset(anchor);
  }

  protected override onDispose(): void {
    for (const handle of this.containers.values()) {
      handle.root.removeFromParent();
      delete handle.root.userData.composedInPod;
    }
    this.containers.clear();
  }
}
