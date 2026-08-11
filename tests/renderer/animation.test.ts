import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { PlaybackRequest, TransitionCue } from '../../src/course/types';
import {
  AnimationCoordinator,
  type AnimationContext,
} from '../../src/renderer/AnimationCoordinator';
import { SceneController } from '../../src/renderer/SceneController';
import type { AnchorKind, EntityVisualHandle } from '../../src/renderer/VisualHandles';
import type { WorldEntity } from '../../src/world/types';

const localized = { en: 'label', ja: 'label', 'zh-CN': 'label' } as const;

interface TestHandle extends EntityVisualHandle {
  readonly mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>;
}

const createEntity = (id: string): WorldEntity => ({
  id,
  category: 'runtime-status',
  kind: 'Container',
  name: id,
  status: 'running',
  data: {},
  title: localized,
  summary: localized,
  sourceIds: [],
  visual: { archetype: 'container' },
});

const createHandle = (id: string, x: number): TestHandle => {
  const root = new THREE.Group();
  root.position.set(x, 1, 0);
  root.scale.set(1.2, 0.9, 1.1);
  const material = new THREE.MeshBasicMaterial({
    color: 0x45c486,
    opacity: 0.82,
    transparent: true,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  root.add(mesh);
  const entity = createEntity(id);
  return {
    entityId: id,
    entity,
    root,
    mesh,
    selectableObjects: [mesh],
    isDisposed: false,
    update: () => undefined,
    setSelected: () => undefined,
    getAnchor: (anchor: AnchorKind) => {
      root.updateWorldMatrix(true, false);
      const offset =
        anchor === 'network-in'
          ? new THREE.Vector3(-0.5, 0.7, 0)
          : anchor === 'network-out'
            ? new THREE.Vector3(0.5, 0.7, 0)
            : new THREE.Vector3();
      return root.localToWorld(offset);
    },
    dispose: () => undefined,
  };
};

interface VisualSnapshot {
  readonly position: readonly number[];
  readonly scale: readonly number[];
  readonly visible: boolean;
  readonly opacity: number;
  readonly transparent: boolean;
  readonly depthWrite: boolean;
}

const snapshot = (handle: TestHandle): VisualSnapshot => ({
  position: handle.root.position.toArray(),
  scale: handle.root.scale.toArray(),
  visible: handle.root.visible,
  opacity: handle.mesh.material.opacity,
  transparent: handle.mesh.material.transparent,
  depthWrite: handle.mesh.material.depthWrite,
});

const request = (cue: TransitionCue, playbackId = 1, stepKey = 'lesson:step'): PlaybackRequest => ({
  stepKey,
  playbackId,
  transition: { cues: [cue] },
});

interface Harness {
  readonly scene: THREE.Scene;
  readonly handles: Readonly<Record<'a' | 'b' | 'c', TestHandle>>;
  readonly relationRoot: THREE.Group;
  readonly relationMaterial: THREE.LineBasicMaterial;
  readonly routeRoot: THREE.Group;
  readonly routeProgress: number[];
  readonly routeEvents: Array<{
    readonly progress: number;
    readonly direction: 'forward' | 'reverse' | undefined;
    readonly flowPhase: 'request' | 'response' | undefined;
  }>;
  readonly routeFinishes: { value: number };
  readonly phases: string[];
  readonly counterValues: number[];
  readonly coordinator: AnimationCoordinator;
  dispose(): void;
}

const createHarness = (reducedMotion = false): Harness => {
  const scene = new THREE.Scene();
  const handles = {
    a: createHandle('a', 0),
    b: createHandle('b', 5),
    c: createHandle('c', 10),
  } as const;
  for (const handle of Object.values(handles)) scene.add(handle.root);

  const relationRoot = new THREE.Group();
  const relationMaterial = new THREE.LineBasicMaterial({
    opacity: 0.73,
    transparent: true,
  });
  relationRoot.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ]),
      relationMaterial,
    ),
  );
  scene.add(relationRoot);

  const routeRoot = new THREE.Group();
  routeRoot.name = 'teaching-route:main';
  scene.add(routeRoot);
  const routeProgress: number[] = [];
  const routeEvents: Harness['routeEvents'] = [];
  const routeFinishes = { value: 0 };

  const phases: string[] = [];
  const counterValues: number[] = [];
  const context: AnimationContext = {
    scene,
    reducedMotion,
    now: () => 0,
    getEntity: (entityId) => Object.values(handles).find((handle) => handle.entityId === entityId),
    getRelation: (relationId) => (relationId === 'r1' ? { root: relationRoot } : undefined),
    getRoute: (routeId) =>
      routeId === 'route:main'
        ? {
            root: routeRoot,
            setFlowProgress: (progress, direction, flowPhase) => {
              routeProgress.push(progress);
              routeEvents.push({ progress, direction, flowPhase });
            },
            finishFlow: () => {
              routeFinishes.value += 1;
            },
          }
        : undefined,
    focusCamera: ({ phase }) => phases.push(`focus:${phase}`),
    transitionLayout: ({ phase }) => phases.push(`layout:${phase}`),
    reconcilePulse: ({ phase }) => phases.push(`reconcile:${phase}`),
    schedulerAssignment: ({ phase }) => phases.push(`scheduler:${phase}`),
    counterChange: ({ phase, value }) => {
      phases.push(`counter:${phase}`);
      counterValues.push(value);
    },
    relationReveal: ({ phase }) => phases.push(`relation:${phase}`),
    callout: ({ phase }) => phases.push(`callout:${phase}`),
    entityExitComplete: (entityId) => phases.push(`exit:${entityId}`),
  };
  const coordinator = new AnimationCoordinator(context);

  return {
    scene,
    handles,
    relationRoot,
    relationMaterial,
    routeRoot,
    routeProgress,
    routeEvents,
    routeFinishes,
    phases,
    counterValues,
    coordinator,
    dispose: () => {
      coordinator.dispose();
      for (const handle of Object.values(handles)) {
        handle.mesh.geometry.dispose();
        handle.mesh.material.dispose();
      }
      const line = relationRoot.children[0];
      if (line instanceof THREE.Line) line.geometry.dispose();
      relationMaterial.dispose();
    },
  };
};

