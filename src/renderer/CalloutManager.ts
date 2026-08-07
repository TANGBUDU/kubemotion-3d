import type * as THREE from 'three';
import type { SceneCallout } from '../course/types';
import type { Locale } from '../app/types';
import type { LabelSafeRect } from './LabelManager';
import type { SceneRegistry } from './SceneRegistry';

interface CalloutRecord {
  readonly callout: SceneCallout;
  readonly element: HTMLDivElement;
}

interface CalloutSafeRect extends LabelSafeRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const normalizeSafeRect = (
  viewportWidth: number,
  viewportHeight: number,
  requested?: LabelSafeRect,
): CalloutSafeRect | undefined => {
  if (
    !Number.isFinite(viewportWidth) ||
    !Number.isFinite(viewportHeight) ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    return undefined;
  }

  if (
    requested &&
    (!Number.isFinite(requested.x) ||
      !Number.isFinite(requested.y) ||
      !Number.isFinite(requested.width) ||
      !Number.isFinite(requested.height) ||
      requested.width <= 0 ||
      requested.height <= 0)
  ) {
    return undefined;
  }

  const requestedLeft = requested?.x ?? 0;
  const requestedTop = requested?.y ?? 0;
  const requestedRight = requested ? requested.x + requested.width : viewportWidth;
  const requestedBottom = requested ? requested.y + requested.height : viewportHeight;
  const left = clamp(requestedLeft, 0, viewportWidth);
  const top = clamp(requestedTop, 0, viewportHeight);
  const right = clamp(requestedRight, left, viewportWidth);
  const bottom = clamp(requestedBottom, top, viewportHeight);
  if (right - left < 1 || bottom - top < 1) return undefined;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    left,
    right,
    top,
    bottom,
  };
};

const hideRecord = (record: CalloutRecord, reason: string): void => {
  record.element.hidden = true;
  record.element.dataset.hiddenReason = reason;
  delete record.element.dataset.screenX;
  delete record.element.dataset.screenY;
  delete record.element.dataset.screenWidth;
  delete record.element.dataset.screenHeight;
};

const measuredSize = (
  element: HTMLDivElement,
): { readonly width: number; readonly height: number } => {
  const bounds = element.getBoundingClientRect();
  const fallbackWidth = (element.textContent?.length ?? 8) * 6.5 + 22;
  return {
    width: Math.max(1, element.offsetWidth || bounds.width || fallbackWidth),
    height: Math.max(1, element.offsetHeight || bounds.height || 31),
  };
};

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
      delete record.element.dataset.hiddenReason;
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
    requestedSafeRect?: LabelSafeRect,
  ): void {
    const safe = normalizeSafeRect(width, height, requestedSafeRect);
    if (!safe) {
      for (const record of this.records.values()) hideRecord(record, 'invalid-viewport');
      return;
    }

    let offsetIndex = 0;
    for (const record of this.records.values()) {
      const handle = registry.get(record.callout.entityId);
      if (!handle || handle.isDisposed || !handle.root.visible) {
        hideRecord(record, 'inactive');
        continue;
      }
      const point = handle.getAnchor('label').project(camera);
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        !Number.isFinite(point.z) ||
        point.x < -1 ||
        point.x > 1 ||
        point.y < -1 ||
        point.y > 1 ||
        point.z < -1 ||
        point.z > 1
      ) {
        hideRecord(record, 'outside-camera');
        continue;
      }
      const rawX = (point.x * 0.5 + 0.5) * width + 86;
      const rawY = (-point.y * 0.5 + 0.5) * height - 28 + offsetIndex * 42;
      // A previously clipped record is still `display: none` through the hidden attribute.
      // Reveal it before measuring so the rectangle used for clamping is the rendered one.
      record.element.hidden = false;
      record.element.style.boxSizing = 'border-box';
      record.element.style.overflow = 'hidden';
      record.element.style.textOverflow = 'ellipsis';
      record.element.style.maxWidth = '';
      record.element.style.maxHeight = '';
      const naturalSize = measuredSize(record.element);
      if (naturalSize.width > safe.width) record.element.style.maxWidth = `${safe.width}px`;
      if (naturalSize.height > safe.height) record.element.style.maxHeight = `${safe.height}px`;
      const measured = measuredSize(record.element);
      const calloutWidth = Math.min(measured.width, safe.width);
      const calloutHeight = Math.min(measured.height, safe.height);
      const x = clamp(rawX, safe.left + calloutWidth / 2, safe.right - calloutWidth / 2);
      const y = clamp(rawY, safe.top + calloutHeight / 2, safe.bottom - calloutHeight / 2);
      const left = x - calloutWidth / 2;
      const top = y - calloutHeight / 2;
      delete record.element.dataset.hiddenReason;
      record.element.dataset.screenX = String(left);
      record.element.dataset.screenY = String(top);
      record.element.dataset.screenWidth = String(calloutWidth);
      record.element.dataset.screenHeight = String(calloutHeight);
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
