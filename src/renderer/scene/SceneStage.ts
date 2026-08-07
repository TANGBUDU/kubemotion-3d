import * as THREE from 'three';
import type { ViewMode } from '../../course/types';
import { dimensions } from '../design/dimensions';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';

export interface StageZoneDefinition {
  readonly id: 'control-plane' | 'workload-state' | 'worker-nodes';
  readonly title: string;
  readonly center: readonly [number, number, number];
  readonly size: readonly [number, number];
  readonly labelAnchor: readonly [number, number, number];
  readonly accent: number;
}

export interface StageDomLabelData {
  readonly id: string;
  readonly labelClass: 'zone-title' | 'fixed-legend';
  readonly text: string;
  readonly zoneId?: StageZoneDefinition['id'];
}

export const lessonStageZones: readonly StageZoneDefinition[] = [
  {
    id: 'control-plane',
    title: 'CONTROL PLANE',
    center: [0, 0.055, -5.25] as const,
    size: [20, 2.55] as const,
    labelAnchor: [-9.4, 0.12, -6.38] as const,
    accent: palette.controlFlow,
  },
  {
    id: 'workload-state',
    title: 'WORKLOAD STATE / UNSCHEDULED QUEUE',
    center: [0, 0.055, -2.05] as const,
    size: [20, 2.35] as const,
    labelAnchor: [-9.4, 0.12, -3.12] as const,
    accent: palette.scheduling,
  },
  {
    id: 'worker-nodes',
    title: 'WORKER NODES',
    center: [0, 0.055, 2.85] as const,
    size: [20, 5.55] as const,
    labelAnchor: [-9.4, 0.12, 0.28] as const,
    accent: palette.dataFlow,
  },
];

export class SceneStage {
  public readonly root = new THREE.Group();
  public readonly labelAnchors = new Map<string, THREE.Object3D>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();

  public constructor(parent: THREE.Object3D) {
    this.root.name = 'lesson-stage';
    this.addFloor();
    this.addLocalGrid();
    for (const zone of lessonStageZones) this.addZone(zone);
    this.addLegendAnchor();
    this.root.userData.zones = lessonStageZones.map((zone) => ({
      id: zone.id,
      title: zone.title,
      center: zone.center,
      size: zone.size,
      labelAnchor: zone.labelAnchor,
    }));
    parent.add(this.root);
  }

  private ownGeometry<TGeometry extends THREE.BufferGeometry>(geometry: TGeometry): TGeometry {
    this.geometries.add(geometry);
    return geometry;
  }

  private ownMaterial<TMaterial extends THREE.Material>(material: TMaterial): TMaterial {
    this.materials.add(material);
    return material;
  }

