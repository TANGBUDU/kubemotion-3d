import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

export const METRIC_SOURCE_BAR_COUNT = 10;

interface MetricVisualData {
  readonly resource: string;
  readonly observed: number;
  readonly target: number;
  readonly sampleWindowSeconds: number;
}

const finiteNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const metricVisualData = (entity: WorldEntity): MetricVisualData => ({
  resource: typeof entity.data.resource === 'string' ? entity.data.resource : 'metric',
  observed: Math.max(0, finiteNumber(entity.data.observedUtilization, 0)),
  target: Math.max(0, finiteNumber(entity.data.targetUtilization, 0)),
  sampleWindowSeconds: Math.max(0, finiteNumber(entity.data.sampleWindowSeconds, 0)),
});

/** Telemetry instrument with sampled bars, target threshold, and outbound signal waves. */
export class MetricSourceVisualHandle extends BaseVisualHandle {
  private readonly sampleBars: readonly THREE.Mesh[];
  private readonly sampleMaterials: readonly THREE.MeshStandardMaterial[];
  private readonly targetMarker: THREE.Group;
  private readonly signalWaves: THREE.Group;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.8);
    this.root.userData.visualKind = 'metric-source-telemetry-instrument';
    this.root.userData.telemetrySource = true;
    this.root.userData.runtimeWorkload = false;

    const base = this.markSelectable(
      new THREE.Mesh(
        this.ownGeometry(createRoundedBoxGeometry(3.05, 0.3, 1.95, 0.18, 5)),
        this.ownMaterial(
          createSurfaceMaterial({ color: 0x173f50, roughness: 0.52, metalness: 0.08 }),
        ),
      ),
      'metric-source-instrument-base',
    );
    base.position.y = 0.15;
    base.castShadow = true;
    base.receiveShadow = true;
    this.addContent(base);

    const chartDeck = new THREE.Mesh(
      this.ownGeometry(createRoundedBoxGeometry(2.42, 0.07, 1.18, 0.08)),
      this.ownMaterial(
        createSurfaceMaterial({ tone: 'recessed', roughness: 0.72, metalness: 0.02 }),
      ),
    );
    chartDeck.position.set(-0.18, 0.34, 0.12);
    chartDeck.userData.role = 'metric-source-chart-deck';
    this.addContent(chartDeck);

    const barGeometry = this.ownGeometry(new THREE.BoxGeometry(0.15, 0.12, 0.18));
    const bars: THREE.Mesh[] = [];
    const materials: THREE.MeshStandardMaterial[] = [];
    for (let index = 0; index < METRIC_SOURCE_BAR_COUNT; index += 1) {
      const material = this.ownMaterial(
        createSurfaceMaterial({ color: palette.surfaceElevated, roughness: 0.48, metalness: 0.04 }),
      );
      const bar = new THREE.Mesh(barGeometry, material);
      bar.position.set(-1.12 + index * 0.22, 0.45, 0.15);
      bar.userData.role = 'metric-source-sample-bar';
      bar.userData.sampleIndex = index;
      this.addContent(bar);
      bars.push(bar);
      materials.push(material);
    }
    this.sampleBars = bars;
    this.sampleMaterials = materials;

    this.targetMarker = new THREE.Group();
    this.targetMarker.userData.role = 'metric-source-target-marker';
    const targetMaterial = this.ownMaterial(createFlatAccentMaterial(palette.controlFlow, 0.95));
    const targetRail = new THREE.Mesh(
      this.ownGeometry(new THREE.BoxGeometry(2.25, 0.045, 0.035)),
      targetMaterial,
    );
    targetRail.userData.role = 'metric-source-target-rail';
    const targetFlag = new THREE.Mesh(
      this.ownGeometry(new THREE.ConeGeometry(0.1, 0.2, 3)),
      targetMaterial,
    );
    targetFlag.position.x = 1.18;
    targetFlag.rotation.z = -Math.PI / 2;
    targetFlag.userData.role = 'metric-source-target-flag';
    this.targetMarker.add(targetRail, targetFlag);
    this.addContent(this.targetMarker);

    this.signalWaves = new THREE.Group();
    this.signalWaves.position.set(1.34, 0.58, -0.54);
    this.signalWaves.userData.role = 'metric-source-signal-waves';
    const waveMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.88));
    for (let index = 0; index < 3; index += 1) {
      const wave = new THREE.Mesh(
        this.ownGeometry(new THREE.TorusGeometry(0.2 + index * 0.13, 0.025, 7, 24, Math.PI * 1.15)),
        waveMaterial,
      );
      wave.rotation.x = Math.PI / 2;
      wave.rotation.z = -Math.PI * 0.08;
      wave.userData.role = 'metric-source-signal-wave';
      wave.userData.waveIndex = index;
      this.signalWaves.add(wave);
    }
    this.addContent(this.signalWaves);

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    const data = metricVisualData(entity);
    const activeCount = Math.min(
      METRIC_SOURCE_BAR_COUNT,
      Math.max(0, Math.ceil((data.observed / 100) * METRIC_SOURCE_BAR_COUNT)),
    );
    const targetCount = Math.min(
      METRIC_SOURCE_BAR_COUNT,
      Math.max(0, Math.ceil((data.target / 100) * METRIC_SOURCE_BAR_COUNT)),
    );
    this.sampleBars.forEach((bar, index) => {
      const active = index < activeCount;
      bar.scale.y = active ? 0.55 + ((index + 1) / METRIC_SOURCE_BAR_COUNT) * 1.4 : 0.32;
      bar.position.y = 0.4 + bar.scale.y * 0.06;
      bar.userData.active = active;
      const material = this.sampleMaterials[index];
      if (material) {
        material.color.setHex(
          !active
            ? palette.surfaceElevated
            : index < targetCount
              ? palette.healthy
              : palette.failed,
        );
      }
    });

    this.targetMarker.position.set(0, 0.48 + (data.target / 100) * 0.18, -0.25);
    this.targetMarker.userData.value = data.target;
    this.signalWaves.userData.strength = data.observed;
    this.signalWaves.scale.setScalar(0.84 + Math.min(1, data.observed / 100) * 0.22);

    this.root.userData.resource = data.resource;
    this.root.userData.observedUtilization = data.observed;
    this.root.userData.targetUtilization = data.target;
    this.root.userData.aboveTarget = data.observed > data.target;
    this.root.userData.sampleWindowSeconds = data.sampleWindowSeconds;
    this.root.userData.activeSampleBars = activeCount;
    this.root.userData.shortLabel = `Metrics · ${data.resource}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Metrics · ${data.resource} · observed ${data.observed}% · target ${data.target}% · ${data.sampleWindowSeconds}s window`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 1.08, -0.65);
    if (anchor === 'control' || anchor === 'api-out' || anchor === 'right') {
      return new THREE.Vector3(1.55, 0.62, -0.45);
    }
    if (anchor === 'api-in' || anchor === 'left') return new THREE.Vector3(-1.52, 0.5, 0);
    return super.anchorOffset(anchor);
  }
}
