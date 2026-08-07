import * as THREE from 'three';
import type { ViewProjection } from '../course/types';
import type { Locale } from '../app/types';
import type { EntityId } from '../world/types';
import type { SceneRegistry } from './SceneRegistry';

interface LabelRecord {
  readonly element: HTMLDivElement;
  priority: number;
  entityId: EntityId;
}

interface ProjectedLabel {
  readonly record: LabelRecord;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly distance: number;
}

const overlaps = (left: ProjectedLabel, right: ProjectedLabel): boolean =>
  Math.abs(left.x - right.x) < (left.width + right.width) / 2 + 8 &&
  Math.abs(left.y - right.y) < (left.height + right.height) / 2 + 5;

function labelPriority(kind: string, emphasis: string, selected: boolean): number {
  if (selected) return 100;
  if (emphasis === 'focused') return 80;
  if (kind === 'Node') return 62;
  if (kind === 'Pod') return 54;
  if (kind === 'ReplicaSet') return 50;
  if (emphasis === 'dimmed') return 8;
  return 30;
}

/** Owns collision-aware DOM labels. Purpose-built THREE badges remain owned by visual handles. */
export class LabelManager {
  private readonly labels = new Map<EntityId, LabelRecord>();
  private view: ViewProjection | undefined;

  public constructor(private readonly container: HTMLElement) {}

  public sync(registry: SceneRegistry, view: ViewProjection, locale: Locale): void {
    this.view = view;
    const active = new Set<EntityId>();
    for (const handle of registry.values()) {
      const state = view.entityStates[handle.entityId];
      if (!state || !state.visible || state.emphasis === 'hidden' || state.labelMode === 'none') {
        continue;
      }
      active.add(handle.entityId);
      let record = this.labels.get(handle.entityId);
      if (!record) {
        const element = document.createElement('div');
        element.className = 'scene-label';
        element.dataset.entityId = handle.entityId;
        element.setAttribute('aria-hidden', 'true');
        this.container.append(element);
        record = { element, priority: 0, entityId: handle.entityId };
        this.labels.set(handle.entityId, record);
      }
      const entity = handle.entity;
      record.element.lang = locale;
      record.element.textContent =
        state.labelMode === 'full'
          ? `${entity.name} · ${entity.kind} · ${entity.status}`
          : entity.name;
      record.element.dataset.mode = state.labelMode;
      record.element.dataset.emphasis = state.emphasis;
      record.priority = labelPriority(
        entity.kind,
        state.emphasis,
        handle.root.userData.selected === true,
      );
      record.element.hidden = false;
    }
    for (const [id, record] of this.labels) {
      if (active.has(id)) continue;
      record.element.remove();
      this.labels.delete(id);
    }
  }

  public update(
    registry: SceneRegistry,
    camera: THREE.Camera,
    width: number,
    height: number,
  ): void {
    if (!this.view) return;
    const cameraPosition = new THREE.Vector3();
    camera.getWorldPosition(cameraPosition);
    const projected: ProjectedLabel[] = [];
    for (const record of this.labels.values()) {
      const handle = registry.get(record.entityId);
      const state = this.view.entityStates[record.entityId];
      if (!handle || !state || !handle.root.visible || handle.isDisposed) {
        record.element.hidden = true;
        continue;
      }
      const worldPoint = handle.getAnchor('label');
      const point = worldPoint.clone().project(camera);
      const outside =
        point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.08 || Math.abs(point.y) > 1.08;
      const distance = cameraPosition.distanceTo(worldPoint);
      if (outside || (distance > 27 && record.priority < 60)) {
        record.element.hidden = true;
        continue;
      }
      const x = (point.x * 0.5 + 0.5) * width;
      const y = (-point.y * 0.5 + 0.5) * height;
      record.element.hidden = false;
      const measuredWidth =
        record.element.offsetWidth || (record.element.textContent?.length ?? 8) * 6.5;
      const measuredHeight = record.element.offsetHeight || 24;
      projected.push({
        record,
        x,
        y,
        width: measuredWidth,
        height: measuredHeight,
        distance,
      });
    }

    const accepted: ProjectedLabel[] = [];
    projected
      .sort(
        (left, right) =>
          right.record.priority - left.record.priority || left.distance - right.distance,
      )
      .forEach((candidate) => {
        if (accepted.some((current) => overlaps(current, candidate))) {
          candidate.record.element.hidden = true;
          return;
        }
        accepted.push(candidate);
        candidate.record.element.style.transform = `translate(-50%, -50%) translate(${candidate.x}px, ${candidate.y}px)`;
      });
  }

  public clear(): void {
    for (const record of this.labels.values()) record.element.remove();
    this.labels.clear();
    this.view = undefined;
  }

  public get size(): number {
    return this.labels.size;
  }
}
