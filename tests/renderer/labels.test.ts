import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { EntityViewState, ViewProjection } from '../../src/course/types';
import { LabelManager, type LabelSafeRect } from '../../src/renderer/LabelManager';
import type { RelationLayer } from '../../src/renderer/relations/RelationLayer';
import type { LayoutLabelAnchor, SceneRegistry } from '../../src/renderer/SceneRegistry';
import type { EntityId, WorldEntity } from '../../src/world/types';

interface FakeHandle {
  readonly entityId: EntityId;
  readonly entity: WorldEntity;
  readonly root: THREE.Group;
  readonly isDisposed: boolean;
  getAnchor(anchor: 'label' | 'center'): THREE.Vector3;
}

interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

const localized = { en: 'label', ja: 'label', 'zh-CN': 'label' } as const;

const makeHandle = (
  id: string,
  kind: string,
  position: THREE.Vector3,
  labelOffsetY = 0,
  selected = false,
): FakeHandle => {
  const root = new THREE.Group();
  root.position.copy(position);
  root.userData.selected = selected;
  const entity: WorldEntity = {
    id,
    category: kind === 'Node' ? 'infrastructure' : 'api-object',
    kind,
    name: id,
    status: 'running',
    data: {},
    title: localized,
    summary: localized,
    sourceIds: [],
    visual: { archetype: kind === 'Node' ? 'node' : 'pod' },
  };
  return {
    entityId: id,
    entity,
    root,
    isDisposed: false,
    getAnchor: (anchor) =>
      root.position.clone().add(new THREE.Vector3(0, anchor === 'label' ? labelOffsetY : 0, 0)),
  };
};

const makeRegistry = (
  handles: readonly FakeHandle[],
  layoutLabels: readonly LayoutLabelAnchor[] = [],
): SceneRegistry => {
  const byId = new Map(handles.map((handle) => [handle.entityId, handle]));
  return {
    values: () => byId.values(),
    get: (entityId: EntityId) => byId.get(entityId),
    layoutLabels: () => layoutLabels,
  } as unknown as SceneRegistry;
};

const makeView = (
  handles: readonly FakeHandle[],
  stateFor: (handle: FakeHandle) => EntityViewState,
): ViewProjection => ({
  view: 'placement',
  cameraPresetId: 'placement',
  entityStates: Object.fromEntries(handles.map((handle) => [handle.entityId, stateFor(handle)])),
  relationStates: {},
  callouts: [],
  activeRoutes: [],
});

const camera = (): THREE.OrthographicCamera => {
  const result = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  result.position.set(0, 0, 10);
  result.lookAt(0, 0, 0);
  result.updateProjectionMatrix();
  result.updateMatrixWorld(true);
  return result;
};

const labelFor = (container: HTMLElement, entityId: string): HTMLDivElement => {
  const element = [...container.querySelectorAll<HTMLDivElement>('.scene-label')].find(
    (candidate) => candidate.dataset.entityId === entityId,
  );
  if (!element) throw new Error(`Missing test label for ${entityId}.`);
  return element;
};

const setLabelSize = (element: HTMLDivElement, width: number, height: number): void => {
  Object.defineProperty(element, 'offsetWidth', { configurable: true, value: width });
  Object.defineProperty(element, 'offsetHeight', { configurable: true, value: height });
};

const screenRect = (element: HTMLDivElement): ScreenRect => {
  const left = Number(element.dataset.screenX);
  const top = Number(element.dataset.screenY);
  const width = Number(element.dataset.screenWidth);
  const height = Number(element.dataset.screenHeight);
  return { left, top, right: left + width, bottom: top + height };
};

const overlaps = (left: ScreenRect, right: ScreenRect): boolean =>
  left.left < right.right &&
  left.right > right.left &&
  left.top < right.bottom &&
  left.bottom > right.top;

const contains = (rect: ScreenRect, x: number, y: number): boolean =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;

