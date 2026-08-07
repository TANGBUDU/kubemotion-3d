import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import { getReplicaSetData } from '../../world/dataGuards';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

const DIGIT_SEGMENTS: Readonly<Record<string, readonly number[]>> = Object.freeze({
  '0': [0, 1, 2, 4, 5, 6],
  '1': [2, 5],
  '2': [0, 2, 3, 4, 6],
  '3': [0, 2, 3, 5, 6],
  '4': [1, 2, 3, 5],
  '5': [0, 1, 3, 5, 6],
  '6': [0, 1, 3, 4, 5, 6],
  '7': [0, 2, 5],
  '8': [0, 1, 2, 3, 4, 5, 6],
  '9': [0, 1, 2, 3, 5, 6],
  ' ': [],
});

const SEGMENT_TRANSFORMS = [
  { x: 0, z: -0.18, rotation: 0 },
  { x: -0.13, z: -0.09, rotation: Math.PI / 2 },
  { x: 0.13, z: -0.09, rotation: Math.PI / 2 },
  { x: 0, z: 0, rotation: 0 },
  { x: -0.13, z: 0.09, rotation: Math.PI / 2 },
  { x: 0.13, z: 0.09, rotation: Math.PI / 2 },
  { x: 0, z: 0.18, rotation: 0 },
] as const;

interface CounterDisplay {
  readonly metric: 'desired' | 'current' | 'ready';
  readonly root: THREE.Group;
  readonly digits: readonly (readonly THREE.Mesh[])[];
  readonly activeMaterial: THREE.MeshBasicMaterial;
  readonly inactiveMaterial: THREE.MeshBasicMaterial;
}

type ReplicaMetric = CounterDisplay['metric'];

const metricForField = (field: string): ReplicaMetric | undefined => {
  if (field.endsWith('desiredReplicas')) return 'desired';
  if (field.endsWith('currentReplicas')) return 'current';
  if (field.endsWith('readyReplicas')) return 'ready';
  return undefined;
};

