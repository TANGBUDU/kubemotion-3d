import type * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { EntityVisualHandle } from './VisualHandles';

const presets: Record<string, readonly [number, number, number]> = {
  overview: [12, 10, 15],
  logical: [0, 14, 15],
  placement: [12, 11, 16],
  'control-flow': [0, 10, 18],
  traffic: [0, 8, 18],
  storage: [0, 10, 18],
};

export class CameraController {
  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly controls: OrbitControls,
  ) {}
  applyPreset(id: string): void {
    const value = presets[id] ?? presets.overview;
    if (!value) return;
    this.camera.position.set(...value);
    this.controls.target.set(0, 0.8, 0);
    this.controls.update();
  }
  focus(handle: EntityVisualHandle): void {
    const target = handle.getAnchor('center');
    const direction = this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target.clone().add(direction.multiplyScalar(18)));
    this.controls.update();
  }
}
