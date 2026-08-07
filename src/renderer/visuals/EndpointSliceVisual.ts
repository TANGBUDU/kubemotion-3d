import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName } from '../design/typography';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

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
}

/** A compact endpoint table that keeps NotReady entries visible instead of deleting them. */
export class EndpointSliceVisualHandle extends BaseVisualHandle {
  public readonly endpointSlots: readonly THREE.Group[];
  private readonly slotVisuals: readonly EndpointSlotVisual[];

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.88);
    this.root.userData.visualKind = 'endpoint-slice-table';

    const bodyGeometry = this.ownGeometry(createRoundedBoxGeometry(3.12, 0.48, 1.86, 0.2, 5));
    const bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.58, metalness: 0.08 }),
    );
    const body = this.markSelectable(
      new THREE.Mesh(bodyGeometry, bodyMaterial),
      'endpoint-slice-table',
    );
    body.position.y = 0.3;
    body.castShadow = true;
    body.receiveShadow = true;
    this.addContent(body);

    const headerGeometry = this.ownGeometry(createRoundedBoxGeometry(2.88, 0.12, 0.34, 0.055));
    const headerMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.9));
    const header = new THREE.Mesh(headerGeometry, headerMaterial);
    header.position.set(0, 0.6, -0.61);
    header.userData.role = 'endpoint-slice-header';
    this.addContent(header);

    const readyMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const notReadyMaterial = this.ownMaterial(createFlatAccentMaterial(palette.pending));
    const slotPlateGeometry = this.ownGeometry(createRoundedBoxGeometry(0.78, 0.09, 0.86, 0.08));
    const slotPlateMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.03 }),
    );
    const readyDotGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20));
    const notReadyRingGeometry = this.ownGeometry(new THREE.TorusGeometry(0.14, 0.035, 8, 20));
    const notReadySlashGeometry = this.ownGeometry(new THREE.BoxGeometry(0.36, 0.055, 0.055));

    const slots: EndpointSlotVisual[] = [];
    for (let index = 0; index < 3; index += 1) {
      const slotRoot = new THREE.Group();
      slotRoot.position.set((index - 1) * 0.92, 0, 0.15);
      slotRoot.userData.role = 'endpoint-slot';
      slotRoot.userData.index = index;

      const plate = new THREE.Mesh(slotPlateGeometry, slotPlateMaterial);
      plate.position.y = 0.58;
      plate.userData.role = 'endpoint-slot-plate';
      slotRoot.add(plate);

      const readyDot = new THREE.Mesh(readyDotGeometry, readyMaterial);
      readyDot.position.set(0, 0.68, 0);
      readyDot.userData.role = 'endpoint-ready-marker';
      slotRoot.add(readyDot);

      const notReadyRing = new THREE.Mesh(notReadyRingGeometry, notReadyMaterial);
      notReadyRing.rotation.x = Math.PI / 2;
      notReadyRing.position.set(0, 0.69, 0);
      notReadyRing.userData.role = 'endpoint-not-ready-ring';
      slotRoot.add(notReadyRing);

      const notReadySlash = new THREE.Mesh(notReadySlashGeometry, notReadyMaterial);
      notReadySlash.position.set(0, 0.695, 0);
      notReadySlash.rotation.y = Math.PI / 4;
      notReadySlash.userData.role = 'endpoint-not-ready-slash';
      slotRoot.add(notReadySlash);

      this.addContent(slotRoot);
      slots.push({ root: slotRoot, readyDot, notReadyRing, notReadySlash });
    }
    this.slotVisuals = slots;
    this.endpointSlots = Object.freeze(slots.map((slot) => slot.root));
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const endpoints = endpointStates(entity);
    this.slotVisuals.forEach((slot, index) => {
      const endpoint = endpoints[index];
      slot.root.visible = endpoint !== undefined;
      slot.root.userData.address = endpoint?.address ?? null;
      slot.root.userData.targetRef = endpoint?.targetRef ?? null;
      slot.root.userData.ready = endpoint?.ready ?? false;
      slot.root.userData.serving = endpoint?.serving ?? false;
      slot.root.userData.terminating = endpoint?.terminating ?? false;
      slot.readyDot.visible = endpoint?.ready === true;
      slot.notReadyRing.visible = endpoint !== undefined && endpoint.ready === false;
      slot.notReadySlash.visible = endpoint !== undefined && endpoint.ready === false;
    });

    const readyCount = endpoints.filter((endpoint) => endpoint.ready).length;
    this.root.userData.endpointCount = endpoints.length;
    this.root.userData.readyEndpointCount = readyCount;
    this.root.userData.endpointStates = endpoints.map((endpoint) => ({ ...endpoint }));
    this.root.userData.shortLabel = `EndpointSlice · ${shortResourceName(entity.name, 13)}`;
    this.root.userData.visibleText = `${entity.name} · ${readyCount}/${endpoints.length} Ready`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `EndpointSlice · ${shortResourceName(entity.name, 11)} · R${readyCount}/${endpoints.length}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.23, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.56, -0.92);
    if (anchor === 'data-path') return new THREE.Vector3(0, 0.56, 0.92);
    return super.anchorOffset(anchor);
  }
}
