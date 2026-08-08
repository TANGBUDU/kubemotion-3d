import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import {
  applyMaterialStatus,
  createFlatAccentMaterial,
  createSurfaceMaterial,
} from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

/**
 * A compact front-of-scene boundary marker. The cluster entity names the teaching boundary; it
 * deliberately does not contribute another floor, platform, or enclosing translucent volume.
 */
export class ClusterFoundationVisualHandle extends BaseVisualHandle {
  private readonly statusMaterial: THREE.MeshBasicMaterial;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 2.75);
    this.root.userData.visualKind = 'cluster-foundation-boundary';
    this.root.userData.boundarySemantic = 'cluster';
    this.root.userData.foundationOnly = true;
    this.root.userData.hasFloorSlab = false;

    const railGeometry = this.ownGeometry(createRoundedBoxGeometry(1.4, 0.12, 0.22, 0.055));
    const railMaterial = this.ownMaterial(createFlatAccentMaterial(palette.borderNeutral, 0.92));
    for (const x of [-2.1, 2.1]) {
      const rail = new THREE.Mesh(railGeometry, railMaterial);
      rail.position.set(x, 0.18, 0);
      rail.userData.role = 'cluster-boundary-rail';
      this.addContent(rail);
    }

    const postGeometry = this.ownGeometry(createRoundedBoxGeometry(0.16, 0.58, 0.28, 0.055));
    const postMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.55, metalness: 0.14 }),
    );
    for (const x of [-2.76, 2.76]) {
      const post = new THREE.Mesh(postGeometry, postMaterial);
      post.position.set(x, 0.29, 0);
      post.castShadow = true;
      post.userData.role = 'cluster-boundary-post';
      this.addContent(post);
    }

    const plaqueGeometry = this.ownGeometry(createRoundedBoxGeometry(2.72, 0.58, 0.42, 0.12, 4));
    const plaqueMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x203a55, roughness: 0.48, metalness: 0.12 }),
    );
    const plaque = this.markSelectable(
      new THREE.Mesh(plaqueGeometry, plaqueMaterial),
      'cluster-foundation-plaque',
    );
    plaque.position.y = 0.34;
    plaque.castShadow = true;
    this.addContent(plaque);

    const boundaryGlyphGeometry = this.ownGeometry(new THREE.BoxGeometry(0.82, 0.045, 0.045));
    const boundaryGlyphMaterial = this.ownMaterial(createFlatAccentMaterial(palette.focus, 0.92));
    for (const x of [-0.72, 0.72]) {
      const boundaryGlyph = new THREE.Mesh(boundaryGlyphGeometry, boundaryGlyphMaterial);
      boundaryGlyph.position.set(x, 0.36, -0.225);
      boundaryGlyph.userData.role = 'cluster-boundary-glyph';
      this.addContent(boundaryGlyph);
    }

    const statusGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.08, 0.08, 0.055, 16));
    this.statusMaterial = this.ownMaterial(createFlatAccentMaterial(palette.healthy));
    const status = new THREE.Mesh(statusGeometry, this.statusMaterial);
    status.rotation.x = Math.PI / 2;
    status.position.set(1.08, 0.35, -0.235);
    status.userData.role = 'cluster-foundation-status';
    this.addContent(status);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    applyMaterialStatus(this.statusMaterial, entity.status);
    this.root.userData.shortLabel = 'CLUSTER FOUNDATION';
    this.root.userData.statusText = entity.status.toUpperCase();
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: 'CLUSTER FOUNDATION',
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') return new THREE.Vector3(0, 0.88, 0);
    if (anchor === 'control') return new THREE.Vector3(-1.36, 0.36, 0);
    if (anchor === 'placement') return new THREE.Vector3(1.36, 0.36, 0);
    return super.anchorOffset(anchor);
  }
}