const cueCases: readonly [string, TransitionCue][] = [
  [
    'data packet',
    { type: 'data-packet', routeId: 'route:main', label: localized, durationMs: 1_000 },
  ],
  ['DNS query', { type: 'dns-query', routeId: 'route:main', label: localized, durationMs: 1_000 }],
  [
    'API request',
    { type: 'api-request', routeId: 'route:main', label: localized, durationMs: 1_000 },
  ],
  ['camera focus', { type: 'focus-camera', entityId: 'a', durationMs: 1_000 }],
  ['layout', { type: 'layout-transition', durationMs: 1_000 }],
  ['container failure', { type: 'container-failure', entityId: 'a', durationMs: 1_000 }],
  [
    'node runtime restart',
    {
      type: 'node-runtime-restart',
      routeId: 'route:main',
      entityId: 'a',
      durationMs: 1_000,
    },
  ],
  ['container restart', { type: 'container-restart', entityId: 'a', durationMs: 1_000 }],
  ['container start', { type: 'container-start', entityId: 'a', durationMs: 1_000 }],
  ['entity exit', { type: 'entity-exit', entityId: 'a', durationMs: 1_000 }],
  ['entity enter', { type: 'entity-enter', entityId: 'a', durationMs: 1_000 }],
  [
    'reconcile pulse',
    {
      type: 'reconcile-pulse',
      fromEntityId: 'a',
      toEntityId: 'b',
      routeId: 'route:main',
      durationMs: 1_000,
    },
  ],
  [
    'scheduler assignment',
    {
      type: 'scheduler-assignment',
      schedulerId: 'a',
      podId: 'b',
      nodeId: 'c',
      routeId: 'route:main',
      durationMs: 1_000,
    },
  ],
  [
    'counter change',
    {
      type: 'counter-change',
      entityId: 'a',
      field: 'readyReplicas',
      from: 2,
      to: 3,
      durationMs: 1_000,
    },
  ],
  ['relation reveal', { type: 'relation-reveal', relationId: 'r1', durationMs: 1_000 }],
  ['callout', { type: 'callout', entityId: 'a', label: localized, durationMs: 1_000 }],
];

