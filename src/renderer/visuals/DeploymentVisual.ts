import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

const REPLICA_SLOT_CAPACITY = 6;

interface DeploymentVisualData {
  readonly desiredReplicas: number;
  readonly strategy: string;
  readonly revision: string;
  readonly version: string;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scalarText = (value: unknown, fallback: string): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const strategyText = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (isRecord(value)) return scalarText(value.type, 'Unspecified');
  return 'Unspecified';
};

const deploymentVisualData = (entity: WorldEntity): DeploymentVisualData => ({
  desiredReplicas:
    typeof entity.data.desiredReplicas === 'number' && Number.isFinite(entity.data.desiredReplicas)
      ? Math.max(0, Math.trunc(entity.data.desiredReplicas))
      : 0,
  strategy: strategyText(entity.data.strategy),
  revision: scalarText(entity.data.revision, 'unknown'),
  version: scalarText(entity.data.version, 'unversioned'),
});

/** Desired-state application blueprint; the fixed meshes are updated in place as rollout data changes. */
export class DeploymentVisualHandle extends BaseVisualHandle {
  private readonly strategyBadge: THREE.Mesh;
  private readonly versionBadge: THREE.Mesh;
  private readonly replicaSlots: readonly THREE.Mesh[];
  private readonly rolloutArrow = new THREE.Group();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.15);
    this.root.userData.visualKind = 'deployment-blueprint';
    this.root.userData.configurationObject = true;
    this.root.userData.runtimeInstance = false;
    this.root.userData.desiredState = true;

    const boardGeometry = this.ownGeometry(createRoundedBoxGeometry(3.55, 0.28, 2.38, 0.18, 4));
    const boardMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x243b5a, roughness: 0.56, metalness: 0.08 }),
    );
    const board = this.markSelectable(
      new THREE.Mesh(boardGeometry, boardMaterial),
      'deployment-blueprint-board',
    );
    board.position.y = 0.14;
    board.castShadow = true;
    board.receiveShadow = true;
    this.addContent(board);

    const gridMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.34));
    const verticalGridGeometry = this.ownGeometry(new THREE.BoxGeometry(0.025, 0.025, 1.82));
    const horizontalGridGeometry = this.ownGeometry(new THREE.BoxGeometry(3.02, 0.025, 0.025));
    for (let index = -2; index <= 2; index += 1) {
      const line = new THREE.Mesh(verticalGridGeometry, gridMaterial);
      line.position.set(index * 0.6, 0.292, 0);
      line.userData.role = 'deployment-blueprint-grid';
      line.userData.axis = 'vertical';
      this.addContent(line);
    }
    for (let index = -1; index <= 1; index += 1) {
      const line = new THREE.Mesh(horizontalGridGeometry, gridMaterial);
      line.position.set(0, 0.292, index * 0.58);
      line.userData.role = 'deployment-blueprint-grid';
      line.userData.axis = 'horizontal';
      this.addContent(line);
    }

    const badgeGeometry = this.ownGeometry(createRoundedBoxGeometry(1.28, 0.11, 0.38, 0.055));
    this.strategyBadge = new THREE.Mesh(
      badgeGeometry,
      this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.94)),
    );
    this.strategyBadge.position.set(-0.78, 0.37, -0.82);
    this.strategyBadge.userData.role = 'deployment-strategy-badge';
    this.addContent(this.strategyBadge);

    this.versionBadge = new THREE.Mesh(
      badgeGeometry,
      this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.94)),
    );
    this.versionBadge.position.set(0.78, 0.37, -0.82);
    this.versionBadge.userData.role = 'deployment-version-badge';
    this.addContent(this.versionBadge);

    const slotGeometry = this.ownGeometry(createRoundedBoxGeometry(0.34, 0.14, 0.42, 0.06));
    const slots: THREE.Mesh[] = [];
    for (let index = 0; index < REPLICA_SLOT_CAPACITY; index += 1) {
      const material = this.ownMaterial(
        createSurfaceMaterial({ color: palette.ownership, roughness: 0.48, metalness: 0.04 }),
      );
      const slot = new THREE.Mesh(slotGeometry, material);
      slot.position.set(-1.2 + index * 0.48, 0.38, 0.43);
      slot.userData.role = 'deployment-declared-replica-slot';
      slot.userData.slotIndex = index;
      this.addContent(slot);
      slots.push(slot);
    }
    this.replicaSlots = slots;

    this.rolloutArrow.position.set(1.54, 0.39, 0.86);
    this.rolloutArrow.userData.role = 'deployment-rollout-arrow';
    const rolloutMaterial = this.ownMaterial(createFlatAccentMaterial(palette.ownership, 0.96));
    const stem = new THREE.Mesh(
      this.ownGeometry(new THREE.BoxGeometry(0.7, 0.06, 0.085)),
      rolloutMaterial,
    );
    stem.position.x = -0.34;
    stem.userData.role = 'deployment-rollout-arrow-stem';
    const head = new THREE.Mesh(
      this.ownGeometry(new THREE.ConeGeometry(0.17, 0.32, 3)),
      rolloutMaterial,
    );
    head.position.x = 0.12;
    head.rotation.z = -Math.PI / 2;
    head.userData.role = 'deployment-rollout-arrow-head';
    this.rolloutArrow.add(stem, head);
    this.addContent(this.rolloutArrow);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = deploymentVisualData(entity);
    const visibleSlots = Math.min(data.desiredReplicas, REPLICA_SLOT_CAPACITY);
    this.replicaSlots.forEach((slot, index) => {
      const declared = index < visibleSlots;
      slot.visible = declared;
      slot.userData.declared = declared;
    });

    this.strategyBadge.userData.text = data.strategy;
    this.strategyBadge.userData.visibleText = `Strategy · ${data.strategy}`;
    this.versionBadge.userData.text = data.version;
    this.versionBadge.userData.revision = data.revision;
    this.versionBadge.userData.visibleText = `Version · ${data.version} · Revision ${data.revision}`;
    this.rolloutArrow.userData.strategy = data.strategy;
    this.rolloutArrow.userData.revision = data.revision;

    this.root.userData.desiredReplicas = data.desiredReplicas;
    this.root.userData.visibleReplicaSlots = visibleSlots;
    this.root.userData.replicaSlotCapacity = REPLICA_SLOT_CAPACITY;
    this.root.userData.replicaOverflow = Math.max(0, data.desiredReplicas - REPLICA_SLOT_CAPACITY);
    this.root.userData.strategy = data.strategy;
    this.root.userData.revision = data.revision;
    this.root.userData.version = data.version;
    this.root.userData.shortLabel = `Deployment · ${entity.name}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Deployment · ${entity.name} · ${data.version} · ${data.strategy} · ${data.desiredReplicas} replicas · rev ${data.revision}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.86, -0.9);
    if (anchor === 'ownership') return new THREE.Vector3(2.02, 0.4, 0.86);
    if (anchor === 'control') return new THREE.Vector3(-1.78, 0.4, 0);
    return super.anchorOffset(anchor);
  }
}
