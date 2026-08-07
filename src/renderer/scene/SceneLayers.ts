import * as THREE from 'three';

export const sceneLayerOrder = Object.freeze({
  environment: 0,
  stage: 1,
  settledRelations: 3,
  entities: 5,
  activeRoutes: 12,
  effects: 16,
});

/** Stable scene graph groups; individual systems retain ownership of their own GPU resources. */
export class SceneLayers {
  public readonly root = new THREE.Group();
  public readonly environment = new THREE.Group();
  public readonly stage = new THREE.Group();
  public readonly settledRelations = new THREE.Group();
  public readonly entities = new THREE.Group();
  public readonly activeRoutes = new THREE.Group();
  public readonly effects = new THREE.Group();

  public constructor(scene: THREE.Scene) {
    this.root.name = 'kubemotion-scene-layers';
    this.environment.name = 'layer:environment';
    this.stage.name = 'layer:stage';
    this.settledRelations.name = 'layer:settled-relations';
    this.entities.name = 'layer:entities';
    this.activeRoutes.name = 'layer:active-routes';
    this.effects.name = 'layer:effects';
    this.settledRelations.renderOrder = sceneLayerOrder.settledRelations;
    this.entities.renderOrder = sceneLayerOrder.entities;
    this.activeRoutes.renderOrder = sceneLayerOrder.activeRoutes;
    this.effects.renderOrder = sceneLayerOrder.effects;
    this.root.add(
      this.environment,
      this.stage,
      this.settledRelations,
      this.entities,
      this.activeRoutes,
      this.effects,
    );
    scene.add(this.root);
  }

  public dispose(): void {
    this.root.removeFromParent();
    this.root.clear();
  }
}
