import type * as THREE from 'three';

export class ResourceDisposer {
  private readonly disposed = new WeakSet<object>();
  dispose(
    value: THREE.BufferGeometry | THREE.Material | THREE.Texture | THREE.WebGLRenderTarget,
  ): void {
    if (this.disposed.has(value)) return;
    this.disposed.add(value);
    value.dispose();
  }
}