  private addFloor(): void {
    const geometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.stage.width,
        dimensions.stage.floorHeight,
        dimensions.stage.depth,
        dimensions.stage.cornerRadius,
        5,
      ),
    );
    const material = this.ownMaterial(
      createSurfaceMaterial({ color: palette.floor, roughness: 0.82, metalness: 0.02 }),
    );
    const floor = new THREE.Mesh(geometry, material);
    floor.position.y = -dimensions.stage.floorHeight / 2;
    floor.receiveShadow = true;
    floor.userData.role = 'lesson-floor';
    this.root.add(floor);
  }

  private addLocalGrid(): void {
    const material = this.ownMaterial(createFlatAccentMaterial(palette.floorGrid, 0.2));
    const horizontalGeometry = this.ownGeometry(new THREE.BoxGeometry(20.5, 0.012, 0.018));
    const verticalGeometry = this.ownGeometry(new THREE.BoxGeometry(0.018, 0.012, 13.5));
    for (let z = -6; z <= 6; z += 1) {
      const line = new THREE.Mesh(horizontalGeometry, material);
      line.position.set(0, 0.008, z);
      line.userData.role = 'stage-grid-mark';
      this.root.add(line);
    }
    for (let x = -10; x <= 10; x += 1) {
      const line = new THREE.Mesh(verticalGeometry, material);
      line.position.set(x, 0.008, 0);
      line.userData.role = 'stage-grid-mark';
      this.root.add(line);
    }
  }

  private addZone(zone: StageZoneDefinition): void {
    const geometry = this.ownGeometry(
      createRoundedBoxGeometry(zone.size[0], 0.045, zone.size[1], 0.18, 3),
    );
    const material = this.ownMaterial(createFlatAccentMaterial(zone.accent, 0.055));
    const plate = new THREE.Mesh(geometry, material);
    plate.position.set(...zone.center);
    plate.userData.role = 'teaching-zone';
    plate.userData.zoneId = zone.id;
    plate.userData.zoneTitle = zone.title;
    plate.userData.labelAnchor = zone.labelAnchor;
    plate.userData.selectable = false;
    this.root.add(plate);

    const edgeGeometry = this.ownGeometry(new THREE.EdgesGeometry(geometry));
    const edgeMaterial = this.ownMaterial(createFlatAccentMaterial(zone.accent, 0.3));
    const boundary = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    boundary.position.copy(plate.position);
    boundary.userData.role = 'teaching-zone-boundary';
    boundary.userData.zoneId = zone.id;
    boundary.userData.selectable = false;
    this.root.add(boundary);

    const markerGeometry = this.ownGeometry(
      createRoundedBoxGeometry(Math.min(3.6, zone.size[0] * 0.3), 0.035, 0.055, 0.02),
    );
    const markerMaterial = this.ownMaterial(createFlatAccentMaterial(zone.accent, 0.72));
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.set(zone.labelAnchor[0] + 1.8, 0.09, zone.labelAnchor[2] + 0.1);
    marker.userData.role = 'zone-title-marker';
    marker.userData.zoneTitle = zone.title;
    this.root.add(marker);

    const anchor = new THREE.Object3D();
    anchor.name = `zone-label-anchor:${zone.id}`;
    anchor.position.set(...zone.labelAnchor);
    anchor.userData.role = 'dom-label-anchor';
    anchor.userData.domLabel = Object.freeze({
      id: `zone:${zone.id}`,
      labelClass: 'zone-title',
      text: zone.title,
      zoneId: zone.id,
    } satisfies StageDomLabelData);
    this.labelAnchors.set(zone.id, anchor);
    this.root.add(anchor);
  }

  private addLegendAnchor(): void {
    const anchor = new THREE.Object3D();
    anchor.name = 'stage-legend-anchor';
    anchor.position.set(9.5, 0.1, 6.75);
    anchor.userData.role = 'dom-label-anchor';
    anchor.userData.domLabel = Object.freeze({
      id: 'stage:logical-layout-note',
      labelClass: 'fixed-legend',
      text: 'Logical teaching layout; components may be deployed differently in real clusters.',
    } satisfies StageDomLabelData);
    this.labelAnchors.set('logical-layout-note', anchor);
    this.root.add(anchor);
  }

  public getLabelAnchorWorld(id: string, target = new THREE.Vector3()): THREE.Vector3 | undefined {
    const anchor = this.labelAnchors.get(id);
    if (!anchor) return undefined;
    anchor.updateWorldMatrix(true, false);
    return anchor.getWorldPosition(target);
  }

  /** Traffic has its own left-to-right semantic lanes; golden control-plane plates would be noise. */
  public setViewMode(view: ViewMode): void {
    const showGoldenZones = view !== 'traffic';
    this.root.traverse((object) => {
      if (
        object.userData.role === 'teaching-zone' ||
        object.userData.role === 'teaching-zone-boundary' ||
        object.userData.role === 'zone-title-marker'
      ) {
        object.visible = showGoldenZones;
      }
    });
    this.root.userData.viewMode = view;
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.geometries.clear();
    this.materials.clear();
    this.labelAnchors.clear();
  }
}