describe('AnimationCoordinator cue lifecycle', () => {
  it.each(cueCases)('runs and disposes the dedicated %s handler', (_name, cue) => {
    const harness = createHarness();
    expect(harness.coordinator.play(request(cue))).toBe(true);
    expect(harness.coordinator.activeCount).toBe(1);
    expect(harness.coordinator.update(500)).toBe(true);
    expect(harness.coordinator.update(1_000)).toBe(false);
    expect(harness.coordinator.activeCount).toBe(0);
    expect(harness.coordinator.leasedTokenCount).toBe(0);
    harness.dispose();
  });

  it('drives the local route and replacement runtime Container from one causal cue', () => {
    const harness = createHarness();
    const baseline = snapshot(harness.handles.a);
    const cue: TransitionCue = {
      type: 'node-runtime-restart',
      routeId: 'route:main',
      entityId: 'a',
      durationMs: 1_000,
    };

    harness.coordinator.play(request(cue));
    expect(harness.routeProgress).toEqual([0]);
    expect(harness.handles.a.mesh.material.opacity).toBeLessThan(baseline.opacity);
    harness.coordinator.update(500);
    expect(harness.routeProgress.at(-1)).toBeCloseTo(0.5);
    expect(harness.handles.a.root.scale.y).not.toBe(baseline.scale[1]);
    harness.coordinator.finish();
    expect(harness.routeFinishes.value).toBe(1);
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    harness.dispose();
  });

  it('drives a response backward over the persistent request route and fails if the route is absent', () => {
    const harness = createHarness();
    const response: TransitionCue = {
      type: 'data-packet',
      routeId: 'route:main',
      label: localized,
      flowPhase: 'response',
      direction: 'reverse',
      durationMs: 1_000,
    };
    harness.coordinator.play(request(response));
    expect(harness.routeEvents[0]).toEqual({
      progress: 0,
      direction: 'reverse',
      flowPhase: 'response',
    });
    harness.coordinator.update(500);
    expect(harness.routeEvents.at(-1)).toEqual({
      progress: 0.5,
      direction: 'reverse',
      flowPhase: 'response',
    });
    harness.dispose();

    const missingHarness = createHarness();
    expect(() =>
      missingHarness.coordinator.play(request({ ...response, routeId: 'route:missing' })),
    ).toThrow(/missing persistent teaching route/);
    expect(missingHarness.coordinator.activeCount).toBe(0);
    missingHarness.dispose();
  });

  it('reports start, update, finish and committed numeric values through host callbacks', () => {
    const harness = createHarness();
    const cue: TransitionCue = {
      type: 'counter-change',
      entityId: 'a',
      field: 'readyReplicas',
      from: 2,
      to: 3,
      durationMs: 1_000,
    };
    harness.coordinator.play(request(cue));
    harness.coordinator.update(500);
    harness.coordinator.finish();
    expect(harness.phases).toEqual([
      'counter:start',
      'counter:update',
      'counter:update',
      'counter:finish',
    ]);
    expect(harness.counterValues[0]).toBe(2);
    expect(harness.counterValues[1]).toBeCloseTo(2.5);
    expect(harness.counterValues.at(-1)).toBe(3);
    harness.dispose();
  });

  it('cancels to exact transform, visibility, and material baselines', () => {
    const mutatingCues: readonly TransitionCue[] = [
      { type: 'container-failure', entityId: 'a', durationMs: 1_000 },
      {
        type: 'node-runtime-restart',
        routeId: 'route:main',
        entityId: 'a',
        durationMs: 1_000,
      },
      { type: 'container-restart', entityId: 'a', durationMs: 1_000 },
      { type: 'container-start', entityId: 'a', durationMs: 1_000 },
      { type: 'entity-enter', entityId: 'a', durationMs: 1_000 },
      { type: 'entity-exit', entityId: 'a', durationMs: 1_000 },
      {
        type: 'reconcile-pulse',
        fromEntityId: 'a',
        toEntityId: 'b',
        routeId: 'route:main',
        durationMs: 1_000,
      },
      {
        type: 'scheduler-assignment',
        schedulerId: 'a',
        podId: 'b',
        nodeId: 'c',
        routeId: 'route:main',
        durationMs: 1_000,
      },
      { type: 'relation-reveal', relationId: 'r1', durationMs: 1_000 },
    ];

    for (const [index, cue] of mutatingCues.entries()) {
      const harness = createHarness();
      const entityBefore = Object.fromEntries(
        Object.entries(harness.handles).map(([id, handle]) => [id, snapshot(handle)]),
      );
      const relationBefore = {
        visible: harness.relationRoot.visible,
        opacity: harness.relationMaterial.opacity,
        transparent: harness.relationMaterial.transparent,
        depthWrite: harness.relationMaterial.depthWrite,
      };
      harness.coordinator.play(request(cue, index + 1));
      harness.coordinator.update(500);
      harness.coordinator.cancel();
      expect(snapshot(harness.handles.a)).toEqual(entityBefore.a);
      expect(snapshot(harness.handles.b)).toEqual(entityBefore.b);
      expect(snapshot(harness.handles.c)).toEqual(entityBefore.c);
      expect({
        visible: harness.relationRoot.visible,
        opacity: harness.relationMaterial.opacity,
        transparent: harness.relationMaterial.transparent,
        depthWrite: harness.relationMaterial.depthWrite,
      }).toEqual(relationBefore);
      expect(harness.coordinator.leasedTokenCount).toBe(0);
      harness.dispose();
    }
  });

  it('commits exit on finish but restores it when cancelled', () => {
    const harness = createHarness();
    const cue: TransitionCue = { type: 'entity-exit', entityId: 'a', durationMs: 1_000 };
    harness.coordinator.play(request(cue, 1));
    harness.coordinator.update(400);
    harness.coordinator.cancel();
    expect(harness.handles.a.root.visible).toBe(true);
    expect(harness.phases).not.toContain('exit:a');

    harness.coordinator.play(request(cue, 2));
    harness.coordinator.finish();
    expect(harness.handles.a.root.visible).toBe(false);
    expect(harness.phases).toContain('exit:a');
    harness.dispose();
  });

  it('uses authored delays to show the request route before entity exit begins', () => {
    const harness = createHarness();
    const baseline = snapshot(harness.handles.a);
    const playback: PlaybackRequest = {
      stepKey: 'lesson:causal-delete',
      playbackId: 1,
      transition: {
        cues: [
          {
            type: 'api-request',
            routeId: 'route:main',
            label: localized,
            durationMs: 700,
          },
          { type: 'entity-exit', entityId: 'a', delayMs: 520, durationMs: 720 },
        ],
      },
    };

    harness.coordinator.play(playback);
    expect(harness.routeProgress).toEqual([0]);
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    harness.coordinator.update(500);
    expect(harness.routeProgress.at(-1)).toBeGreaterThan(0);
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    harness.coordinator.update(700);
    expect(harness.handles.a.mesh.material.opacity).toBeLessThan(baseline.opacity);
    harness.coordinator.finish();
    expect(harness.routeFinishes.value).toBe(1);
    expect(harness.phases.filter((phase) => phase === 'exit:a')).toHaveLength(1);
    harness.dispose();
  });

  it('cancels and finishes delayed cues idempotently', () => {
    const harness = createHarness();
    const delayedRoute: TransitionCue = {
      type: 'api-request',
      routeId: 'route:main',
      label: localized,
      delayMs: 500,
      durationMs: 700,
    };
    harness.coordinator.play(request(delayedRoute, 1));
    expect(harness.routeProgress).toEqual([0]);
    harness.coordinator.cancel();
    harness.coordinator.cancel();
    expect(harness.routeFinishes.value).toBe(1);

    harness.coordinator.play(request(delayedRoute, 2));
    harness.coordinator.finish();
    harness.coordinator.finish();
    expect(harness.routeProgress).toEqual([0, 0, 1]);
    expect(harness.routeFinishes.value).toBe(2);
    harness.dispose();
  });

  it('holds an entered entity in its authored before-state until the causal delay elapses', () => {
    const harness = createHarness();
    const baseline = snapshot(harness.handles.a);
    const cue: TransitionCue = {
      type: 'entity-enter',
      entityId: 'a',
      delayMs: 500,
      durationMs: 700,
    };
    harness.coordinator.play(request(cue));
    expect(harness.handles.a.mesh.material.opacity).toBe(0);
    harness.coordinator.update(499);
    expect(harness.handles.a.mesh.material.opacity).toBe(0);
    harness.coordinator.update(850);
    expect(harness.handles.a.mesh.material.opacity).toBeGreaterThan(0);
    expect(harness.handles.a.mesh.material.opacity).toBeLessThan(baseline.opacity);
    harness.coordinator.finish();
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    harness.dispose();
  });
});

