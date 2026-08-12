import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName } from '../design/typography';
import { BaseVisualHandle } from './BaseVisualHandle';

/** Deliberately marked fallback for unverified Explore entities. */
export class GenericUnsupportedVisual extends BaseVisualHandle {
  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 0.74);
    this.root.userData.visualKind = 'generic-unsupported';
    this.root.userData.genericVisual = true;

    const bodyGeometry = this.ownGeometry(createRoundedBoxGeometry(1.12, 0.86, 0.82, 0.14));
    const bodyMaterial = this.ownMaterial(
      createSurfaceMaterial({ tone: 'secondary', roughness: 0.7, metalness: 0.04 }),
    );
    const body = this.markSelectable(new THREE.Mesh(bodyGeometry, bodyMaterial), 'generic-body');
    body.position.y = 0.48;
    body.castShadow = true;
    this.addContent(body);

    const warningGeometry = this.ownGeometry(new THREE.TorusGeometry(0.2, 0.035, 8, 3));
    const warningMaterial = this.ownMaterial(createFlatAccentMaterial(palette.pending));
    const warning = new THREE.Mesh(warningGeometry, warningMaterial);
    warning.position.set(0, 0.54, -0.43);
    warning.rotation.z = Math.PI / 2;
    warning.userData.role = 'unsupported-warning';
    this.addContent(warning);
    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.root.userData.shortLabel = `Unsupported · ${shortResourceName(entity.kind, 15)}`;
    this.root.userData.statusText = entity.status.toUpperCase();
  }
}
