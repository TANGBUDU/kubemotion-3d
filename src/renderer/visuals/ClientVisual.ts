import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { createFlatAccentMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { shortResourceName } from '../design/typography';
import { PodVisualHandle } from './PodVisual';

/** A Pod visual with a request-emitter glyph; the underlying factual kind remains Pod. */
export class ClientVisualHandle extends PodVisualHandle {
  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view);
    this.root.userData.visualKind = 'client-pod-emitter';
    this.root.userData.clientActor = true;

    const accentMaterial = this.ownMaterial(createFlatAccentMaterial(palette.dataFlow, 0.96));
    const mastGeometry = this.ownGeometry(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 12));
    const mast = new THREE.Mesh(mastGeometry, accentMaterial);
    mast.position.set(0, 1.74, 0);
    mast.userData.role = 'client-request-mast';
    this.addContent(mast);

    const signalGeometry = this.ownGeometry(new THREE.TorusGeometry(0.25, 0.035, 8, 24));
    for (let index = 0; index < 2; index += 1) {
      const signal = new THREE.Mesh(signalGeometry, accentMaterial);
      signal.rotation.x = Math.PI / 2;
      signal.position.set(0, 1.96 + index * 0.18, 0);
      signal.scale.setScalar(1 + index * 0.42);
      signal.userData.role = 'client-request-signal';
      this.addContent(signal);
    }

    const arrowGeometry = this.ownGeometry(new THREE.ConeGeometry(0.12, 0.32, 16));
    const arrow = new THREE.Mesh(arrowGeometry, accentMaterial);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(0.64, 1.8, 0);
    arrow.userData.role = 'client-request-arrow';
    this.addContent(arrow);

    this.root.userData.shortLabel = `Client Pod · ${shortResourceName(entity.name, 14)}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Client Pod · ${shortResourceName(entity.name, 14)}`,
      anchor: 'label',
    });
  }
}