describe('AnimationCoordinator playback identity and replay safety', () => {
  it('ignores duplicate and stale playback IDs without interrupting active playback', () => {
    const harness = createHarness();
    const cue: TransitionCue = { type: 'container-restart', entityId: 'a', durationMs: 1_000 };
    expect(harness.coordinator.play(request(cue, 7))).toBe(true);
    harness.coordinator.update(300);
    const inFlight = snapshot(harness.handles.a);
    expect(harness.coordinator.play(request(cue, 7))).toBe(false);
    expect(harness.coordinator.play(request(cue, 6))).toBe(false);
    expect(snapshot(harness.handles.a)).toEqual(inFlight);
    expect(harness.coordinator.activeCount).toBe(1);
    expect(harness.coordinator.lastPlaybackId('lesson:step')).toBe(7);
    harness.dispose();
  });

  it('allows the same playback identity after a new authored step application', () => {
    const harness = createHarness();
    const cue: TransitionCue = { type: 'container-restart', entityId: 'a', durationMs: 1_000 };
    expect(harness.coordinator.play(request(cue, 7))).toBe(true);
    harness.coordinator.finish();
    harness.coordinator.forgetPlayback('lesson:step');
    expect(harness.coordinator.play(request(cue, 7))).toBe(true);
    expect(harness.coordinator.activeCount).toBe(1);
    harness.dispose();
  });

  it('never accumulates scale, opacity, position, or material flags across replay', () => {
    const harness = createHarness();
    const baseline = snapshot(harness.handles.a);
    const materialIdentity = harness.handles.a.mesh.material;
    const cue: TransitionCue = { type: 'container-restart', entityId: 'a', durationMs: 1_000 };

    for (let playbackId = 1; playbackId <= 20; playbackId += 1) {
      expect(harness.coordinator.play(request(cue, playbackId))).toBe(true);
      harness.coordinator.update(450);
      if (playbackId % 2 === 0) harness.coordinator.cancel();
      else harness.coordinator.finish();
      expect(snapshot(harness.handles.a)).toEqual(baseline);
      expect(harness.handles.a.mesh.material).toBe(materialIdentity);
    }
    harness.dispose();
  });

  it('drives and releases the token on the renderer-owned persistent route', () => {
    const harness = createHarness();
    const cue: TransitionCue = {
      type: 'data-packet',
      routeId: 'route:main',
      label: localized,
      durationMs: 1_000,
    };
    harness.coordinator.play(request(cue, 1));
    expect(harness.routeProgress).toEqual([0]);
    harness.coordinator.update(500);
    expect(harness.routeProgress.at(-1)).toBeCloseTo(0.5);
    expect(harness.scene.getObjectByName('animation-token')).toBeUndefined();
    harness.coordinator.finish();
    expect(harness.routeFinishes.value).toBe(1);

    harness.coordinator.play(request(cue, 2));
    harness.coordinator.cancel();
    expect(harness.routeFinishes.value).toBe(2);
    harness.dispose();
  });
});

