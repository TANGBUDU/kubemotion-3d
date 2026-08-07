import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { SceneCallout } from '../../src/course/types';
import { CalloutManager } from '../../src/renderer/CalloutManager';
import type { SceneRegistry } from '../../src/renderer/SceneRegistry';
import type { EntityId } from '../../src/world/types';

interface FakeHandle {
  readonly root: THREE.Group;
  readonly isDisposed: boolean;
  getAnchor(anchor: 'label'): THREE.Vector3;
}

interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const localized = { en: 'Focused state', ja: 'Focused state', 'zh-CN': 'Focused state' } as const;

const makeCallout = (id: string, entityId = id): SceneCallout => ({
  id,
  entityId,
  text: localized,
});

const makeHandle = (position: THREE.Vector3, visible = true): FakeHandle => {
  const root = new THREE.Group();
  root.position.copy(position);
  root.visible = visible;
  return {
    root,
    isDisposed: false,
    getAnchor: () => root.position.clone(),
  };
};

const makeRegistry = (handles: Readonly<Record<EntityId, FakeHandle>>): SceneRegistry =>
  ({
    get: (entityId: EntityId) => handles[entityId],
  }) as unknown as SceneRegistry;

const camera = (): THREE.OrthographicCamera => {
  const result = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  result.position.set(0, 0, 10);
  result.lookAt(0, 0, 0);
  result.updateProjectionMatrix();
  result.updateMatrixWorld(true);
  return result;
};

const calloutFor = (container: HTMLElement, id: string): HTMLDivElement => {
  const element = container.querySelector<HTMLDivElement>(`[data-callout-id="${id}"]`);
  if (!element) throw new Error(`Missing test callout ${id}.`);
  return element;
};

const setCalloutSize = (element: HTMLDivElement, width: number, height: number): void => {
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
};

const screenRect = (element: HTMLDivElement): ScreenRect => {
  const left = Number(element.dataset.screenX);
  const top = Number(element.dataset.screenY);
  return {
    left,
    top,
    right: left + Number(element.dataset.screenWidth),
    bottom: top + Number(element.dataset.screenHeight),
  };
};

describe('CalloutManager safe viewport layout', () => {
  it('clamps each measured callout rectangle to the requested safe rect', () => {
    const container = document.createElement('div');
    const manager = new CalloutManager(container);
    const callouts = [makeCallout('top-right'), makeCallout('bottom-right')];
    const registry = makeRegistry({
      'top-right': makeHandle(new THREE.Vector3(4.8, 4.8, 0)),
      'bottom-right': makeHandle(new THREE.Vector3(4.8, -4.8, 0)),
    });
    manager.sync(callouts, 'en');
    for (const callout of callouts) setCalloutSize(calloutFor(container, callout.id), 120, 40);

    const safe = { x: 100, y: 50, width: 180, height: 120 };
    manager.update(registry, camera(), 400, 300, safe);

    for (const callout of callouts) {
      const element = calloutFor(container, callout.id);
      const rect = screenRect(element);
      expect(element.hidden).toBe(false);
      expect(rect.left).toBeGreaterThanOrEqual(safe.x);
      expect(rect.top).toBeGreaterThanOrEqual(safe.y);
      expect(rect.right).toBeLessThanOrEqual(safe.x + safe.width);
      expect(rect.bottom).toBeLessThanOrEqual(safe.y + safe.height);
      expect(Number(element.dataset.screenWidth)).toBe(120);
      expect(Number(element.dataset.screenHeight)).toBe(40);
    }
  });

  it('shrinks an oversized measured rectangle to the available safe area', () => {
    const container = document.createElement('div');
    const manager = new CalloutManager(container);
    const registry = makeRegistry({ focus: makeHandle(new THREE.Vector3()) });
    manager.sync([makeCallout('focus')], 'en');
    const element = calloutFor(container, 'focus');
    setCalloutSize(element, 500, 300);

    manager.update(registry, camera(), 400, 300, { x: 100, y: 50, width: 180, height: 120 });

    expect(element.hidden).toBe(false);
    expect(screenRect(element)).toEqual({ left: 100, top: 50, right: 280, bottom: 170 });
    expect(element.style.boxSizing).toBe('border-box');
    expect(element.style.overflow).toBe('hidden');
  });

  it('intersects a partially out-of-bounds safe rect with the viewport', () => {
    const container = document.createElement('div');
    const manager = new CalloutManager(container);
    const registry = makeRegistry({ focus: makeHandle(new THREE.Vector3()) });
    manager.sync([makeCallout('focus')], 'en');
    const element = calloutFor(container, 'focus');
    setCalloutSize(element, 80, 60);

    manager.update(registry, camera(), 400, 300, {
      x: -20,
      y: 250,
      width: 80,
      height: 100,
    });

    expect(element.hidden).toBe(false);
    expect(screenRect(element)).toEqual({ left: 0, top: 250, right: 60, bottom: 300 });
    expect(element.style.maxWidth).toBe('60px');
    expect(element.style.maxHeight).toBe('50px');
  });

  it('hides callouts and clears stale measurements for an invalid viewport', () => {
    const container = document.createElement('div');
    const manager = new CalloutManager(container);
    const registry = makeRegistry({ focus: makeHandle(new THREE.Vector3()) });
    manager.sync([makeCallout('focus')], 'en');
    const element = calloutFor(container, 'focus');
    setCalloutSize(element, 80, 30);
    manager.update(registry, camera(), 400, 300);
    expect(element.dataset.screenWidth).toBe('80');

    manager.update(registry, camera(), 0, Number.NaN);

    expect(element.hidden).toBe(true);
    expect(element.dataset.hiddenReason).toBe('invalid-viewport');
    expect(element.dataset.screenX).toBeUndefined();
    expect(element.dataset.screenWidth).toBeUndefined();
  });

  it('hides anchors outside the camera and removes owned DOM on clear', () => {
    const container = document.createElement('div');
    const manager = new CalloutManager(container);
    const handle = makeHandle(new THREE.Vector3(20, 0, 0));
    const registry = makeRegistry({ outside: handle });
    manager.sync([makeCallout('outside')], 'en');
    const element = calloutFor(container, 'outside');
    setCalloutSize(element, 80, 30);

    manager.update(registry, camera(), 400, 300);

    expect(element.hidden).toBe(true);
    expect(element.dataset.hiddenReason).toBe('outside-camera');
    handle.root.position.set(0, 0, 0);
    manager.update(registry, camera(), 400, 300, { x: 100, y: 50, width: 180, height: 120 });
    expect(element.hidden).toBe(false);
    expect(element.dataset.hiddenReason).toBeUndefined();
    expect(screenRect(element).right).toBeLessThanOrEqual(280);
    manager.clear();
    expect(container.querySelectorAll('.scene-callout')).toHaveLength(0);
    expect(manager.size).toBe(0);
  });
});
