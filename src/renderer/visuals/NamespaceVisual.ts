import * as THREE from 'three';
import type { EntityViewState } from '../../course/types';
import type { WorldEntity } from '../../world/types';
import { dimensions } from '../design/dimensions';
import { createRoundedBoxGeometry } from '../design/geometry';
import { createFlatAccentMaterial, createSurfaceMaterial } from '../design/materials';
import { palette } from '../design/palette';
import { BaseVisualHandle, type AnchorKind } from './BaseVisualHandle';

const WORKSPACE = dimensions.logical.namespaceWorkspace;
const RAIL_THICKNESS = 0.09;
const CORNER_LENGTH = 0.72;

/** A shallow logical scope boundary. It is deliberately not a runtime host or containment chassis. */
export class NamespaceVisualHandle extends BaseVisualHandle {
  private readonly titleDock: THREE.Mesh;

  public constructor(entity: WorldEntity, view: EntityViewState) {
    super(entity, view, 1.4);
    this.root.userData.visualKind = 'namespace-logical-workspace';
    this.root.userData.logicalScope = true;
    this.root.userData.physicalHost = false;
    this.root.userData.workspaceDimensions = Object.freeze({
      width: WORKSPACE.width,
      depth: WORKSPACE.depth,
    });

    const surfaceGeometry = this.ownGeometry(
      new THREE.BoxGeometry(WORKSPACE.width, 0.024, WORKSPACE.depth),
    );
    const surfaceMaterial = createSurfaceMaterial({
      color: palette.ownership,
      roughness: 0.82,
      metalness: 0,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
    });
    surfaceMaterial.depthWrite = false;
    const surface = this.markSelectable(
      new THREE.Mesh(surfaceGeometry, this.ownMaterial(surfaceMaterial)),
      'namespace-workspace-surface',
    );
    surface.position.y = 0.012;
    surface.receiveShadow = true;
    this.addContent(surface);

    const boundaryMaterial = this.ownMaterial(createFlatAccentMaterial(palette.ownership, 0.84));
    const horizontalRailGeometry = this.ownGeometry(
      createRoundedBoxGeometry(WORKSPACE.width, 0.075, RAIL_THICKNESS, 0.025),
    );
    const verticalRailGeometry = this.ownGeometry(
      createRoundedBoxGeometry(RAIL_THICKNESS, 0.075, WORKSPACE.depth, 0.025),
    );
    for (const sign of [-1, 1] as const) {
      const horizontalRail = new THREE.Mesh(horizontalRailGeometry, boundaryMaterial);
      horizontalRail.position.set(0, 0.065, sign * (WORKSPACE.depth * 0.5 - RAIL_THICKNESS * 0.5));
      horizontalRail.userData.role = 'namespace-boundary-rail';
      horizontalRail.userData.axis = 'horizontal';
      this.addContent(horizontalRail);

      const verticalRail = new THREE.Mesh(verticalRailGeometry, boundaryMaterial);
      verticalRail.position.set(sign * (WORKSPACE.width * 0.5 - RAIL_THICKNESS * 0.5), 0.065, 0);
      verticalRail.userData.role = 'namespace-boundary-rail';
      verticalRail.userData.axis = 'vertical';
      this.addContent(verticalRail);
    }

    const dockGeometry = this.ownGeometry(createRoundedBoxGeometry(3.35, 0.14, 0.58, 0.065, 4));
    const dockMaterial = this.ownMaterial(
      createSurfaceMaterial({ color: 0x493d70, roughness: 0.5, metalness: 0.08 }),
    );
    this.titleDock = this.markSelectable(
      new THREE.Mesh(dockGeometry, dockMaterial),
      'namespace-title-dock',
    );
    this.titleDock.position.set(-WORKSPACE.width * 0.5 + 1.92, 0.14, -WORKSPACE.depth * 0.5 + 0.38);
    this.titleDock.castShadow = true;
    this.addContent(this.titleDock);

    const cornerXGeometry = this.ownGeometry(
      createRoundedBoxGeometry(CORNER_LENGTH, 0.065, 0.12, 0.025),
    );
    const cornerZGeometry = this.ownGeometry(
      createRoundedBoxGeometry(0.12, 0.065, CORNER_LENGTH, 0.025),
    );
    for (const signX of [-1, 1] as const) {
      for (const signZ of [-1, 1] as const) {
        const corner = new THREE.Group();
        corner.position.set(
          signX * (WORKSPACE.width * 0.5 - 0.06),
          0.115,
          signZ * (WORKSPACE.depth * 0.5 - 0.06),
        );
        corner.userData.role = 'namespace-scope-corner';
        corner.userData.corner = `${signX < 0 ? 'left' : 'right'}-${signZ < 0 ? 'top' : 'bottom'}`;

        const xLeg = new THREE.Mesh(cornerXGeometry, boundaryMaterial);
        xLeg.position.x = -signX * CORNER_LENGTH * 0.5;
        xLeg.userData.role = 'namespace-scope-corner-leg';
        const zLeg = new THREE.Mesh(cornerZGeometry, boundaryMaterial);
        zLeg.position.z = -signZ * CORNER_LENGTH * 0.5;
        zLeg.userData.role = 'namespace-scope-corner-leg';
        corner.add(xLeg, zLeg);
        this.addContent(corner);
      }
    }

    this.update(entity, view);
  }

  protected override updateVisual(entity: WorldEntity): void {
    this.titleDock.userData.scopeName = entity.name;
    this.titleDock.userData.visibleText = `Namespace · ${entity.name}`;
    this.root.userData.scopeName = entity.name;
    this.root.userData.shortLabel = `Namespace · ${entity.name}`;
    this.root.userData.domLabel = Object.freeze({
      labelClass: 'entity-short-name',
      text: `Namespace · ${entity.name}`,
      anchor: 'label',
    });
  }

  protected override anchorOffset(anchor: AnchorKind): THREE.Vector3 {
    if (anchor === 'label') {
      return new THREE.Vector3(-WORKSPACE.width * 0.5 + 1.92, 0.52, -WORKSPACE.depth * 0.5 + 0.38);
    }
    if (anchor === 'ownership') return new THREE.Vector3(-WORKSPACE.width * 0.5, 0.16, 0);
    if (anchor === 'composition') return new THREE.Vector3(0, 0.08, 0);
    return super.anchorOffset(anchor);
  }
}