describe('LabelManager deterministic screen-space layout', () => {
  it('keeps collocated critical labels visible, separated, and off the focused center', () => {
    const container = document.createElement('div');
    const handles = [
      makeHandle('focus-a', 'Pod', new THREE.Vector3()),
      makeHandle('focus-b', 'Pod', new THREE.Vector3()),
    ];
    const registry = makeRegistry(handles);
    const view = makeView(handles, () => ({
      visible: true,
      emphasis: 'focused',
      labelMode: 'full',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    for (const handle of handles) setLabelSize(labelFor(container, handle.entityId), 100, 28);
    manager.update(registry, camera(), 400, 300);

    const first = labelFor(container, 'focus-a');
    const second = labelFor(container, 'focus-b');
    expect(first.hidden).toBe(false);
    expect(second.hidden).toBe(false);
    expect(overlaps(screenRect(first), screenRect(second))).toBe(false);
    expect(contains(screenRect(first), 200, 150)).toBe(false);
    expect(contains(screenRect(second), 200, 150)).toBe(false);
    manager.clear();
  });

  it('places the highest-priority selected label before hiding a colliding peer', () => {
    const container = document.createElement('div');
    const selected = makeHandle('selected', 'Pod', new THREE.Vector3(), 0.8, true);
    const peer = makeHandle('peer', 'Node', new THREE.Vector3(), 0.8);
    const handles = [peer, selected];
    const registry = makeRegistry(handles);
    const view = makeView(handles, () => ({
      visible: true,
      emphasis: 'normal',
      labelMode: 'short',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    setLabelSize(labelFor(container, 'selected'), 90, 24);
    setLabelSize(labelFor(container, 'peer'), 90, 24);
    manager.update(registry, camera(), 400, 300, { x: 150, y: 102, width: 100, height: 32 });

    expect(labelFor(container, 'selected').hidden).toBe(false);
    expect(labelFor(container, 'selected').dataset.priority).toBe('100');
    expect(labelFor(container, 'peer').hidden).toBe(true);
    expect(labelFor(container, 'peer').dataset.hiddenReason).toBe('collision');
    manager.clear();
  });

  it('constrains every visible label to the requested safe rect and camera viewport', () => {
    const container = document.createElement('div');
    const focused = makeHandle('edge-focus', 'Pod', new THREE.Vector3(-4.5, 0, 0));
    const outside = makeHandle('outside-camera', 'Pod', new THREE.Vector3(20, 0, 0));
    const handles = [focused, outside];
    const registry = makeRegistry(handles);
    const view = makeView(handles, (handle) => ({
      visible: true,
      emphasis: handle.entityId === focused.entityId ? 'focused' : 'normal',
      labelMode: 'full',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    setLabelSize(labelFor(container, focused.entityId), 500, 24);
    setLabelSize(labelFor(container, outside.entityId), 80, 24);
    const safe: LabelSafeRect = { x: 100, y: 50, width: 180, height: 120 };
    manager.update(registry, camera(), 400, 300, safe);

    const focusedLabel = labelFor(container, focused.entityId);
    expect(focusedLabel.hidden).toBe(false);
    const rect = screenRect(focusedLabel);
    expect(rect.left).toBeGreaterThanOrEqual(safe.x);
    expect(rect.top).toBeGreaterThanOrEqual(safe.y);
    expect(rect.right).toBeLessThanOrEqual(safe.x + safe.width);
    expect(rect.bottom).toBeLessThanOrEqual(safe.y + safe.height);
    expect(focusedLabel.style.maxWidth).toBe('180px');
    expect(labelFor(container, outside.entityId).hidden).toBe(true);
    expect(labelFor(container, outside.entityId).dataset.hiddenReason).toBe('outside-camera');
    manager.clear();
  });

  it('enforces mobile density by hiding deterministic low-priority labels', () => {
    const container = document.createElement('div');
    const handles = Array.from({ length: 9 }, (_, index) =>
      makeHandle(`peer-${index}`, 'Pod', new THREE.Vector3(-4 + index, 0, 0), 0.7),
    );
    const registry = makeRegistry(handles);
    const view = makeView(handles, () => ({
      visible: true,
      emphasis: 'normal',
      labelMode: 'short',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    for (const handle of handles) setLabelSize(labelFor(container, handle.entityId), 54, 22);
    manager.update(registry, camera(), 390, 844);

    const elements = handles.map((handle) => labelFor(container, handle.entityId));
    expect(elements.filter((element) => !element.hidden)).toHaveLength(3);
    expect(elements.some((element) => element.dataset.hiddenReason === 'density')).toBe(true);
    for (const element of elements.filter((candidate) => !candidate.hidden)) {
      const rect = screenRect(element);
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.top).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(390);
      expect(rect.bottom).toBeLessThanOrEqual(844);
    }
    manager.clear();
  });

  it('caps desktop entity labels at seven without charging zone titles to that budget', () => {
    const container = document.createElement('div');
    const handles = Array.from({ length: 9 }, (_, index) =>
      makeHandle(`node-${index}`, 'Node', new THREE.Vector3(-4 + index, 0, 0), 0.7),
    );
    const registry = makeRegistry(handles, [
      {
        id: 'layout:control-plane',
        text: 'CONTROL PLANE',
        worldPosition: [-3.5, 3.5, 0],
        zoneId: 'control-plane',
        kind: 'zone-title',
      },
      {
        id: 'layout:worker-nodes',
        text: 'WORKER NODES',
        worldPosition: [3.5, 3.5, 0],
        zoneId: 'worker-nodes',
        kind: 'zone-title',
      },
    ]);
    const manager = new LabelManager(container);
    manager.sync(
      registry,
      makeView(handles, () => ({ visible: true, emphasis: 'normal', labelMode: 'short' })),
      'en',
    );
    for (const element of container.querySelectorAll<HTMLDivElement>('.scene-label')) {
      setLabelSize(element, 34, 20);
    }
    manager.update(registry, camera(), 800, 500);

    const entityLabels = [
      ...container.querySelectorAll<HTMLDivElement>('.scene-label[data-entity-id]'),
    ];
    const layoutLabels = [...container.querySelectorAll<HTMLDivElement>('.scene-layout-label')];
    expect(entityLabels.filter((element) => !element.hidden)).toHaveLength(7);
    expect(layoutLabels.every((element) => !element.hidden)).toBe(true);
    manager.clear();
  });

  it('projects stable layout-zone and pending-tray titles without stealing entity identity', () => {
    const container = document.createElement('div');
    const handle = makeHandle('api', 'KubeAPIServer', new THREE.Vector3(0, 0, 0), 0.8);
    const registry = makeRegistry(
      [handle],
      [
        {
          id: 'layout:control-plane',
          text: 'CONTROL PLANE',
          worldPosition: [-3, 3, 0],
          zoneId: 'control-plane',
          kind: 'zone-title',
        },
        {
          id: 'layout:pending-pods',
          text: 'UNSCHEDULED PODS',
          worldPosition: [3, -3, 0],
          kind: 'tray-title',
        },
      ],
    );
    const manager = new LabelManager(container);
    manager.sync(
      registry,
      makeView([handle], () => ({
        visible: true,
        emphasis: 'normal',
        labelMode: 'short',
      })),
      'en',
    );

    const zone = container.querySelector<HTMLDivElement>(
      '[data-layout-label-id="layout:control-plane"]',
    );
    const tray = container.querySelector<HTMLDivElement>(
      '[data-layout-label-id="layout:pending-pods"]',
    );
    expect(zone?.textContent).toBe('CONTROL PLANE');
    expect(zone?.dataset.entityId).toBeUndefined();
    expect(zone?.dataset.layoutKind).toBe('zone-title');
    expect(tray?.textContent).toBe('UNSCHEDULED PODS');
    expect(manager.size).toBe(3);

    for (const element of container.querySelectorAll<HTMLDivElement>('.scene-label')) {
      setLabelSize(element, 86, 22);
    }
    manager.update(registry, camera(), 400, 300);
    expect(zone?.hidden).toBe(false);
    expect(tray?.hidden).toBe(false);
    manager.clear();
  });

  it('shows at most three short route verbs on desktop and one on mobile', () => {
    const container = document.createElement('div');
    const registry = makeRegistry([]);
    const hops = Array.from({ length: 4 }, (_, index) => ({
      index,
      hop: {
        fromEntityId: `from-${index}`,
        fromAnchor: 'control' as const,
        toEntityId: `to-${index}`,
        toAnchor: 'control' as const,
        label: { en: `verb-${index}`, ja: `verb-${index}`, 'zh-CN': `verb-${index}` },
      },
      points: [new THREE.Vector3(-3 + index * 2, 2, 0), new THREE.Vector3(-2.4 + index * 2, 2, 0)],
      length: 0.6,
    }));
    const route = {
      id: 'route:verbs',
      semantic: 'control' as const,
      label: localized,
      persistAfterAnimation: true,
      numbered: true,
      hops: hops.map((hop) => hop.hop),
    };
    const view = {
      ...makeView([], () => ({ visible: true, emphasis: 'normal', labelMode: 'short' })),
      activeRoutes: [route],
    };
    const routeLayer = {
      getRoute: () => ({
        plan: {
          hops,
          markers: hops.map((hop) => ({
            number: hop.index + 1,
            hopIndex: hop.index,
            position: hop.points[0]!.clone(),
          })),
        },
      }),
    } as unknown as RelationLayer;
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en', routeLayer);
    const labels = [...container.querySelectorAll<HTMLDivElement>('.scene-route-label')];
    expect(labels.map((element) => element.textContent)).toEqual(['verb-0', 'verb-1', 'verb-2']);
    for (const element of labels) setLabelSize(element, 44, 20);

    manager.update(registry, camera(), 800, 500);
    expect(labels.filter((element) => !element.hidden)).toHaveLength(3);
    manager.update(registry, camera(), 390, 844);
    expect(labels.filter((element) => !element.hidden)).toHaveLength(1);
    manager.clear();
  });

  it('produces the same tie-break layout regardless of registry iteration order', () => {
    const handles = [
      makeHandle('b-label', 'Pod', new THREE.Vector3(), 0.8),
      makeHandle('a-label', 'Pod', new THREE.Vector3(), 0.8),
    ];
    const view = makeView(handles, () => ({
      visible: true,
      emphasis: 'normal',
      labelMode: 'short',
    }));

    const layoutFor = (ordered: readonly FakeHandle[]): Readonly<Record<string, string>> => {
      const container = document.createElement('div');
      const registry = makeRegistry(ordered);
      const manager = new LabelManager(container);
      manager.sync(registry, view, 'en');
      for (const handle of handles) setLabelSize(labelFor(container, handle.entityId), 80, 24);
      manager.update(registry, camera(), 400, 300);
      const result = Object.fromEntries(
        handles.map((handle) => [
          handle.entityId,
          labelFor(container, handle.entityId).style.transform,
        ]),
      );
      manager.clear();
      return result;
    };

    expect(layoutFor(handles)).toEqual(layoutFor([...handles].reverse()));
  });

  it('refreshes ReplicaSet label counters after a counter cue settles', () => {
    const container = document.createElement('div');
    const handle = makeHandle('api-rs', 'ReplicaSet', new THREE.Vector3());
    handle.root.userData.domLabel = { text: 'ReplicaSet · api-rs' };
    handle.root.userData.counters = { spec: 3, observed: 3, ready: 3 };
    const registry = makeRegistry([handle]);
    const view = makeView([handle], () => ({
      visible: true,
      emphasis: 'focused',
      labelMode: 'full',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    const label = labelFor(container, handle.entityId);
    expect(label).toHaveTextContent('SPEC 3 OBSERVED 3 READY 3');

    handle.root.userData.counters = { spec: 3, observed: 3, ready: 2 };
    setLabelSize(label, 190, 24);
    manager.update(registry, camera(), 400, 300);
    expect(label).toHaveTextContent('SPEC 3 OBSERVED 3 READY 2');
    manager.clear();
  });

  it('hides all labels for an invalid viewport and removes owned DOM on clear', () => {
    const container = document.createElement('div');
    const handle = makeHandle('pod', 'Pod', new THREE.Vector3());
    const registry = makeRegistry([handle]);
    const view = makeView([handle], () => ({
      visible: true,
      emphasis: 'normal',
      labelMode: 'short',
    }));
    const manager = new LabelManager(container);
    manager.sync(registry, view, 'en');
    manager.update(registry, camera(), 0, 0);
    expect(labelFor(container, handle.entityId).hidden).toBe(true);
    expect(labelFor(container, handle.entityId).dataset.hiddenReason).toBe('invalid-viewport');
    manager.clear();
    expect(container.querySelectorAll('.scene-label')).toHaveLength(0);
    expect(manager.size).toBe(0);
  });

  it('shows the Node-local Container Runtime label only while focused or selected', () => {
    const container = document.createElement('div');
    const runtime = makeHandle('runtime-a', 'ContainerRuntime', new THREE.Vector3());
    const registry = makeRegistry([runtime]);
    const manager = new LabelManager(container);

    manager.sync(
      registry,
      makeView([runtime], () => ({ visible: true, emphasis: 'normal', labelMode: 'short' })),
      'en',
    );
    expect(container.querySelector('[data-entity-id="runtime-a"]')).toBeNull();

    manager.sync(
      registry,
      makeView([runtime], () => ({ visible: true, emphasis: 'focused', labelMode: 'short' })),
      'en',
    );
    expect(container.querySelector('[data-entity-id="runtime-a"]')).not.toBeNull();

    runtime.root.userData.selected = true;
    manager.sync(
      registry,
      makeView([runtime], () => ({ visible: true, emphasis: 'normal', labelMode: 'short' })),
      'en',
    );
    expect(container.querySelector('[data-entity-id="runtime-a"]')).not.toBeNull();
    manager.clear();
  });
});
