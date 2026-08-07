import * as THREE from 'three';
import type { TransitionCue } from '../course/types';
import type { SceneRegistry } from './SceneRegistry';

interface ActiveToken {
  mesh: THREE.Mesh;
  path: THREE.Vector3[];
  startedAt: number;
  duration: number;
  generation: number;
}

export class AnimationCoordinator {
  private generation = 0;
  private active: ActiveToken[] = [];
  private readonly pool: THREE.Mesh[] = [];
  private readonly tokenGeometry = new THREE.SphereGeometry(0.16, 12, 8);
  private readonly materials = {
    'data-packet': new THREE.MeshBasicMaterial({ color: 0x5eb6ff }),
    'dns-query': new THREE.MeshBasicMaterial({ color: 0x45d6d0 }),
    'api-request': new THREE.MeshBasicMaterial({ color: 0xb792ff }),
  };

  constructor(private readonly scene: THREE.Scene) {}

  play(cues: readonly TransitionCue[], registry: SceneRegistry, reducedMotion: boolean): void {
    this.cancel();
    const now = performance.now();
    for (const cue of cues) {
      if (!('path' in cue)) {
        if ('entityId' in cue) registry.get(cue.entityId)?.root.scale.multiplyScalar(1.08);
        continue;
      }
      const path = cue.path.flatMap((id) => {
        const root = registry.get(id)?.root;
        return root ? [root.position.clone().add(new THREE.Vector3(0, 0.55, 0))] : [];
      });
      if (path.length < 2) continue;
      const mesh = this.acquire(cue.type);
      this.scene.add(mesh);
      this.active.push({
        mesh,
        path,
        startedAt: now,
        duration: reducedMotion ? 320 : cue.durationMs,
        generation: this.generation,
      });
    }
  }

  private acquire(type: 'data-packet' | 'dns-query' | 'api-request'): THREE.Mesh {
    const mesh = this.pool.pop() ?? new THREE.Mesh(this.tokenGeometry, this.materials[type]);
    mesh.material = this.materials[type];
    mesh.visible = true;
    return mesh;
  }

  update(time: number): boolean {
    const remaining: ActiveToken[] = [];
    for (const token of this.active) {
      if (token.generation !== this.generation) {
        this.release(token.mesh);
        continue;
      }
      const progress = Math.min(1, Math.max(0, (time - token.startedAt) / token.duration));
      const scaled = progress * (token.path.length - 1);
      const segment = Math.min(token.path.length - 2, Math.floor(scaled));
      const start = token.path[segment];
      const end = token.path[segment + 1];
      if (start && end) token.mesh.position.lerpVectors(start, end, scaled - segment);
      if (progress < 1) remaining.push(token);
      else this.release(token.mesh);
    }
    this.active = remaining;
    return this.active.length > 0;
  }

  cancel(): void {
    this.generation += 1;
    for (const token of this.active) this.release(token.mesh);
    this.active = [];
  }
  private release(mesh: THREE.Mesh): void {
    this.scene.remove(mesh);
    mesh.visible = false;
    this.pool.push(mesh);
  }
  get activeCount(): number {
    return this.active.length;
  }
  get pooledCount(): number {
    return this.pool.length;
  }
  destroy(): void {
    this.cancel();
    this.tokenGeometry.dispose();
    Object.values(this.materials).forEach((material) => material.dispose());
    this.pool.length = 0;
  }
}
