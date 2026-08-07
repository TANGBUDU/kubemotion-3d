import * as THREE from 'three';
import type { Locale } from '../domain/types';
import type { SceneRegistry } from './SceneRegistry';

export class LabelManager {
  private readonly labels = new Map<string, HTMLDivElement>();

  constructor(private readonly container: HTMLElement) {}

  sync(registry: SceneRegistry, locale: Locale): void {
    const active = new Set<string>();
    for (const handle of registry.values()) {
      const id = handle.entity.id;
      active.add(id);
      let label = this.labels.get(id);
      if (!label) {
        label = document.createElement('div');
        label.className = 'scene-label';
        label.dataset.entityId = id;
        this.container.append(label);
        this.labels.set(id, label);
      }
      label.textContent = handle.entity.title[locale];
      label.hidden = !handle.root.visible;
    }
    for (const [id, label] of this.labels) {
      if (!active.has(id)) {
        label.remove();
        this.labels.delete(id);
      }
    }
  }

  update(registry: SceneRegistry, camera: THREE.Camera, width: number, height: number): void {
    for (const handle of registry.values()) {
      const label = this.labels.get(handle.entity.id);
      if (!label || !handle.root.visible) continue;
      const point = handle.root.position
        .clone()
        .add(new THREE.Vector3(0, 0.85, 0))
        .project(camera);
      label.style.transform = `translate(-50%, -50%) translate(${(point.x * 0.5 + 0.5) * width}px, ${(-point.y * 0.5 + 0.5) * height}px)`;
      label.hidden = point.z < -1 || point.z > 1;
    }
  }
  clear(): void {
    for (const label of this.labels.values()) label.remove();
    this.labels.clear();
  }
  get size(): number {
    return this.labels.size;
  }
}
