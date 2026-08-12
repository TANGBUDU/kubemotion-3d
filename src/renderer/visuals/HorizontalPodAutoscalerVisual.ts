import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

export const HPA_REPLICA_SLOT_CAPACITY = 8;

interface HpaVisualData {
  readonly minReplicas: number;
  readonly maxReplicas: number;
  readonly currentReplicas: number;
  readonly desiredReplicas: number;
  readonly currentMetric: number;
  readonly targetMetric: number;
  readonly metricName: string;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonNegativeInteger = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : fallback;

const hpaVisualData = (entity: WorldEntity): HpaVisualData => {
  const metric = isRecord(entity.data.metric) ? entity.data.metric : {};
  const minReplicas = nonNegativeInteger(entity.data.minReplicas, 1);
  const maxReplicas = Math.max(minReplicas, nonNegativeInteger(entity.data.maxReplicas, 1));
  return {
    minReplicas,
    maxReplicas,
    currentReplicas: nonNegativeInteger(entity.data.currentReplicas, minReplicas),
    desiredReplicas: nonNegativeInteger(entity.data.desiredReplicas, minReplicas),
    currentMetric: nonNegativeInteger(metric.current, 0),
    targetMetric: Math.max(1, nonNegativeInteger(metric.target, 1)),
    metricName: typeof metric.resource === 'string' ? metric.resource : 'metric',
  };
};

/**
 * A scale-controller console: metric rails feed a bounded replica ladder.
 * It intentionally resembles neither a Pod nor a runtime module.
 */
export class HorizontalPodAutoscalerVisualHandle extends BaseVisualHandle {
  private readonly currentMetricBar: THREE.Mesh;
  private readonly targetMetricBar: THREE.Mesh;
  private readonly replicaSlots: readonly THREE.Mesh[];
  private readonly slotMaterials: readonly THREE.MeshStandardMaterial[];
  private readonly scaleArrow: THREE.Group;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.35);
    this.root.userData.visualKind = 'horizontal-pod-autoscaler-scale-controller';
    this.root.userData.configurationObject = true;
    this.root.userData.runtimeInstance = false;
    this.root.userData.directContainerStarter = false;

