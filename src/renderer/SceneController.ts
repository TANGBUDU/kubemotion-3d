import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Locale } from '../app/types';
import type {
  CompiledStep,
  EntityViewState,
  PlaybackRequest,
  RelationViewState,
  ViewProjection,
} from '../course/types';
import type { EntityId, RelationId } from '../world/types';
import { AnimationCoordinator } from './AnimationCoordinator';
import { CalloutManager } from './CalloutManager';
import { captureLayoutTransition, type CapturedLayoutTransition } from './animation/layoutMotion';
import { boundsForHandles } from './camera/CameraFramer';
import { OrthographicLessonCamera } from './camera/OrthographicLessonCamera';
import { SafeViewport, type ViewportInsets } from './camera/SafeViewport';
import { EventListenerTracker } from './diagnostics/EventListenerTracker';
import { LabelManager, type LabelSafeRect } from './LabelManager';
import { calculateLayout, type LayoutResult } from './LayoutEngine';
import { PostProcessingPipeline } from './postprocessing/PostProcessingPipeline';
import { RelationRegistry } from './RelationRegistry';
import { RelationLayer } from './relations/RelationLayer';
import { RoutePlanner } from './relations/RoutePlanner';
import { RouteSceneAdapter } from './relations/RouteSceneAdapter';
import { RenderScheduler } from './RenderScheduler';
import { SceneEnvironment } from './scene/SceneEnvironment';
import { SceneLayers } from './scene/SceneLayers';
import { SceneStage } from './scene/SceneStage';
import { SceneRegistry } from './SceneRegistry';
import { createEffectiveScenePlan } from './scene-grammar';
import { VisualFactoryRegistry } from './VisualFactoryRegistry';
import { ReplicaSetVisualHandle } from './VisualHandles';

export interface SceneDiagnostics {
  readonly entityHandles: number;
  readonly relationHandles: number;
  readonly labels: number;
  readonly callouts: number;
  readonly activeAnimations: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly drawCalls: number;
  readonly pooledTokens: number;
  readonly retainedExitHandles: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly flowTokens: number;
  readonly routeMarkers: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
  readonly renderTargets: number;
  readonly eventListeners: number;
}

export interface SceneControllerOptions {
  readonly safeInsets?: Partial<ViewportInsets>;
}

export class SceneRendererInitializationError extends Error {
  public constructor(cause: unknown) {
    super('KubeMotion could not initialize its WebGL renderer.', { cause });
    this.name = 'SceneRendererInitializationError';
  }
}

const createWebGLRenderer = (): THREE.WebGLRenderer => {
  const parameters = { antialias: false, alpha: true } as const;
  const canvas = document.createElement('canvas');
  // three r185 requires WebGL2 at runtime, while its current type declaration still names the
  // constructor parameter WebGLRenderingContext.
  const context = canvas.getContext('webgl2', parameters) as WebGLRenderingContext | null;
  if (context === null) {
    throw new SceneRendererInitializationError(
      new Error('The canvas returned null while creating a WebGL2 context.'),
    );
  }

  // Pass the probed context through so Three.js does not request a second context. Any exception
  // after a non-null context is an unexpected renderer defect and must retain its original type.
  return new THREE.WebGLRenderer({ ...parameters, canvas, context });
};

const cameraDirection = (presetId: string): THREE.Vector3 => {
  switch (presetId) {
    case 'logical':
      return new THREE.Vector3(0, 1.55, 1);
    case 'control-flow':
    case 'traffic':
      return new THREE.Vector3(0.15, 1.3, 1);
    case 'placement':
      return new THREE.Vector3(1, 1.45, 1);
    default:
      return new THREE.Vector3(0.8, 1.5, 1);
  }
};