describe('AnimationCoordinator reduced motion', () => {
  it('settles lifecycle cues synchronously without scale movement', () => {
    const harness = createHarness(true);
    const baseline = snapshot(harness.handles.a);
    const cue: TransitionCue = { type: 'container-restart', entityId: 'a', durationMs: 2_000 };
    harness.coordinator.play(request(cue));
    expect(harness.handles.a.root.scale.toArray()).toEqual(baseline.scale);
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    expect(harness.coordinator.activeCount).toBe(0);
    expect(harness.coordinator.update(0)).toBe(false);
    harness.dispose();
  });

  it('snaps camera intent and preserves route direction synchronously', () => {
    const harness = createHarness(true);
    const focus: TransitionCue = { type: 'focus-camera', entityId: 'a', durationMs: 5_000 };
    harness.coordinator.play(request(focus, 1));
    expect(harness.phases[0]).toBe('focus:start');
    expect(harness.coordinator.activeCount).toBe(0);

    const packet: TransitionCue = {
      type: 'data-packet',
      routeId: 'route:main',
      label: localized,
      durationMs: 5_000,
    };
    harness.coordinator.play(request(packet, 2));
    expect(harness.routeProgress.at(-1)).toBe(1);
    expect(harness.scene.getObjectByName('animation-token')).toBeUndefined();
    expect(harness.routeFinishes.value).toBe(1);
    expect(harness.coordinator.leasedTokenCount).toBe(0);
    harness.dispose();
  });

  it('collapses authored delays into an immediately legible reduced-motion result', () => {
    const harness = createHarness(true);
    const baseline = snapshot(harness.handles.a);
    const cue: TransitionCue = {
      type: 'container-start',
      entityId: 'a',
      delayMs: 5_000,
      durationMs: 2_000,
    };
    harness.coordinator.play(request(cue));
    expect(snapshot(harness.handles.a)).toEqual(baseline);
    expect(harness.coordinator.activeCount).toBe(0);
    harness.dispose();
  });

  it('notifies the render host whenever playback changes', () => {
    const scene = new THREE.Scene();
    const markDirty = vi.fn();
    const coordinator = new AnimationCoordinator({
      scene,
      reducedMotion: true,
      now: () => 0,
      getEntity: () => undefined,
      markDirty,
    });
    coordinator.play(request({ type: 'layout-transition', durationMs: 1_000 }));
    coordinator.update(70);
    coordinator.cancel();
    expect(markDirty).toHaveBeenCalled();
    coordinator.dispose();
  });
});