/** Compact, in-place ReplicaSet counters with a fixed reconcile-card silhouette. */
export class ReplicaSetVisualHandle extends BaseVisualHandle {
  private readonly displays: readonly CounterDisplay[];
  private readonly podMarkerMaterials: readonly THREE.MeshStandardMaterial[];
  private readonly deficitGroup = new THREE.Group();
  private readonly animatedCounters = new Map<ReplicaMetric, number>();

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.05);
    this.root.userData.visualKind = 'replicaset-reconcile-card';

    const cardGeometry = this.ownGeometry(createRoundedBoxGeometry(3.65, 0.34, 2.25, 0.2, 4));
    const cardMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x3e365c, roughness: 0.5, metalness: 0.12 }),
    );
    const card = this.markSelectable(
      new THREE.Mesh(cardGeometry, cardMaterial),
      'replicaset-control-card',
    );
    card.position.y = 0.17;
    card.castShadow = true;
    card.receiveShadow = true;
    this.addContent(card);

    const insetGeometry = this.ownGeometry(createRoundedBoxGeometry(3.25, 0.055, 1.42, 0.12));
    const insetMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.02 }),
    );
    const inset = new THREE.Mesh(insetGeometry, insetMaterial);
    inset.position.set(0, 0.375, 0.18);
    inset.userData.role = 'replicaset-counter-deck';
    this.addContent(inset);

    this.displays = [
      this.createCounterDisplay('desired', -1.05, palette.controlFlow),
      this.createCounterDisplay('current', 0, palette.dataFlow),
      this.createCounterDisplay('ready', 1.05, palette.healthy),
    ];
    for (const display of this.displays) this.addContent(display.root);

    this.addReconcileGlyph();
    this.podMarkerMaterials = this.addPodMarkers();
    this.addDeficitIndicator();
    this.update(entity, view);
  }

  private createCounterDisplay(
    metric: CounterDisplay['metric'],
    x: number,
    color: number,
  ): CounterDisplay {
    const root = new THREE.Group();
    root.position.set(x, 0.425, 0.18);
    root.userData.role = 'replicaset-counter';
    root.userData.metric = metric;
    const segmentGeometry = this.ownGeometry(new THREE.BoxGeometry(0.22, 0.035, 0.055));
    const activeMaterial = this.ownMaterial(createFlatAccentMaterial(color, 0.96));
    const inactiveMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderSubtle, 0.22));
    const digits: THREE.Mesh[][] = [];
    for (let digitIndex = 0; digitIndex < 2; digitIndex += 1) {
      const digitRoot = new THREE.Group();
      digitRoot.position.x = digitIndex === 0 ? -0.18 : 0.18;
      const segments: THREE.Mesh[] = [];
      for (const [segmentIndex, transform] of SEGMENT_TRANSFORMS.entries()) {
        const segment = new THREE.Mesh(segmentGeometry, inactiveMaterial);
        segment.position.set(transform.x, 0, transform.z);
        segment.rotation.y = transform.rotation;
        segment.userData.role = 'counter-segment';
        segment.userData.segmentIndex = segmentIndex;
        digitRoot.add(segment);
        segments.push(segment);
      }
      digitRoot.userData.role = 'counter-digit';
      root.add(digitRoot);
      digits.push(segments);
    }
    return { metric, root, digits, activeMaterial, inactiveMaterial };
  }

  private setCounter(display: CounterDisplay, value: number): void {
    const clamped = Math.min(99, Math.max(0, Math.trunc(value)));
    const characters = clamped < 10 ? [' ', String(clamped)] : String(clamped).split('');
    display.digits.forEach((segments, digitIndex) => {
      const enabled = new Set(DIGIT_SEGMENTS[characters[digitIndex] ?? ' '] ?? []);
      segments.forEach((segment, segmentIndex) => {
        segment.material = enabled.has(segmentIndex)
          ? display.activeMaterial
          : display.inactiveMaterial;
      });
    });
    display.root.userData.value = value;
  }

  private addReconcileGlyph(): void {
    const material = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.9));
    const arcGeometry = this.ownGeometry(
      new THREE.TorusGeometry(0.29, 0.035, 7, 24, Math.PI * 1.45),
    );
    for (let index = 0; index < 2; index += 1) {
      const arc = new THREE.Mesh(arcGeometry, material);
      arc.rotation.x = Math.PI / 2;
      arc.rotation.z = index === 0 ? 0 : Math.PI;
      arc.position.set(-1.48, 0.42, -0.74);
      arc.userData.role = 'replicaset-reconcile-loop';
      this.addContent(arc);
    }
    const hubGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14));
    const hub = new THREE.Mesh(hubGeometry, material);
    hub.position.set(-1.48, 0.43, -0.74);
    hub.userData.role = 'replicaset-reconcile-hub';
    this.addContent(hub);
  }

  private addPodMarkers(): readonly THREE.MeshStandardMaterial[] {
    const geometry = this.ownGeometry(createRoundedBoxGeometry(0.42, 0.16, 0.31, 0.07));
    const materials: THREE.MeshStandardMaterial[] = [];
    for (let index = 0; index < 3; index += 1) {
      const material = this.ownMaterial(
        createSurfaceMaterial({ color: palette.surfaceElevated, roughness: 0.5, metalness: 0.05 }),
      );
      const marker = new THREE.Mesh(geometry, material);
      marker.position.set(-0.55 + index * 0.55, 0.47, -0.75);
      marker.userData.role = 'replicaset-pod-marker';
      marker.userData.markerIndex = index;
      this.addContent(marker);
      materials.push(material);
    }
    return materials;
  }

  private addDeficitIndicator(): void {
    const material = this.ownMaterial(createFlatAccentMaterial(palette.pending, 0.95));
    const geometry = this.ownGeometry(new THREE.BoxGeometry(0.34, 0.045, 0.055));
    for (const sign of [-1, 1]) {
      const bar = new THREE.Mesh(geometry, material);
      bar.rotation.y = sign * 0.72;
      this.deficitGroup.add(bar);
    }
    this.deficitGroup.position.set(1.5, 0.47, -0.75);
    this.deficitGroup.userData.role = 'replicaset-deficit';
    this.addContent(this.deficitGroup);
  }

  private renderCounts(desired: number, current: number, ready: number): void {
    const values = [desired, current, ready] as const;
    this.displays.forEach((display, index) => this.setCounter(display, values[index] ?? 0));
    const deficit = current < desired || ready < desired;
    this.deficitGroup.visible = deficit;
    this.deficitGroup.userData.deficit = Math.max(0, desired - Math.min(current, ready));
    this.podMarkerMaterials.forEach((material, index) => {
      if (index < ready) material.color.setHex(palette.healthy);
      else if (index < current) material.color.setHex(palette.pending);
      else if (index < desired) material.color.setHex(palette.controlFlow);
      else material.color.setHex(palette.surfaceElevated);
    });
    this.root.userData.counters = Object.freeze({
      desired,
      current,
      ready,
    });
    this.root.userData.hasDeficit = deficit;
  }

  /** Applies a display-only counter value without mutating the factual world entity. */
  public setCounterAnimation(field: string, value?: number): boolean {
    const metric = metricForField(field);
    if (!metric) return false;
    if (value === undefined) this.animatedCounters.delete(metric);
    else this.animatedCounters.set(metric, Math.max(0, Math.round(value)));
    const data = getReplicaSetData(this.entity);
    this.renderCounts(
      this.animatedCounters.get('desired') ?? data.desiredReplicas,
      this.animatedCounters.get('current') ?? data.currentReplicas,
      this.animatedCounters.get('ready') ?? data.readyReplicas,
    );
    return true;
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = getReplicaSetData(entity);
    this.animatedCounters.clear();
    this.renderCounts(data.desiredReplicas, data.currentReplicas, data.readyReplicas);
    this.root.userData.shortLabel = `ReplicaSet · ${entity.name}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `ReplicaSet · ${entity.name}`,
      anchor: 'label',
      counters: this.root.userData.counters,
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.92, -0.9);
    if (anchor === 'ownership') return new THREE.Vector3(1.82, 0.48, 0);
    if (anchor === 'control') return new THREE.Vector3(-1.82, 0.48, 0);
    return super.anchorOffset(anchor);
  }
}