const exitProjection = (step: CompiledStep): ViewProjection => {
  const exitTargets = new Set(
    step.transition.cues.flatMap((cue) => (cue.type === 'entity-exit' ? [cue.entityId] : [])),
  );
  const entityStates: Record<EntityId, EntityViewState> = {};
  for (const entity of Object.values(step.beforeWorld.entities)) {
    const authored = step.view.entityStates[entity.id];
    entityStates[entity.id] = authored ?? {
      visible: exitTargets.has(entity.id),
      emphasis: exitTargets.has(entity.id) ? 'focused' : 'hidden',
      labelMode: exitTargets.has(entity.id) ? 'full' : 'none',
    };
  }
  const relationStates: Record<RelationId, RelationViewState> = {};
  for (const relation of Object.values(step.beforeWorld.relations)) {
    relationStates[relation.id] = step.view.relationStates[relation.id] ?? {
      visible: false,
      emphasis: 'normal',
    };
  }
  const authoredProjection: ViewProjection = {
    view: step.view.view,
    cameraPresetId: step.view.cameraPresetId,
    entityStates,
    relationStates,
    callouts: [],
    activeRoutes: [],
  };
  return createEffectiveScenePlan(step.beforeWorld, authoredProjection, {
    viewport: 'desktop',
    applyGrammarDefaults: false,
  }).projection;
};

export class SceneController {
  private readonly scene = new THREE.Scene();
  private readonly lessonCamera = new OrthographicLessonCamera();
  private readonly camera = this.lessonCamera.camera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly layers = new SceneLayers(this.scene);
  private readonly registry = new SceneRegistry(this.layers.entities, new VisualFactoryRegistry(), {
    allowGeneric: false,
  });
  private readonly relations = new RelationRegistry(this.layers.settledRelations);
  private readonly routeAdapter = new RouteSceneAdapter(this.registry);
  private readonly activeRoutes = new RelationLayer(
    this.layers.activeRoutes,
    new RoutePlanner(this.routeAdapter, this.routeAdapter, {
      preferredLaneX: [-9.4, -6.4, 0, 6.4, 9.4],
      preferredLaneZ: [-6.7, -3.3, 3.3, 6.7],
    }),
    { width: 1, height: 1, pixelRatio: 1 },
  );
  private readonly listenerTracker = new EventListenerTracker();
  private readonly controls: OrbitControls;
  private readonly labels: LabelManager;
  private readonly callouts: CalloutManager;
  private readonly environment: SceneEnvironment;
  private readonly stage: SceneStage;
  private readonly postProcessing: PostProcessingPipeline;
  private readonly scheduler = new RenderScheduler((time) => this.render(time));
  private readonly animations: AnimationCoordinator;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly pendingExitIds = new Set<EntityId>();
  private readonly sceneBounds = new THREE.Box3();
  private safeInsets: Partial<ViewportInsets>;
  private labelSafeRect: LabelSafeRect | undefined;
  private locale: Locale = 'en';
  private onSelect: ((id?: EntityId | undefined) => void) | undefined;
  private selected: EntityId | undefined;
  private currentStep: CompiledStep | undefined;
  private layout: LayoutResult | undefined;
  private pendingLayoutTransition: CapturedLayoutTransition | undefined;
  private reducedMotion = false;
  private lastRenderTime = 0;
  private destroyed = false;

  public constructor(
    private readonly host: HTMLElement,
    options: SceneControllerOptions = {},
  ) {
    // WebGL context creation can fail because of browser policy, a blocked GPU, or an exhausted
    // context budget. Keep it inside the constructor so SceneViewport can contain that failure and
    // offer an explicit retry without taking down the surrounding lesson UI.
    this.renderer = createWebGLRenderer();
    this.safeInsets = options.safeInsets ?? {};
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.domElement.setAttribute('aria-label', 'Interactive Kubernetes 3D scene');
    this.host.append(this.renderer.domElement);
    this.controls = new OrbitControls(
      this.camera,
      this.listenerTracker.wrapEventTarget(this.renderer.domElement),
    );
    this.environment = new SceneEnvironment(this.scene, this.renderer, this.layers.environment);
    this.stage = new SceneStage(this.layers.stage);
    this.postProcessing = new PostProcessingPipeline(this.renderer, this.scene, this.camera);
    this.labels = new LabelManager(host);
    this.callouts = new CalloutManager(host);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.enablePan = true;
    this.controls.minZoom = 0.65;
    this.controls.maxZoom = 2.4;
    this.listenerTracker.listen(
      () => this.controls.addEventListener('change', this.handleControlsChange),
      () => this.controls.removeEventListener('change', this.handleControlsChange),
    );
    this.listenerTracker.listen(
      () => this.renderer.domElement.addEventListener('pointerup', this.handlePointer),
      () => this.renderer.domElement.removeEventListener('pointerup', this.handlePointer),
    );
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.animations = new AnimationCoordinator({
      scene: this.scene,
      getEntity: (entityId) => this.registry.get(entityId),
      getRelation: (relationId) => this.relations.get(relationId),
      getRoute: (routeId) => this.activeRoutes.getRoute(routeId),
      now: () => performance.now(),
      markDirty: () => this.scheduler.markDirty(),
      focusCamera: (event) => {
        if (event.phase !== 'start') return;
        const handle = this.registry.get(event.cue.entityId);
        if (handle) this.focusHandle(handle);
      },
      transitionLayout: (event) => {
        const transition = this.pendingLayoutTransition;
        if (!transition) return;
        if (event.phase === 'finish' || event.phase === 'cancel') {
          transition.finish();
          this.pendingLayoutTransition = undefined;
          return;
        }
        transition.apply(event.progress);
      },
      counterChange: (event) => {
        const handle = this.registry.get(event.cue.entityId);
        if (!handle) return;
        if (handle instanceof ReplicaSetVisualHandle) {
          handle.setCounterAnimation(
            event.cue.field,
            event.phase === 'finish' || event.phase === 'cancel' ? undefined : event.value,
          );
          return;
        }
        if (event.phase === 'finish' || event.phase === 'cancel') {
          delete handle.root.userData.counterAnimation;
        } else {
          handle.root.userData.counterAnimation = Object.freeze({
            field: event.cue.field,
            value: event.value,
          });
        }
      },
      callout: (event) => {
        if (event.phase === 'start') {
          this.callouts.flash(event.cue.entityId, event.cue.label[this.locale]);
        }
      },
      entityExitComplete: () => this.cleanupPendingExits(),
    });
    this.resize();
  }

