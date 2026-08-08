import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName } from '../design/typography';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

export const MAX_ENDPOINT_SLICE_ROWS = 9;

interface EndpointState {
  readonly address: string;
  readonly targetRef: string;
  readonly ready: boolean;
  readonly serving: boolean;
  readonly terminating: boolean;
}

function endpointStates(entity: WorldEntity): readonly EndpointState[] {
  const endpoints = entity.data.endpoints;
  if (!Array.isArray(endpoints)) return [];
  return endpoints.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return [];
    const record = candidate as Readonly<Record<string, unknown>>;
    const conditions =
      record.conditions &&
      typeof record.conditions === 'object' &&
      !Array.isArray(record.conditions)
        ? (record.conditions as Readonly<Record<string, unknown>>)
        : {};
    return [
      {
        address: typeof record.address === 'string' ? record.address : 'unknown',
        targetRef: typeof record.targetRef === 'string' ? record.targetRef : 'unknown',
        // EndpointConditions.ready defaults to true when omitted by the API.
        ready: conditions.ready !== false,
        serving: conditions.serving !== false,
        terminating: conditions.terminating === true,
      },
    ];
  });
}

interface EndpointSlotVisual {
  readonly root: THREE.Group;
  readonly readyDot: THREE.Mesh;
  readonly notReadyRing: THREE.Mesh;
  readonly notReadySlash: THREE.Mesh;
  readonly servingMarker: THREE.Group;
  readonly terminatingMarker: THREE.Group;
  readonly selectedOutline: THREE.LineSegments;
  readonly addressRails: readonly THREE.Mesh[];
  readonly targetChip: THREE.Mesh;
}