describe('SceneController reduced-motion transition', () => {
  it('settles an active normal-motion route immediately when reduced motion is enabled', () => {
    const finish = vi.fn();
    const cleanupPendingExits = vi.fn();
    const removeReason = vi.fn();
    const markDirty = vi.fn();
    const resyncActiveRouteGeometry = vi.fn();
    const setRouteReducedMotion = vi.fn();
    const controller = Object.create(SceneController.prototype) as SceneController;

    Object.assign(controller as unknown as Record<string, unknown>, {
      reducedMotion: false,
      cameraTransition: undefined,
      animations: { activeCount: 1, finish },
      activeRoutes: { size: 1, setReducedMotion: setRouteReducedMotion },
      scheduler: { removeReason, markDirty },
      cleanupPendingExits,
      resyncActiveRouteGeometry,
    });

    controller.setReducedMotion(true);

    expect(setRouteReducedMotion).toHaveBeenCalledWith(true);
    expect(finish).toHaveBeenCalledOnce();
    expect(cleanupPendingExits).toHaveBeenCalledOnce();
    expect(removeReason).toHaveBeenCalledWith('animations');
    expect(resyncActiveRouteGeometry).toHaveBeenCalledOnce();
    expect(markDirty).toHaveBeenCalledOnce();
  });

  it('cleans retained exit handles after synchronous reduced-motion playback', () => {
    const cleanupPendingExits = vi.fn();
    const markDirty = vi.fn();
    const setRouteReducedMotion = vi.fn();
    const cancel = vi.fn();
    const play = vi.fn(() => true);
    const prepareExitHandles = vi.fn();
    const controller = Object.create(SceneController.prototype) as SceneController;

    Object.assign(controller as unknown as Record<string, unknown>, {
      reducedMotion: true,
      cameraTransition: undefined,
      animations: {
        activeCount: 0,
        lastPlaybackId: () => undefined,
        cancel,
        play,
      },
      activeRoutes: { size: 0, setReducedMotion: setRouteReducedMotion },
      scheduler: { addReason: vi.fn(), removeReason: vi.fn(), markDirty },
      currentStep: {},
      pendingExitIds: new Set(['a']),
      prepareExitHandles,
      cleanupPendingExits,
    });

    controller.playTransition(
      request({ type: 'entity-exit', entityId: 'a', durationMs: 1_000 }),
      true,
    );

    expect(setRouteReducedMotion).toHaveBeenCalledWith(true);
    expect(cancel).toHaveBeenCalledOnce();
    expect(prepareExitHandles).toHaveBeenCalledOnce();
    expect(play).toHaveBeenCalledOnce();
    expect(cleanupPendingExits).toHaveBeenCalledOnce();
    expect(markDirty).toHaveBeenCalledOnce();
  });

  it('cleans Strict Mode exit handles before rejecting duplicate reduced-motion playback', () => {
    const cleanupPendingExits = vi.fn();
    const markDirty = vi.fn();
    const setRouteReducedMotion = vi.fn();
    const cancel = vi.fn();
    const play = vi.fn(() => true);
    const controller = Object.create(SceneController.prototype) as SceneController;

    Object.assign(controller as unknown as Record<string, unknown>, {
      reducedMotion: true,
      cameraTransition: undefined,
      animations: {
        activeCount: 0,
        lastPlaybackId: () => 1,
        cancel,
        play,
      },
      activeRoutes: { size: 0, setReducedMotion: setRouteReducedMotion },
      scheduler: { addReason: vi.fn(), removeReason: vi.fn(), markDirty },
      pendingExitIds: new Set(['a']),
      cleanupPendingExits,
    });

    controller.playTransition(
      {
        stepKey: 'lesson:step',
        playbackId: 1,
        transition: { cues: [] },
      },
      true,
    );

    expect(setRouteReducedMotion).toHaveBeenCalledWith(true);
    expect(cleanupPendingExits).toHaveBeenCalledOnce();
    expect(cancel).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
    expect(markDirty).toHaveBeenCalledOnce();
  });
});