  private viewportInput() {
    return {
      viewport: {
        width: Math.max(1, this.host.clientWidth),
        height: Math.max(1, this.host.clientHeight),
      },
      insets: this.safeInsets,
      safeFrameRatio: 0.06,
    } as const;
  }

  private frameScene(presetId = this.currentStep?.view.cameraPresetId ?? 'overview'): void {
    boundsForHandles(this.registry.values(), this.sceneBounds);
    const routeBounds = new THREE.Box3();
    const routeScratch = new THREE.Box3();
    for (const routeRoot of this.activeRoutes.root.children) {
      if (!routeRoot.visible) continue;
      routeScratch.setFromObject(routeRoot, true);
      if (!routeScratch.isEmpty()) routeBounds.union(routeScratch);
    }
    if (!routeBounds.isEmpty()) this.sceneBounds.union(routeBounds);
    const result = this.lessonCamera.fit(this.sceneBounds, this.viewportInput(), {
      direction: cameraDirection(presetId),
    });
    this.labelSafeRect = result.safeViewport.safeRect;
    this.controls.target.copy(result.frame.viewCenter);
    this.controls.update();
  }

  private focusHandle(handle: ReturnType<SceneRegistry['get']>): void {
    if (!handle) return;
    const target = handle.getAnchor('center');
    const safeCenter = new SafeViewport(this.viewportInput()).centerNdc;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    const halfWidth = (this.camera.right - this.camera.left) / (2 * this.camera.zoom);
    const halfHeight = (this.camera.top - this.camera.bottom) / (2 * this.camera.zoom);
    const viewCenter = target
      .clone()
      .addScaledVector(right, -safeCenter.x * halfWidth)
      .addScaledVector(up, -safeCenter.y * halfHeight);
    const offset = this.camera.position.clone().sub(this.controls.target);
    this.controls.target.copy(viewCenter);
    this.camera.position.copy(viewCenter).add(offset);
    this.camera.lookAt(viewCenter);
    this.controls.update();
  }

  public setSafeInsets(insets: Partial<ViewportInsets>): void {
    this.safeInsets = insets;
    if (this.currentStep) this.frameScene();
    this.scheduler.markDirty();
  }

  public setLocale(locale: Locale): void {
    this.locale = locale;
    const step = this.currentStep;
    if (step) {
      this.labels.sync(this.registry, step.view, locale, this.activeRoutes);
      this.callouts.sync(step.view.callouts, locale);
    }
    this.scheduler.markDirty();
  }

  public setOnSelect(callback: (id?: EntityId | undefined) => void): void {
    this.onSelect = callback;
  }

