import * as THREE from 'three';
import type { ViewMode } from '../../course/types';
import { dimensions } from '../design/dimensions';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';

export interface StageDomLabelData {
  readonly id: string;
  readonly labelClass: 'fixed-legend';
  readonly text: string;
}

export interface StageFoundationDiagnostics {
  readonly foundationMeshes: number;
  readonly localAlignmentMarks: number;
  readonly dominantGridMarks: number;
}

/**
 * Owns the bounded teaching foundation only. View-specific semantic islands are produced by the
 * active layout and rendered by SceneRegistry, so there is exactly one owner for every base plate.
 */
export class SceneStage {
  public readonly root = new THREE.Group();
  public readonly labelAnchors = new Map<string, THREE.Object3D>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();

  public constructor(parent: THREE.Object3D) {
    this.root.name = 'lesson-stage';
    this.root.userData.foundation = Object.freeze({
      bounded: true,
      width: dimensions.stage.width,
      depth: dimensions.stage.depth,
      semanticIslandOwner: 'layout-registry',
    });
    this.addFoundation();
    this.addAlignmentMarks();
    this.addLegendAnchor();
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

  private addFoundation(): void {
    const baseGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.stage.width,
        dimensions.stage.floorHeight,
        dimensions.stage.depth,
        dimensions.stage.cornerRadius,
        5,
      ),
    );
    const baseMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: palette.surfaceRecessed, roughness: 0.78, metalness: 0.08 }),
    );
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -dimensions.stage.floorHeight / 2;
    base.castShadow = true;
    base.receiveShadow = true;
    base.userData.role = 'cluster-foundation-base';
    base.userData.selectable = false;
    this.root.add(base);

    const topGeometry = this.ownGeometry(
      createRoundedBoxGeometry(
        dimensions.stage.width - 0.34,
        0.055,
        dimensions.stage.depth - 0.34,
        Math.max(0.18, dimensions.stage.cornerRadius - 0.08),
        4,
      ),
    );
    const topMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: palette.floor, roughness: 0.88, metalness: 0.01 }),
    );
    const top = new THREE.Mesh(topGeometry, topMaterial);
    top.position.y = 0.016;
    top.receiveShadow = true;
    top.userData.role = 'cluster-foundation-top';
    top.userData.selectable = false;
    this.root.add(top);

    const frontRailGeometry = this.ownGeometry(createRoundedBoxGeometry(5.6, 0.2, 0.16, 0.055, 3));
    const frontRailMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: palette.surfaceElevated, roughness: 0.52, metalness: 0.16 }),
    );
    const frontRail = new THREE.Mesh(frontRailGeometry, frontRailMaterial);
    frontRail.position.set(0, 0.045, dimensions.stage.depth / 2 - 0.08);
    frontRail.castShadow = true;
    frontRail.userData.role = 'cluster-foundation-front-rail';
    frontRail.userData.selectable = false;
    this.root.add(frontRail);

    const edgeMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.76));
    const edgeGeometry = this.ownGeometry(new THREE.EdgesGeometry(baseGeometry, 24));
    const edge = new THREE.LineSegments(edgeGeometry, edgeMaterial);
    edge.position.copy(base.position);
    edge.userData.role = 'cluster-foundation-edge';
    edge.userData.selectable = false;
    this.root.add(edge);
  }

  private addAlignmentMarks(): void {
    const material = this.ownMaterial(createFlatAccentMaterial(palette.floorGrid, 0.34));
    const horizontalGeometry = this.ownGeometry(new THREE.BoxGeometry(0.72, 0.014, 0.028));
    const verticalGeometry = this.ownGeometry(new THREE.BoxGeometry(0.028, 0.014, 0.72));
    const frontZ = dimensions.stage.depth / 2 - 0.34;
    const sideX = dimensions.stage.width / 2 - 0.34;

    for (const x of [-8, -4, 4, 8]) {
      for (const z of [-frontZ, frontZ]) {
        const mark = new THREE.Mesh(horizontalGeometry, material);
        mark.position.set(x, 0.052, z);
        mark.userData.role = 'stage-alignment-mark';
        mark.userData.selectable = false;
        this.root.add(mark);
      }
    }
    for (const z of [-4.4, 0, 4.4]) {
      for (const x of [-sideX, sideX]) {
        const mark = new THREE.Mesh(verticalGeometry, material);
        mark.position.set(x, 0.052, z);
        mark.userData.role = 'stage-alignment-mark';
        mark.userData.selectable = false;
        this.root.add(mark);
      }
    }
  }

  private addLegendAnchor(): void {
    const anchor = new THREE.Object3D();
    anchor.name = 'stage-legend-anchor';
    anchor.position.set(9.5, 0.1, 6.75);
    anchor.userData.role = 'dom-label-anchor';
    anchor.userData.domLabel = Object.freeze({
      id: 'stage:logical-layout-note',
      labelClass: 'fixed-legend',
      text: 'Logical teaching arrangement; it does not imply deployment nesting.',
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

  public getFramingBounds(target = new THREE.Box3()): THREE.Box3 {
    this.root.updateWorldMatrix(true, true);
    return target.setFromObject(this.root, true);
  }

  public diagnostics(): StageFoundationDiagnostics {
    let foundationMeshes = 0;
    let localAlignmentMarks = 0;
    let dominantGridMarks = 0;
    this.root.traverse((object) => {
      const role = object.userData.role;
      if (typeof role !== 'string') return;
      if (role.startsWith('cluster-foundation-') && object instanceof THREE.Mesh) {
        foundationMeshes += 1;
      }
      if (role === 'stage-alignment-mark') localAlignmentMarks += 1;
      if (role === 'stage-grid-mark') dominantGridMarks += 1;
    });
    return { foundationMeshes, localAlignmentMarks, dominantGridMarks };
  }

  public setViewMode(view: ViewMode): void {
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