    const consoleGeometry = this.ownGeometry(createRoundedBoxGeometry(4.15, 0.34, 2.45, 0.2, 5));
    const consoleMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x243553, roughness: 0.5, metalness: 0.1 }),
    );
    const console = this.markSelectable(
      new THREE.Mesh(consoleGeometry, consoleMaterial),
      'hpa-scale-controller-console',
    );
    console.position.y = 0.17;
    console.castShadow = true;
    console.receiveShadow = true;
    this.addContent(console);

    const metricDeck = new THREE.Mesh(
      this.ownGeometry(createRoundedBoxGeometry(1.42, 0.09, 1.74, 0.09)),
      this.ownMaterial(
        createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.02 }),
      ),
    );
    metricDeck.position.set(-1.15, 0.39, 0);
    metricDeck.userData.role = 'hpa-metric-deck';
    this.addContent(metricDeck);

    const railGeometry = this.ownGeometry(new THREE.BoxGeometry(1, 0.07, 0.16));
    this.targetMetricBar = new THREE.Mesh(
      railGeometry,
      this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.92)),
    );
    this.targetMetricBar.position.set(-1.72, 0.52, 0.32);
    this.targetMetricBar.userData.role = 'hpa-target-metric-bar';
    this.addContent(this.targetMetricBar);

    this.currentMetricBar = new THREE.Mesh(
      railGeometry,
      this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.96)),
    );
    this.currentMetricBar.position.set(-1.72, 0.53, -0.18);
    this.currentMetricBar.userData.role = 'hpa-current-metric-bar';
    this.addContent(this.currentMetricBar);

    const replicaDeck = new THREE.Mesh(
      this.ownGeometry(createRoundedBoxGeometry(1.9, 0.09, 1.74, 0.09)),
      this.ownMaterial(
        createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.02 }),
      ),
    );
    replicaDeck.position.set(1.03, 0.39, 0);
    replicaDeck.userData.role = 'hpa-replica-deck';
    this.addContent(replicaDeck);

    const slotGeometry = this.ownGeometry(createRoundedBoxGeometry(0.31, 0.15, 0.42, 0.055));
    const slots: THREE.Mesh[] = [];
    const slotMaterials: THREE.MeshStandardMaterial[] = [];
    for (let index = 0; index < HPA_REPLICA_SLOT_CAPACITY; index += 1) {
      const material = this.ownMaterial(
        createSurfaceMaterial({ color: palette.surfaceElevated, roughness: 0.5, metalness: 0.04 }),
      );
      const slot = new THREE.Mesh(slotGeometry, material);
      const column = index % 4;
      const row = Math.floor(index / 4);
      slot.position.set(0.38 + column * 0.43, 0.51, -0.36 + row * 0.7);
      slot.userData.role = 'hpa-replica-slot';
      slot.userData.slotIndex = index;
      this.addContent(slot);
      slots.push(slot);
      slotMaterials.push(material);
    }
    this.replicaSlots = slots;
    this.slotMaterials = slotMaterials;

    const boundGeometry = this.ownGeometry(new THREE.BoxGeometry(0.055, 0.08, 1.48));
    const boundMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.86));
    for (const x of [0.2, 1.9]) {
      const bound = new THREE.Mesh(boundGeometry, boundMaterial);
      bound.position.set(x, 0.5, 0);
      bound.userData.role = 'hpa-replica-bound';
      this.addContent(bound);
    }

    this.scaleArrow = new THREE.Group();
    this.scaleArrow.position.set(-0.05, 0.62, 0);
    this.scaleArrow.userData.role = 'hpa-scale-decision-arrow';
    const arrowMaterial = this.ownMaterial(createFlatAccentMaterial(palette.scheduling, 0.97));
    const stem = new THREE.Mesh(
      this.ownGeometry(new THREE.BoxGeometry(0.64, 0.055, 0.08)),
      arrowMaterial,
    );
    stem.position.x = -0.24;
    stem.userData.role = 'hpa-scale-decision-stem';
    const head = new THREE.Mesh(
      this.ownGeometry(new THREE.ConeGeometry(0.16, 0.3, 3)),
      arrowMaterial,
    );
    head.position.x = 0.16;
    head.rotation.z = -Math.PI / 2;
    head.userData.role = 'hpa-scale-decision-head';
    this.scaleArrow.add(stem, head);
    this.addContent(this.scaleArrow);

    this.update(entity, view);
  }

  private setMetricBar(mesh: THREE.Mesh, value: number, maximum: number): void {
    const normalized = Math.min(1, Math.max(0.04, value / maximum));
    mesh.scale.x = normalized;
    mesh.position.x = -1.72 + normalized * 0.55;
    mesh.userData.value = value;
    mesh.userData.normalized = normalized;
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = hpaVisualData(entity);
    const metricMaximum = Math.max(100, data.currentMetric, data.targetMetric);
    this.setMetricBar(this.currentMetricBar, data.currentMetric, metricMaximum);
    this.setMetricBar(this.targetMetricBar, data.targetMetric, metricMaximum);

    this.replicaSlots.forEach((slot, index) => {
      const ordinal = index + 1;
      const withinBounds = ordinal >= data.minReplicas && ordinal <= data.maxReplicas;
      const desired = ordinal <= data.desiredReplicas;
      const current = ordinal <= data.currentReplicas;
      slot.visible = ordinal <= Math.min(data.maxReplicas, HPA_REPLICA_SLOT_CAPACITY);
      slot.userData.withinBounds = withinBounds;
      slot.userData.current = current;
      slot.userData.desired = desired;
      const material = this.slotMaterials[index];
      if (!material) return;
      if (current) material.color.setHex(palette.healthy);
      else if (desired) material.color.setHex(palette.scheduling);
      else material.color.setHex(palette.surfaceElevated);
    });

    const scalingOut = data.desiredReplicas > data.currentReplicas;
    this.scaleArrow.visible = scalingOut;
    this.scaleArrow.userData.from = data.currentReplicas;
    this.scaleArrow.userData.to = data.desiredReplicas;

    this.root.userData.minReplicas = data.minReplicas;
    this.root.userData.maxReplicas = data.maxReplicas;
    this.root.userData.currentReplicas = data.currentReplicas;
    this.root.userData.desiredReplicas = data.desiredReplicas;
    this.root.userData.currentMetric = data.currentMetric;
    this.root.userData.targetMetric = data.targetMetric;
    this.root.userData.metricName = data.metricName;
    this.root.userData.scalingOut = scalingOut;
    this.root.userData.replicaOverflow = Math.max(0, data.maxReplicas - HPA_REPLICA_SLOT_CAPACITY);
    this.root.userData.shortLabel = `HPA · ${entity.name}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `HPA · ${entity.name} · ${data.metricName} ${data.currentMetric}/${data.targetMetric}% · replicas ${data.currentReplicas}→${data.desiredReplicas} · bounds ${data.minReplicas}-${data.maxReplicas}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.02, -0.9);
    if (anchor === 'api-in' || anchor === 'left') return new THREE.Vector3(-2.08, 0.5, 0);
    if (anchor === 'api-out' || anchor === 'right') return new THREE.Vector3(2.08, 0.5, 0);
    if (anchor === 'control') return new THREE.Vector3(0, 0.72, -1.22);
    return super.anchorOffset(anchor);
  }
}