  public applyStep(step: CompiledStep): void {
    this.animations.cancel();
    this.cleanupPendingExits();
    this.animations.forgetPlayback(`${step.lessonId}:${step.stepId}`);
    const previousStep = this.currentStep;
    const previousLayout = this.layout;
    this.currentStep = step;
    this.stage.setViewMode(step.view.view);
    const hasExitCue = step.transition.cues.some((cue) => cue.type === 'entity-exit');
    if (hasExitCue && step.worldDiff.removedEntities.length > 0) {
      const beforeView = exitProjection(step);
      const beforeLayout = calculateLayout({
        world: step.beforeWorld,
        view: beforeView,
        ...(this.layout ? { previous: this.layout } : {}),
      });
      this.registry.sync(step.beforeWorld, beforeView);
      this.registry.applyLayout(beforeLayout);
      for (const entity of step.worldDiff.removedEntities) this.pendingExitIds.add(entity.id);
    }
    const nextLayout = calculateLayout({
      world: step.world,
      view: step.view,
      ...(this.layout ? { previous: this.layout } : {}),
    });

    // Drop stale relation resources while their endpoint handles still exist, then sync entities.
    this.relations.sync(step.world, step.view, nextLayout, this.registry);
    this.registry.sync(step.world, step.view, this.pendingExitIds);
    this.registry.applyLayout(nextLayout);
    this.relations.sync(step.world, step.view, nextLayout, this.registry);
    this.activeRoutes.syncActiveRoutes(step.view.activeRoutes);
    const layoutCue = step.transition.cues.find((cue) => cue.type === 'layout-transition');
    const isSequentialStep =
      previousStep?.lessonId === step.lessonId && previousStep.index + 1 === step.index;
    this.pendingLayoutTransition =
      isSequentialStep && previousLayout && layoutCue
        ? captureLayoutTransition(
            previousLayout,
            nextLayout,
            layoutCue.entityIds ?? [...nextLayout.positions.keys()],
            (entityId) => this.registry.get(entityId),
          )
        : undefined;
    this.pendingLayoutTransition?.apply(0);
    this.layout = nextLayout;
    this.labels.sync(this.registry, step.view, this.locale, this.activeRoutes);
    this.callouts.sync(step.view.callouts, this.locale);
    this.frameScene(step.view.cameraPresetId);
    this.registry.setSelected(this.selected);
    const selectedHandle = this.selected ? this.registry.get(this.selected) : undefined;
    if (selectedHandle) this.focusHandle(selectedHandle);
    this.scheduler.markDirty();
  }

  private prepareExitHandles(step: CompiledStep): void {
    const hasExitCue = step.transition.cues.some((cue) => cue.type === 'entity-exit');
    if (!hasExitCue || step.worldDiff.removedEntities.length === 0 || this.pendingExitIds.size > 0)
      return;

    const beforeView = exitProjection(step);
    const beforeLayout = calculateLayout({
      world: step.beforeWorld,
      view: beforeView,
      ...(this.layout ? { previous: this.layout } : {}),
    });
    this.registry.sync(step.beforeWorld, beforeView);
    this.registry.applyLayout(beforeLayout);

    for (const entity of step.worldDiff.removedEntities) this.pendingExitIds.add(entity.id);
    const finalLayout =
      this.layout ??
      calculateLayout({ world: step.world, view: step.view, previous: beforeLayout });
    this.relations.sync(step.world, step.view, finalLayout, this.registry);
    this.registry.sync(step.world, step.view, this.pendingExitIds);
    this.registry.applyLayout(finalLayout);
    this.relations.sync(step.world, step.view, finalLayout, this.registry);
    this.activeRoutes.syncActiveRoutes(step.view.activeRoutes);
    this.labels.sync(this.registry, step.view, this.locale, this.activeRoutes);
    this.callouts.sync(step.view.callouts, this.locale);
  }

  public playTransition(request: PlaybackRequest, reducedMotion: boolean): void {
    const reducedMotionChanged = this.reducedMotion !== reducedMotion;
    this.reducedMotion = reducedMotion;
    this.activeRoutes.setReducedMotion(reducedMotion);
    const previousPlaybackId = this.animations.lastPlaybackId(request.stepKey);
    if (previousPlaybackId !== undefined && request.playbackId <= previousPlaybackId) {
      if (reducedMotionChanged && this.animations.activeCount > 0) {
        this.animations.finish();
        this.cleanupPendingExits();
        this.scheduler.removeReason('animations');
      }
      this.scheduler.markDirty();
      return;
    }
    this.animations.cancel();
    if (this.currentStep) this.prepareExitHandles(this.currentStep);
    const accepted = this.animations.play(request, reducedMotion);
    if (accepted && this.animations.activeCount > 0) this.scheduler.addReason('animations');
    this.scheduler.markDirty();
  }

