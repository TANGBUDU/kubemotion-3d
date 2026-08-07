import type * as THREE from 'three';
import type { SceneCallout } from '../course/types';
import type { Locale } from '../app/types';
import type { SceneRegistry } from './SceneRegistry';

interface CalloutRecord {
  readonly callout: SceneCallout;
  readonly element: HTMLDivElement;
}

/** Owns step-bound, anchored DOM callouts. */
export class CalloutManager {
  private readonly records = new Map<string, CalloutRecord>();

  public constructor(private readonly container: HTMLElement) {}

  public sync(callouts: readonly SceneCallout[], locale: Locale): void {
    const active = new Set(callouts.map((callout) => callout.id));
    for (const callout of callouts) {
      let record = this.records.get(callout.id);
      if (!record) {
        const element = document.createElement('div');
        element.className = 'scene-callout';
        element.dataset.calloutId = callout.id;
        element.setAttribute('role', 'note');
        this.container.append(element);
        record = { callout, element };
        this.records.set(callout.id, record);
      }
      record.element.textContent = callout.text[locale];
      record.element.hidden = false;
    }
    for (const [id, record] of this.records) {
      if (active.has(id)) continue;
      record.element.remove();
      this.records.delete(id);
    }
  }

  public update(
    registry: SceneRegistry,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    let offsetIndex = 0;
    for (const record of this.records.values()) {
      const handle = registry.get(record.callout.entityId);
      if (!handle || handle.isDisposed || !handle.root.visible) {
        record.element.hidden = true;
        continue;
      }
      const point = handle.getAnchor('label').project(camera);
      if (point.z < -1 || point.z > 1) {
        record.element.hidden = true;
        continue;
      }
      const rawX = (point.x * 0.5 + 0.5) * width + 86;
      const rawY = (-point.y * 0.5 + 0.5) * height - 28 + offsetIndex * 42;
      const x = Math.min(width - 150, Math.max(150, rawX));
      const y = Math.min(height - 118, Math.max(52, rawY));
      record.element.hidden = false;
      record.element.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      offsetIndex += 1;
    }
  }

  public flash(entityId: string, text: string): void {
    const matching = [...this.records.values()].find(
      (record) => record.callout.entityId === entityId,
    );
    if (!matching) return;
    matching.element.textContent = text;
    matching.element.animate(
      [
        { opacity: 0.4, transform: `${matching.element.style.transform} scale(.96)` },
        { opacity: 1, transform: `${matching.element.style.transform} scale(1)` },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }

  public clear(): void {
    for (const record of this.records.values()) record.element.remove();
    this.records.clear();
  }

  public get size(): number {
    return this.records.size;
  }
}