/** Endpoint inventory card with dynamic rows and route-driven selected-backend evidence. */
export class EndpointSliceVisualHandle extends BaseVisualHandle {
  private readonly slotVisuals: EndpointSlotVisual[] = [];
  private readonly body: THREE.Mesh;
  private readonly header: THREE.Mesh;
  private readonly slotPlateGeometry: THREE.BufferGeometry;
  private readonly slotPlateMaterial: THREE.MeshStandardMaterial;
  private readonly readyDotGeometry: THREE.BufferGeometry;
  private readonly readyMaterial: THREE.MeshBasicMaterial;
  private readonly notReadyRingGeometry: THREE.BufferGeometry;
  private readonly notReadySlashGeometry: THREE.BufferGeometry;
  private readonly notReadyMaterial: THREE.MeshBasicMaterial;
  private readonly conditionBarGeometry: THREE.BufferGeometry;
  private readonly servingMaterial: THREE.MeshBasicMaterial;
  private readonly terminatingMaterial: THREE.MeshBasicMaterial;
  private readonly selectedOutlineGeometry: THREE.BufferGeometry;
  private readonly selectedMaterial: THREE.MeshBasicMaterial;
  private readonly addressRailGeometry: THREE.BufferGeometry;
  private readonly addressMaterial: THREE.MeshBasicMaterial;
  private readonly targetChipGeometry: THREE.BufferGeometry;
  private readonly targetMaterial: THREE.MeshStandardMaterial;
  private selectedTargetRef: string | undefined;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.05);
    this.root.userData.visualKind = 'endpoint-slice-inventory-card';

    const bodyGeometry = this.ownGeometry(createRoundedBoxGeometry(3.28, 0.48, 2.5, 0.2, 5));
    const bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.58, metalness: 0.08 }),
    );
    this.body = this.markSelectable(
      new THREE.Mesh(bodyGeometry, bodyMaterial),
      'endpoint-slice-table',
    );
    this.body.position.y = 0.3;
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.addContent(this.body);

    const headerGeometry = this.ownGeometry(createRoundedBoxGeometry(3.02, 0.12, 0.34, 0.055));
    const headerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.9));
    this.header = new THREE.Mesh(headerGeometry, headerMaterial);
    this.header.position.set(0, 0.6, -0.92);
    this.header.userData.role = 'endpoint-slice-header';
    this.addContent(this.header);

    this.readyMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    this.notReadyMaterial = this.ownMaterial(createFlatAccentMaterial(palette.pending));
    this.servingMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.92));
    this.terminatingMaterial = this.ownMaterial(createFlatAccentMaterial(palette.failed, 0.95));
    this.selectedMaterial = this.ownMaterial(createFlatAccentMaterial(0xf8d57e, 0.98));
    this.addressMaterial = this.ownMaterial(createFlatAccentMaterial(0xcbe8f6, 0.92));
    this.targetMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x28465b, roughness: 0.56, metalness: 0.06 }),
    );
    this.slotPlateMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.03 }),
    );

    this.slotPlateGeometry = this.ownGeometry(createRoundedBoxGeometry(0.82, 0.09, 0.72, 0.08));
    this.readyDotGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 18));
    this.notReadyRingGeometry = this.ownGeometry(new THREE.TorusGeometry(0.1, 0.03, 8, 18));
    this.notReadySlashGeometry = this.ownGeometry(new THREE.BoxGeometry(0.27, 0.05, 0.045));
    this.conditionBarGeometry = this.ownGeometry(new THREE.BoxGeometry(0.18, 0.045, 0.035));
    const selectedOutlineSource = this.ownGeometry(createRoundedBoxGeometry(0.9, 0.13, 0.8, 0.09));
    this.selectedOutlineGeometry = this.ownGeometry(
      new THREE.EdgesGeometry(selectedOutlineSource, 24),
    );
    this.addressRailGeometry = this.ownGeometry(new THREE.BoxGeometry(0.26, 0.026, 0.028));
    this.targetChipGeometry = this.ownGeometry(createRoundedBoxGeometry(0.46, 0.045, 0.14, 0.04));

    this.update(entity, view);
  }

  public get endpointSlots(): readonly THREE.Group[] {
    return this.slotVisuals.map((slot) => slot.root);
  }

  private createSlot(index: number): EndpointSlotVisual {
    const root = new THREE.Group();
    root.userData.role = 'endpoint-row';
    root.userData.index = index;

    const plate = new THREE.Mesh(this.slotPlateGeometry, this.slotPlateMaterial);
    plate.position.y = 0.58;
    plate.userData.role = 'endpoint-row-plate';
    root.add(plate);

    const selectedOutline = new THREE.LineSegments(
      this.selectedOutlineGeometry,
      this.selectedMaterial,
    );
    selectedOutline.position.y = 0.59;
    selectedOutline.userData.role = 'endpoint-selected-outline';
    selectedOutline.visible = false;
    selectedOutline.renderOrder = 12;
    root.add(selectedOutline);

    const readyDot = new THREE.Mesh(this.readyDotGeometry, this.readyMaterial);
    readyDot.position.set(0.29, 0.68, -0.22);
    readyDot.userData.role = 'endpoint-ready-marker';
    root.add(readyDot);

    const notReadyRing = new THREE.Mesh(this.notReadyRingGeometry, this.notReadyMaterial);
    notReadyRing.rotation.x = Math.PI / 2;
    notReadyRing.position.set(0.29, 0.69, -0.22);
    notReadyRing.userData.role = 'endpoint-not-ready-ring';
    root.add(notReadyRing);

    const notReadySlash = new THREE.Mesh(this.notReadySlashGeometry, this.notReadyMaterial);
    notReadySlash.position.set(0.29, 0.695, -0.22);
    notReadySlash.rotation.y = Math.PI / 4;
    notReadySlash.userData.role = 'endpoint-not-ready-slash';
    root.add(notReadySlash);

    const servingMarker = new THREE.Group();
    servingMarker.position.set(0.27, 0.67, 0.17);
    servingMarker.userData.role = 'endpoint-serving-marker';
    for (const z of [-0.035, 0.035]) {
      const bar = new THREE.Mesh(this.conditionBarGeometry, this.servingMaterial);
      bar.position.z = z;
      servingMarker.add(bar);
    }
    root.add(servingMarker);

    const terminatingMarker = new THREE.Group();
    terminatingMarker.position.set(0.27, 0.68, 0.17);
    terminatingMarker.userData.role = 'endpoint-terminating-marker';
    for (const rotation of [Math.PI / 4, -Math.PI / 4]) {
      const bar = new THREE.Mesh(this.conditionBarGeometry, this.terminatingMaterial);
      bar.rotation.y = rotation;
      terminatingMarker.add(bar);
    }
    root.add(terminatingMarker);

    const addressRails: THREE.Mesh[] = [];
    for (let railIndex = 0; railIndex < 4; railIndex += 1) {
      const rail = new THREE.Mesh(this.addressRailGeometry, this.addressMaterial);
      rail.position.set(-0.17, 0.67, -0.23 + railIndex * 0.105);
      rail.userData.role = 'endpoint-address-rail';
      rail.userData.octetIndex = railIndex;
      addressRails.push(rail);
      root.add(rail);
    }

    const targetChip = new THREE.Mesh(this.targetChipGeometry, this.targetMaterial);
    targetChip.position.set(-0.04, 0.65, 0.27);
    targetChip.userData.role = 'endpoint-target-pod-chip';
    root.add(targetChip);

    this.addContent(root);
    return {
      root,
      readyDot,
      notReadyRing,
      notReadySlash,
      servingMarker,
      terminatingMarker,
      selectedOutline,
      addressRails,
      targetChip,
    };
  }

  private ensureSlotCapacity(count: number): void {
    if (count > MAX_ENDPOINT_SLICE_ROWS) {
      throw new Error(
        `EndpointSlice "${this.entityId}" exposes ${count} endpoints; the teaching card supports at most ${MAX_ENDPOINT_SLICE_ROWS}.`,
      );
    }
    while (this.slotVisuals.length < count) {
      this.slotVisuals.push(this.createSlot(this.slotVisuals.length));
    }
  }

  private layoutSlots(count: number): void {
    const columnCount = Math.min(3, Math.max(1, count));
    const rowCount = Math.max(1, Math.ceil(count / columnCount));
    const bodyDepthScale = 0.72 + Math.max(0, rowCount - 1) * 0.34;
    this.body.scale.z = bodyDepthScale;
    this.header.position.z = -(2.5 * bodyDepthScale) / 2 + 0.3;
    this.slotVisuals.forEach((slot, index) => {
      const row = Math.floor(index / columnCount);
      const itemsInRow = Math.min(columnCount, Math.max(0, count - row * columnCount));
      const column = index % columnCount;
      slot.root.position.set(
        (column - (itemsInRow - 1) / 2) * 0.98,
        0,
        (row - (rowCount - 1) / 2) * 0.82 + 0.2,
      );
    });
    this.root.userData.endpointRowCount = rowCount;
    this.root.userData.endpointColumnCount = columnCount;
  }

  private updateAddress(slot: EndpointSlotVisual, address: string): void {
    const parts = address.split('.');
    slot.addressRails.forEach((rail, index) => {
      const part = parts[index] ?? '';
      const normalized = Math.min(1, Math.max(0.32, part.length / 3));
      rail.scale.x = normalized;
      rail.position.x = -0.29 + (0.26 * normalized) / 2;
      rail.userData.value = part;
    });
  }

  /** Presentation-only selection derived from the active route; it never mutates endpoint facts. */
  public setSelectedEndpoint(targetRef?: string): void {
    this.selectedTargetRef = targetRef;
    let selectedAddress: string | undefined;
    for (const slot of this.slotVisuals) {
      const selected = targetRef !== undefined && slot.root.userData.targetRef === targetRef;
      slot.selectedOutline.visible = selected;
      slot.root.userData.selected = selected;
      if (selected && typeof slot.root.userData.address === 'string') {
        selectedAddress = slot.root.userData.address;
      }
    }
    this.root.userData.selectedEndpointTarget = targetRef ?? null;
    this.root.userData.selectedEndpointAddress = selectedAddress ?? null;
  }

  protected override updateVisual(entity: WorldEntity): void {
    const endpoints = endpointStates(entity);
    this.ensureSlotCapacity(endpoints.length);
    this.layoutSlots(endpoints.length);
    this.slotVisuals.forEach((slot, index) => {
      const endpoint = endpoints[index];
      slot.root.visible = endpoint !== undefined;
      slot.root.userData.address = endpoint?.address ?? null;
      slot.root.userData.targetRef = endpoint?.targetRef ?? null;
      slot.root.userData.ready = endpoint?.ready ?? false;
      slot.root.userData.serving = endpoint?.serving ?? false;
      slot.root.userData.terminating = endpoint?.terminating ?? false;
      slot.root.userData.visibleText = endpoint
        ? `${endpoint.address} • ${shortResourceName(endpoint.targetRef, 18)} • ready=${String(endpoint.ready)} • serving=${String(endpoint.serving)} • terminating=${String(endpoint.terminating)}`
        : '';
      slot.readyDot.visible = endpoint?.ready === true;
      slot.notReadyRing.visible = endpoint !== undefined && endpoint.ready === false;
      slot.notReadySlash.visible = endpoint !== undefined && endpoint.ready === false;
      slot.servingMarker.visible = endpoint?.serving === true && endpoint.terminating === false;
      slot.terminatingMarker.visible = endpoint?.terminating === true;
      slot.targetChip.userData.targetRef = endpoint?.targetRef ?? null;
      if (endpoint) this.updateAddress(slot, endpoint.address);
    });

    const readyCount = endpoints.filter((endpoint) => endpoint.ready).length;
    this.root.userData.endpointCount = endpoints.length;
    this.root.userData.readyEndpointCount = readyCount;
    this.root.userData.endpointStates = endpoints.map((endpoint) => ({ ...endpoint }));
    this.root.userData.shortLabel = `EndpointSlice • ${shortResourceName(entity.name, 13)}`;
    this.root.userData.visibleText = `${entity.name} • ${readyCount}/${endpoints.length} Ready`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `EndpointSlice • ${shortResourceName(entity.name, 11)} • R${readyCount}/${endpoints.length}`,
      anchor: 'label',
    });
    this.setSelectedEndpoint(this.selectedTargetRef);
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.23, 0);
    if (anchor === 'control' || anchor === 'api-in') return new THREE.Vector3(-1.12, 0.56, 0);
    if (anchor === 'api-out') return new THREE.Vector3(1.12, 0.56, 0);
    return super.anchorOffset(anchor);
  }
}