  private cleanupPendingExits(): void {
    const ids = [...this.pendingExitIds].sort((left, right) => {
      const leftContainer = this.registry.get(left)?.entity.kind === 'Container' ? 0 : 1;
      const rightContainer = this.registry.get(right)?.entity.kind === 'Container' ? 0 : 1;
      return leftContainer - rightContainer || left.localeCompare(right);
    });
    for (const id of ids) this.registry.remove(id);
    this.pendingExitIds.clear();
    if (ids.length > 0 && !this.destroyed) this.scheduler.markDirty();
  }

  public setSelection(id?: EntityId | undefined): void {
    this.selected = id;
    this.registry.setSelected(id);
    const handle = id ? this.registry.get(id) : undefined;
    if (handle) this.focusHandle(handle);
    const step = this.currentStep;
    if (step) this.labels.sync(this.registry, step.view, this.locale, this.activeRoutes);
    this.scheduler.markDirty();
  }

  public resetCamera(): void {
    this.frameScene();
    this.scheduler.markDirty();
  }

  private readonly handleControlsChange = (): void => this.scheduler.markDirty();

  private readonly handlePointer = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects([...this.registry.raycastTargets()], true)[0];
    this.onSelect?.(this.registry.entityIdForObject(hit?.object));
  };

  private resize(): void {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.renderer.setSize(width, height, false);
    this.postProcessing.setSize(width, height, this.renderer.getPixelRatio());
    this.activeRoutes.setResolution(width, height, this.renderer.getPixelRatio());
    if (this.currentStep) this.frameScene();
    this.scheduler.markDirty();
  }

  private render(time: number): void {
    this.controls.update();
    const deltaSeconds =
      this.lastRenderTime > 0 ? Math.min(64, time - this.lastRenderTime) / 1000 : undefined;
    if (this.animations.activeCount > 0 && this.lastRenderTime > 0) {
      this.activeRoutes.advanceDash(Math.min(64, time - this.lastRenderTime) * 0.0012);
    }
    this.lastRenderTime = time;
    if (!this.animations.update(time)) this.scheduler.removeReason('animations');
    this.labels.update(
      this.registry,
      this.camera,
      this.host.clientWidth,
      this.host.clientHeight,
      this.labelSafeRect,
    );
    this.callouts.update(
      this.registry,
      this.camera,
      this.host.clientWidth,
      this.host.clientHeight,
      this.labelSafeRect,
    );
    this.postProcessing.render(deltaSeconds);
  }

  public getDiagnostics(): SceneDiagnostics {
    const routeDiagnostics = this.activeRoutes.diagnostics;
    return {
      entityHandles: this.registry.size,
      relationHandles: this.relations.size + routeDiagnostics.routeHandles,
      labels: this.labels.size,
      callouts: this.callouts.size,
      activeAnimations: this.animations.activeCount,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      drawCalls: this.renderer.info.render.calls,
      pooledTokens: this.animations.pooledCount + routeDiagnostics.pooledFlowTokens,
      retainedExitHandles: this.pendingExitIds.size,
      routeHandles: routeDiagnostics.routeHandles,
      arrowheads: routeDiagnostics.leasedArrowheads + routeDiagnostics.pooledArrowheads,
      flowTokens: routeDiagnostics.leasedFlowTokens + routeDiagnostics.pooledFlowTokens,
      routeMarkers: routeDiagnostics.leasedRouteMarkers + routeDiagnostics.pooledRouteMarkers,
      wideLineGeometries: routeDiagnostics.wideLineGeometries,
      wideLineMaterials: routeDiagnostics.wideLineMaterials,
      renderTargets: this.postProcessing.diagnostics.renderTargets,
      eventListeners: this.listenerTracker.size,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.animations.destroy();
    this.scheduler.destroy();
    this.cleanupPendingExits();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.listenerTracker.dispose();
    this.callouts.clear();
    this.labels.clear();
    this.activeRoutes.dispose();
    this.relations.clear();
    this.registry.clear();
    this.stage.dispose();
    this.environment.dispose();
    this.layers.dispose();
    this.postProcessing.dispose();
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
