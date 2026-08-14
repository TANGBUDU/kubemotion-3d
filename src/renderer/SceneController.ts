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
import type { CameraFrameResult } from './camera/CameraFramer';
import { applyCameraPose, cameraPose, CameraTransition } from './camera/CameraTransition';
import { OrthographicLessonCamera } from './camera/OrthographicLessonCamera';
import { PerspectiveExploreCamera } from './camera/PerspectiveExploreCamera';
import { SafeViewport, type ViewportInsets, type ViewportRect } from './camera/SafeViewport';
import { calculateTeachingBounds, targetMaxFill } from './camera/TeachingBounds';
import { EventListenerTracker } from './diagnostics/EventListenerTracker';
import { LabelManager, type LabelSafeRect } from './LabelManager';
import { calculateLayout, type LayoutResult, type Position } from './LayoutEngine';
import { PostProcessingPipeline } from './postprocessing/PostProcessingPipeline';
import { RelationRegistry } from './RelationRegistry';
import { RelationLayer } from './relations/RelationLayer';
import { RoutePlanner } from './relations/RoutePlanner';
import { RouteObstacleMap } from './relations/RouteObstacleMap';
import { RouteSceneAdapter } from './relations/RouteSceneAdapter';
import { RenderScheduler } from './RenderScheduler';
import { SceneEnvironment } from './scene/SceneEnvironment';
import { SceneLayers } from './scene/SceneLayers';
import {
  diagnoseRuntimeLayout,
  type RuntimeLayoutDiagnostics,
} from './scene/RuntimeHierarchyDiagnostics';
import { SceneStage } from './scene/SceneStage';
import { SceneRegistry } from './SceneRegistry';
import { createEffectiveScenePlan } from './scene-grammar';
import { VisualFactoryRegistry } from './VisualFactoryRegistry';
import { ReplicaSetVisualHandle } from './VisualHandles';

export interface SceneDiagnostics {
  readonly cameraMode: SceneCameraMode;
  readonly safeViewportExclusions: number;
  readonly safeRectX: number;
  readonly safeRectY: number;
  readonly safeRectWidth: number;
  readonly safeRectHeight: number;
  readonly activeCameraTransitions: number;
  readonly subjectScreenWidthRatio: number;
  readonly subjectScreenHeightRatio: number;
  readonly routesOutsideSafeRect: number;
  readonly arrowheadsOutsideSafeRect: number;
  readonly routeMarkersOutsideSafeRect: number;
  readonly routeObstacleIntersections: number;
  readonly routeEndpointDriftCount: number;
  readonly activeRouteWidthsBelowMinimum: number;
  readonly visibleRoutesWithoutArrowheads: number;
  readonly strongXRouteReversals: number;
  readonly flowTokensOffRoute: number;
  readonly maximumFlowTokenRouteDistance: number;
  readonly routeReplanFailures: number;
  readonly focusedEntitiesOutsideSafeRect: number;
  readonly sceneBoundsOutsideContentRect: number;
  readonly framingUsedStageFallback: number;
  readonly occupiedGuideBoundsEmpty: number;
  readonly entityHandles: number;
  readonly relationHandles: number;
  readonly labels: number;
  readonly callouts: number;
  readonly layoutGuides: number;
  readonly semanticIslands: number;
  readonly foundationMeshes: number;
  readonly localAlignmentMarks: number;
  readonly dominantGridMarks: number;
  readonly visibleNodes: number;
  readonly nodeBays: number;
  readonly scheduledPods: number;
  readonly scheduledPodsOutsideBays: number;
  readonly duplicateBayAssignments: number;
  readonly podPairOverlaps: number;
  readonly podSystemModuleOverlaps: number;
  readonly pendingPods: number;
  readonly pendingPodsInsideNodes: number;
  readonly nodeHandles: number;
  readonly podHandles: number;
  readonly mountedKubelets: number;
  readonly mountedContainerRuntimes: number;
  readonly orphanKubelets: number;
  readonly orphanContainerRuntimes: number;
  readonly containedContainers: number;
  readonly containersOutsidePods: number;
  readonly activeAnimations: number;
  readonly geometries: number;
  readonly textures: number;
  readonly programs: number;
  readonly drawCalls: number;
  readonly pooledTokens: number;
  readonly retainedExitHandles: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly pooledArrowheads: number;
  readonly flowTokens: number;
  readonly pooledFlowTokens: number;
  readonly routeMarkers: number;
  readonly pooledRouteMarkers: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
  readonly renderTargets: number;
  readonly eventListeners: number;
}

export interface SceneControllerOptions {
  readonly safeInsets?: Partial<ViewportInsets>;
  readonly safeExclusions?: readonly ViewportRect[];
  readonly allowPerspective?: boolean;
  readonly cameraMode?: SceneCameraMode;
}

export type SceneCameraMode = 'orthographic' | 'perspective';

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
    case 'overview':
      return new THREE.Vector3(0.25, 1.65, 0.8);
    case 'logical':
      return new THREE.Vector3(0, 1.75, 0.75);
    case 'control-flow':
      return new THREE.Vector3(0, 1.9, 0.72);
    case 'traffic':
      return new THREE.Vector3(0, 1.75, 0.68);
    case 'placement':
      return new THREE.Vector3(0.65, 1.75, 0.85);
    default:
      return new THREE.Vector3(0.35, 1.7, 0.8);
  }
};

const projectedBounds = (
  bounds: THREE.Box3,
  camera: THREE.Camera,
  width: number,
  height: number,
): ViewportRect | undefined => {
  if (bounds.isEmpty() || width <= 0 || height <= 0) return undefined;
  const { min, max } = bounds;
  const corners = [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ].map((corner) => corner.project(camera));
  if (corners.some((corner) => !Number.isFinite(corner.x) || !Number.isFinite(corner.y))) {
    return undefined;
  }
  const xs = corners.map((corner) => (corner.x * 0.5 + 0.5) * width);
  const ys = corners.map((corner) => (-corner.y * 0.5 + 0.5) * height);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
};

const projectedRectInside = (
  candidate: ViewportRect | undefined,
  safe: ViewportRect | undefined,
  strokePadding = 0,
): boolean =>
  Boolean(
    candidate &&
    safe &&
    safe.width > 0 &&
    safe.height > 0 &&
    candidate.x - strokePadding >= safe.x &&
    candidate.y - strokePadding >= safe.y &&
    candidate.x + candidate.width + strokePadding <= safe.x + safe.width &&
    candidate.y + candidate.height + strokePadding <= safe.y + safe.height,
  );

const constrainPerspectiveBounds = (
  camera: THREE.PerspectiveCamera,
  bounds: THREE.Box3,
  viewCenter: THREE.Vector3,
  contentRect: ViewportRect,
  viewportWidth: number,
  viewportHeight: number,
  strokePadding = 3,
): void => {
  if (contentRect.width <= strokePadding * 2 || contentRect.height <= strokePadding * 2) return;
  const desiredCenterX = contentRect.x + contentRect.width / 2;
  const desiredCenterY = contentRect.y + contentRect.height / 2;
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const translation = new THREE.Vector3();

  // Perspective AABBs are not guaranteed to remain centred while the camera moves because the
  // nearest corners grow faster than the farthest ones. Re-project after every correction instead
  // of assuming one linear width/height ratio is sufficient.
  for (let iteration = 0; iteration < 6; iteration += 1) {
    const rect = projectedBounds(bounds, camera, viewportWidth, viewportHeight);
    if (!rect || projectedRectInside(rect, contentRect, strokePadding)) return;

    const distance = Math.max(0.1, camera.position.distanceTo(viewCenter));
    const verticalSpan =
      (2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / camera.zoom;
    const horizontalSpan = verticalSpan * camera.aspect;
    right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const deltaX = desiredCenterX - (rect.x + rect.width / 2);
    const deltaY = desiredCenterY - (rect.y + rect.height / 2);
    translation
      .copy(right)
      .multiplyScalar((-deltaX / viewportWidth) * horizontalSpan)
      .addScaledVector(up, (deltaY / viewportHeight) * verticalSpan);
    camera.position.add(translation);
    viewCenter.add(translation);
    camera.lookAt(viewCenter);
    camera.updateMatrixWorld(true);

    const centredRect = projectedBounds(bounds, camera, viewportWidth, viewportHeight);
    if (!centredRect) return;
    const overflow = Math.max(
      (centredRect.width + strokePadding * 2) / contentRect.width,
      (centredRect.height + strokePadding * 2) / contentRect.height,
    );
    if (overflow > 1) {
      const offset = camera.position
        .clone()
        .sub(viewCenter)
        .multiplyScalar(overflow * 1.01);
      camera.position.copy(viewCenter).add(offset);
      camera.lookAt(viewCenter);
      camera.updateMatrixWorld(true);
    }
  }
};

const maximumProjectedFill = (
  bounds: THREE.Box3,
  camera: THREE.Camera,
  safeRect: ViewportRect,
  viewportWidth: number,
  viewportHeight: number,
): number => {
  const rect = projectedBounds(bounds, camera, viewportWidth, viewportHeight);
  if (!rect || safeRect.width <= 0 || safeRect.height <= 0) return 0;
  return Math.max(rect.width / safeRect.width, rect.height / safeRect.height);
};

const applyOrthographicFill = (
  camera: THREE.OrthographicCamera,
  frame: CameraFrameResult,
  bounds: THREE.Box3,
  viewport: SafeViewport,
  viewportWidth: number,
  viewportHeight: number,
  targetFill: number,
): void => {
  const currentFill = maximumProjectedFill(
    bounds,
    camera,
    viewport.safeRect,
    viewportWidth,
    viewportHeight,
  );
  if (!Number.isFinite(currentFill) || currentFill <= 0) return;

  const scale = targetFill / currentFill;
  const halfWidth = (camera.right - camera.left) / (2 * scale * camera.zoom);
  const halfHeight = (camera.top - camera.bottom) / (2 * scale * camera.zoom);
  const directionOffset = camera.position.clone().sub(frame.viewCenter);
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const safeCenter = viewport.centerNdc;

  frame.viewCenter
    .copy(frame.target)
    .addScaledVector(right, -safeCenter.x * halfWidth)
    .addScaledVector(up, -safeCenter.y * halfHeight);
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.zoom = 1;
  camera.position.copy(frame.viewCenter).add(directionOffset);
  camera.lookAt(frame.viewCenter);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

const applyPerspectiveFill = (
  camera: THREE.PerspectiveCamera,
  frame: CameraFrameResult,
  bounds: THREE.Box3,
  viewport: SafeViewport,
  viewportWidth: number,
  viewportHeight: number,
  targetFill: number,
): void => {
  for (let iteration = 0; iteration < 4; iteration += 1) {
    const currentFill = maximumProjectedFill(
      bounds,
      camera,
      viewport.safeRect,
      viewportWidth,
      viewportHeight,
    );
    if (!Number.isFinite(currentFill) || currentFill <= 0) return;
    const correction = targetFill / currentFill;
    if (Math.abs(1 - correction) <= 0.002) return;

    camera.zoom = THREE.MathUtils.clamp(camera.zoom * correction, 0.25, 8);
    camera.updateProjectionMatrix();
    const directionOffset = camera.position.clone().sub(frame.viewCenter);
    const distance = Math.max(0.1, directionOffset.length());
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    const halfHeight =
      (distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / camera.zoom;
    const halfWidth = halfHeight * camera.aspect;
    const safeCenter = viewport.centerNdc;
    frame.viewCenter
      .copy(frame.target)
      .addScaledVector(right, -safeCenter.x * halfWidth)
      .addScaledVector(up, -safeCenter.y * halfHeight);
    camera.position.copy(frame.viewCenter).add(directionOffset);
    camera.lookAt(frame.viewCenter);
    camera.updateMatrixWorld(true);
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
  private readonly exploreCamera = new PerspectiveExploreCamera();
  private camera: THREE.OrthographicCamera | THREE.PerspectiveCamera = this.lessonCamera.camera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly layers = new SceneLayers(this.scene);
  private readonly registry = new SceneRegistry(this.layers.entities, new VisualFactoryRegistry(), {
    allowGeneric: false,
  });
  private readonly relations = new RelationRegistry(this.layers.settledRelations);
  private readonly routeAdapter = new RouteSceneAdapter(this.registry);
  private readonly routeObstacleMap = new RouteObstacleMap(this.registry);
  private readonly activeRoutes = new RelationLayer(
    this.layers.activeRoutes,
    new RoutePlanner(this.routeAdapter, this.routeObstacleMap, {
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
  private readonly teachingEntityBounds = new THREE.Box3();
  private safeInsets: Partial<ViewportInsets>;
  private safeExclusions: readonly ViewportRect[];
  private readonly allowPerspective: boolean;
  private cameraMode: SceneCameraMode;
  private labelSafeRect: LabelSafeRect | undefined;
  private sceneContentRect: ViewportRect | undefined;
  private locale: Locale = 'en';
  private onSelect: ((id?: EntityId | undefined) => void) | undefined;
  private selected: EntityId | undefined;
  private currentStep: CompiledStep | undefined;
  private layout: LayoutResult | undefined;
  private pendingLayoutTransition: CapturedLayoutTransition | undefined;
  private cameraTransition: CameraTransition | undefined;
  private cameraTransitionStartedAt = 0;
  private reducedMotion = false;
  private ambientRouteFlow = false;
  private ambientRouteFlowTimer: number | undefined;
  private ambientRouteFlowProgress = 0;
  private ambientRouteFlowLastTime = 0;
  private lastRenderTime = 0;
  private framingUsedStageFallback = 1;
  private occupiedGuideBoundsEmpty = 1;
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
    this.safeExclusions = options.safeExclusions ?? [];
    this.allowPerspective = options.allowPerspective ?? false;
    this.cameraMode =
      this.allowPerspective && options.cameraMode === 'perspective'
        ? 'perspective'
        : 'orthographic';
    this.camera =
      this.cameraMode === 'perspective' ? this.exploreCamera.camera : this.lessonCamera.camera;
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
    this.controls.minDistance = 7;
    this.controls.maxDistance = 120;
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
      exclusions: this.safeExclusions,
      safeFrameRatio: 0.06,
    } as const;
  }

  private frameScene(
    presetId = this.currentStep?.view.cameraPresetId ?? 'overview',
    animate = false,
  ): void {
    this.cancelCameraTransition(false);
    const viewMode = this.currentStep?.view.view ?? 'overview';
    const focusedEntityIds = this.currentStep
      ? Object.entries(this.currentStep.view.entityStates).flatMap(([entityId, state]) =>
          state.visible && state.emphasis === 'focused' ? [entityId] : [],
        )
      : [];
    const teachingBounds = calculateTeachingBounds({
      view: viewMode,
      entityHandles: this.registry.values(),
      occupiedGuideBounds: this.registry.occupiedGuideBounds(),
      routeRoot: this.activeRoutes.root,
      ...(this.selected ? { selectedEntityId: this.selected } : {}),
      focusedEntityIds,
      stageFallbackBounds: this.stage.getFramingBounds(new THREE.Box3()),
    });
    this.sceneBounds.copy(teachingBounds.primaryBounds);
    this.teachingEntityBounds.copy(teachingBounds.entityBounds);
    this.framingUsedStageFallback = teachingBounds.usedStageFallback ? 1 : 0;
    this.occupiedGuideBoundsEmpty = teachingBounds.occupiedGuideBounds.isEmpty() ? 1 : 0;
    const viewportInput = this.viewportInput();
    const requestedViewport = new SafeViewport(viewportInput);
    if (!requestedViewport.hasUsableArea) {
      this.labelSafeRect = { x: 0, y: 0, width: 0, height: 0 };
      this.sceneContentRect = { x: 0, y: 0, width: 0, height: 0 };
      this.scheduler.markDirty();
      return;
    }
    const frameOptions = { direction: cameraDirection(presetId) } as const;
    const baselinePose = cameraPose(this.lessonCamera.camera);
    const baselineTarget = this.controls.target.clone();
    // Keep both projections current. A later Explore toggle must never reveal a stale aspect,
    // frustum, or pre-resize safe frame.
    const orthographicResult = this.lessonCamera.fit(this.sceneBounds, viewportInput, frameOptions);
    const perspectiveResult = this.exploreCamera.fit(this.sceneBounds, viewportInput, frameOptions);
    const targetFill = targetMaxFill(viewMode, this.host.clientWidth);
    applyOrthographicFill(
      this.lessonCamera.camera,
      orthographicResult.frame,
      this.sceneBounds,
      orthographicResult.safeViewport,
      this.host.clientWidth,
      this.host.clientHeight,
      targetFill,
    );
    applyPerspectiveFill(
      this.exploreCamera.camera,
      perspectiveResult.frame,
      this.sceneBounds,
      perspectiveResult.safeViewport,
      this.host.clientWidth,
      this.host.clientHeight,
      targetFill,
    );
    constrainPerspectiveBounds(
      this.exploreCamera.camera,
      this.sceneBounds,
      perspectiveResult.frame.viewCenter,
      perspectiveResult.safeViewport.contentRect,
      this.host.clientWidth,
      this.host.clientHeight,
      3,
    );
    const result = this.cameraMode === 'perspective' ? perspectiveResult : orthographicResult;
    this.labelSafeRect = result.safeViewport.safeRect;
    this.sceneContentRect = result.safeViewport.contentRect;
    if (this.cameraMode === 'orthographic' && animate && !this.reducedMotion) {
      const destinationPose = cameraPose(this.lessonCamera.camera);
      const destinationTarget = orthographicResult.frame.viewCenter.clone();
      applyCameraPose(this.lessonCamera.camera, baselinePose);
      this.controls.target.copy(baselineTarget);
      this.cameraTransition = new CameraTransition(
        this.lessonCamera.camera,
        destinationPose,
        this.controls.target,
        destinationTarget,
      );
      this.cameraTransitionStartedAt = performance.now();
      this.controls.enabled = false;
      this.scheduler.addReason('camera-transition');
    } else {
      this.controls.target.copy(result.frame.viewCenter);
      this.controls.update();
    }
  }

  /** Drains OrbitControls' private damping deltas without allowing them to alter an authored pose. */
  private settleControlsDamping(): void {
    const position = this.camera.position.clone();
    const quaternion = this.camera.quaternion.clone();
    const target = this.controls.target.clone();
    const zoom = this.camera instanceof THREE.OrthographicCamera ? this.camera.zoom : undefined;
    const enabled = this.controls.enabled;
    const damping = this.controls.enableDamping;
    this.controls.enabled = true;
    this.controls.enableDamping = false;
    this.controls.update();
    this.camera.position.copy(position);
    this.camera.quaternion.copy(quaternion);
    if (zoom !== undefined && this.camera instanceof THREE.OrthographicCamera) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    this.controls.target.copy(target);
    this.camera.updateMatrixWorld(true);
    this.controls.update();
    this.controls.enableDamping = damping;
    this.controls.enabled = enabled;
  }

  private cancelCameraTransition(restoreBaseline: boolean): void {
    if (this.cameraTransition) {
      this.cameraTransition.cancel(restoreBaseline);
      this.cameraTransition = undefined;
      this.cameraTransitionStartedAt = 0;
    }
    this.controls.enabled = true;
    this.scheduler.removeReason('camera-transition');
    this.settleControlsDamping();
  }

  private finishCameraTransition(): void {
    if (!this.cameraTransition) return;
    this.cameraTransition.finish();
    this.cameraTransition = undefined;
    this.cameraTransitionStartedAt = 0;
    this.controls.enabled = true;
    this.settleControlsDamping();
    this.controls.update();
    this.scheduler.removeReason('camera-transition');
  }

  private updateCameraTransition(time: number): boolean {
    const transition = this.cameraTransition;
    if (!transition) return false;
    const progress = (time - this.cameraTransitionStartedAt) / 360;
    if (transition.update(progress)) return true;
    this.cameraTransition = undefined;
    this.cameraTransitionStartedAt = 0;
    this.controls.enabled = true;
    this.settleControlsDamping();
    this.controls.update();
    this.scheduler.removeReason('camera-transition');
    return false;
  }

  private focusHandle(handle: ReturnType<SceneRegistry['get']>): void {
    if (!handle) return;
    this.cancelCameraTransition(false);
    const target = handle.getAnchor('center');
    const safeCenter = new SafeViewport(this.viewportInput()).centerNdc;
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    const distance = this.camera.position.distanceTo(this.controls.target);
    const halfHeight =
      this.camera instanceof THREE.OrthographicCamera
        ? (this.camera.top - this.camera.bottom) / (2 * this.camera.zoom)
        : distance * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfWidth =
      this.camera instanceof THREE.OrthographicCamera
        ? (this.camera.right - this.camera.left) / (2 * this.camera.zoom)
        : halfHeight * this.camera.aspect;
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

  public setSafeInsets(
    insets: Partial<ViewportInsets>,
    exclusions: readonly ViewportRect[] = this.safeExclusions,
  ): void {
    this.safeInsets = insets;
    this.safeExclusions = exclusions.map((rect) => ({ ...rect }));
    if (this.currentStep) this.frameScene();
    this.scheduler.markDirty();
  }

  public setCameraMode(mode: SceneCameraMode): void {
    const nextMode = this.allowPerspective ? mode : 'orthographic';
    if (nextMode === this.cameraMode) return;
    this.cancelCameraTransition(false);
    this.cameraMode = nextMode;
    this.camera = nextMode === 'perspective' ? this.exploreCamera.camera : this.lessonCamera.camera;
    this.controls.object = this.camera;
    this.postProcessing.setCamera(this.camera);
    this.frameScene();
    const selectedHandle = this.selected ? this.registry.get(this.selected) : undefined;
    if (selectedHandle) this.focusHandle(selectedHandle);
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

  private startAmbientRouteFlowTimer(): void {
    if (this.ambientRouteFlowTimer !== undefined || this.destroyed || this.reducedMotion) return;
    this.ambientRouteFlowLastTime = performance.now();
    this.ambientRouteFlowTimer = window.setInterval(() => {
      if (
        this.destroyed ||
        !this.ambientRouteFlow ||
        this.reducedMotion ||
        this.animations.activeCount > 0 ||
        this.activeRoutes.size === 0
      ) {
        this.ambientRouteFlowLastTime = performance.now();
        return;
      }
      const now = performance.now();
      const elapsed = Math.min(120, Math.max(0, now - this.ambientRouteFlowLastTime));
      this.ambientRouteFlowLastTime = now;
      this.ambientRouteFlowProgress = (this.ambientRouteFlowProgress + elapsed * 0.00019) % 1;
      this.activeRoutes.advanceDash(elapsed * 0.00078);
      this.activeRoutes.setLoopFlowProgress(this.ambientRouteFlowProgress);
      this.scheduler.markDirty();
    }, 42);
  }

  private stopAmbientRouteFlowTimer(): void {
    if (this.ambientRouteFlowTimer === undefined) return;
    window.clearInterval(this.ambientRouteFlowTimer);
    this.ambientRouteFlowTimer = undefined;
  }

  public setAmbientRouteFlow(enabled: boolean): void {
    if (this.ambientRouteFlow === enabled) {
      if (enabled && !this.reducedMotion) this.startAmbientRouteFlowTimer();
      return;
    }
    this.ambientRouteFlow = enabled;
    if (enabled && !this.reducedMotion) this.startAmbientRouteFlowTimer();
    else this.stopAmbientRouteFlowTimer();
    this.scheduler.markDirty();
  }

  public setOnSelect(callback: (id?: EntityId | undefined) => void): void {
    this.onSelect = callback;
  }

  public applyStep(step: CompiledStep): void {
    this.animations.cancel();
    this.cleanupPendingExits();
    const previousStep = this.currentStep;
    const sameAuthoredStep =
      previousStep?.lessonId === step.lessonId && previousStep.stepId === step.stepId;
    if (!sameAuthoredStep) this.animations.forgetPlayback(`${step.lessonId}:${step.stepId}`);
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
    if (this.pendingLayoutTransition) this.resyncActiveRouteGeometry(false);
    this.layout = nextLayout;
    this.labels.sync(this.registry, step.view, this.locale, this.activeRoutes);
    this.callouts.sync(step.view.callouts, this.locale);
    this.frameScene(step.view.cameraPresetId, previousStep !== undefined);
    this.registry.setSelected(this.selected);
    const selectedHandle = this.selected ? this.registry.get(this.selected) : undefined;
    if (selectedHandle) this.focusHandle(selectedHandle);
    this.scheduler.markDirty();
  }

  /** Keep semantic route endpoints attached while a Pod or another participant changes layout. */
  private resyncActiveRouteGeometry(strict = true): boolean {
    const step = this.currentStep;
    if (!step) return true;
    try {
      this.activeRoutes.syncActiveRoutes(step.view.activeRoutes);
      this.labels.sync(this.registry, step.view, this.locale, this.activeRoutes);
      delete this.activeRoutes.root.userData.replanError;
      return true;
    } catch (error: unknown) {
      this.activeRoutes.root.userData.replanError =
        error instanceof Error ? error.message : String(error);
      if (strict) throw error;
      return false;
    }
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

  public setReducedMotion(reducedMotion: boolean): void {
    const reducedMotionChanged = this.reducedMotion !== reducedMotion;
    this.reducedMotion = reducedMotion;
    this.activeRoutes.setReducedMotion(reducedMotion);
    if (reducedMotion) this.stopAmbientRouteFlowTimer();
    else if (this.ambientRouteFlow) this.startAmbientRouteFlowTimer();
    if (reducedMotion && this.cameraTransition) this.finishCameraTransition();
    if (reducedMotion && reducedMotionChanged && this.animations.activeCount > 0) {
      // SceneViewport applies this prop before it replays the same playback command. Settle the
      // old normal-motion context here, where the state change is still observable, so effect
      // ordering cannot leave layout/entity cues running after tokens have been removed.
      this.animations.finish();
      this.cleanupPendingExits();
      this.scheduler.removeReason('animations');
      if (this.activeRoutes.size > 0) this.resyncActiveRouteGeometry();
    }
    if (reducedMotionChanged) this.scheduler.markDirty();
  }

  public playTransition(request: PlaybackRequest, reducedMotion: boolean): void {
    this.setReducedMotion(reducedMotion);
    const previousPlaybackId = this.animations.lastPlaybackId(request.stepKey);
    if (previousPlaybackId !== undefined && request.playbackId <= previousPlaybackId) {
      // React Strict Mode can apply the same reduced-motion step twice. applyStep() may
      // reconstruct its retained exit handles before this duplicate playback is rejected.
      if (reducedMotion && this.pendingExitIds.size > 0) this.cleanupPendingExits();
      this.scheduler.markDirty();
      return;
    }
    this.animations.cancel();
    if (this.currentStep) this.prepareExitHandles(this.currentStep);
    const accepted = this.animations.play(request, reducedMotion);
    if (
      accepted &&
      reducedMotion &&
      this.animations.activeCount === 0 &&
      this.pendingExitIds.size > 0
    ) {
      // Reduced-motion playback settles synchronously. Remove any retained exit handles
      // even when an authored exit cue resolves without a live visual handler.
      this.cleanupPendingExits();
    }
    if (accepted && this.animations.activeCount > 0) {
      this.scheduler.addReason('animations');
    } else if (accepted && this.activeRoutes.size > 0) {
      // Reduced-motion playback finishes synchronously, before the next render can observe an
      // active animation. Re-plan once here so an instant layout transition cannot leave the
      // persistent route attached to the authored "before" anchors.
      this.resyncActiveRouteGeometry();
    }
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
    const cameraTransitioning = this.updateCameraTransition(time);
    if (!cameraTransitioning) this.controls.update();
    const deltaSeconds =
      this.lastRenderTime > 0 ? Math.min(64, time - this.lastRenderTime) / 1000 : undefined;
    if (this.animations.activeCount > 0 && this.lastRenderTime > 0) {
      this.activeRoutes.advanceDash(Math.min(64, time - this.lastRenderTime) * 0.0012);
    }
    this.lastRenderTime = time;
    const hadActiveAnimations = this.animations.activeCount > 0;
    const animationsRemainActive = this.animations.update(time);
    if (hadActiveAnimations && this.activeRoutes.size > 0) {
      this.resyncActiveRouteGeometry(!animationsRemainActive);
    }
    if (!animationsRemainActive) this.scheduler.removeReason('animations');
    const calloutRects = this.callouts.update(
      this.registry,
      this.camera,
      this.host.clientWidth,
      this.host.clientHeight,
      this.labelSafeRect,
    );
    this.labels.update(
      this.registry,
      this.camera,
      this.host.clientWidth,
      this.host.clientHeight,
      this.labelSafeRect,
      calloutRects,
    );
    this.postProcessing.render(deltaSeconds);
  }

  public getDiagnostics(): SceneDiagnostics {
    const routeDiagnostics = this.activeRoutes.diagnostics;
    const stageDiagnostics = this.stage.diagnostics();
    const runtimeHierarchyDiagnostics = this.registry.runtimeHierarchyDiagnostics;
    const runtimeLayoutDiagnostics: RuntimeLayoutDiagnostics =
      this.currentStep && this.layout
        ? diagnoseRuntimeLayout(
            this.currentStep.world,
            this.currentStep.view,
            this.layout,
            (entityId) => this.registry.worldBoundsFor(entityId),
          )
        : {
            visibleNodes: 0,
            nodeBays: 0,
            scheduledPods: 0,
            scheduledPodsOutsideBays: 0,
            duplicateBayAssignments: 0,
            podPairOverlaps: 0,
            podSystemModuleOverlaps: 0,
            pendingPods: 0,
            pendingPodsInsideNodes: 0,
          };
    const viewportWidth = Math.max(1, this.host.clientWidth);
    const viewportHeight = Math.max(1, this.host.clientHeight);
    const subjectBounds = this.teachingEntityBounds;
    const subjectRect = projectedBounds(subjectBounds, this.camera, viewportWidth, viewportHeight);
    const safeRect = this.labelSafeRect;
    const sceneRect = projectedBounds(this.sceneBounds, this.camera, viewportWidth, viewportHeight);
    const contentRect = this.sceneContentRect;
    const routeScratch = new THREE.Box3();
    const routesOutsideSafeRect = this.activeRoutes.root.children.filter((routeRoot) => {
      if (!routeRoot.visible) return false;
      routeScratch.setFromObject(routeRoot, true);
      return !projectedRectInside(
        projectedBounds(routeScratch, this.camera, viewportWidth, viewportHeight),
        safeRect,
        4,
      );
    }).length;
    const countRouteArtifactsOutsideSafeRect = (roles: ReadonlySet<string>): number => {
      let outside = 0;
      const artifactBounds = new THREE.Box3();
      this.activeRoutes.root.traverseVisible((object) => {
        if (!roles.has(String(object.userData.role ?? ''))) return;
        artifactBounds.setFromObject(object, true);
        if (artifactBounds.isEmpty()) return;
        if (
          !projectedRectInside(
            projectedBounds(artifactBounds, this.camera, viewportWidth, viewportHeight),
            safeRect,
            2,
          )
        ) {
          outside += 1;
        }
      });
      return outside;
    };
    const arrowheadsOutsideSafeRect = countRouteArtifactsOutsideSafeRect(
      new Set(['route-arrowhead', 'route-chevron']),
    );
    const routeMarkersOutsideSafeRect = countRouteArtifactsOutsideSafeRect(
      new Set(['route-step-marker']),
    );
    const focusScratch = new THREE.Box3();
    const focusedEntitiesOutsideSafeRect = [...this.registry.values()].filter((handle) => {
      const state = this.currentStep?.view.entityStates[handle.entityId];
      if (
        !handle.root.visible ||
        handle.isDisposed ||
        (state?.emphasis !== 'focused' && handle.root.userData.selected !== true)
      ) {
        return false;
      }
      const bounds = handle.getWorldBounds
        ? handle.getWorldBounds(focusScratch)
        : focusScratch.setFromObject(handle.root, true);
      return !projectedRectInside(
        projectedBounds(bounds, this.camera, viewportWidth, viewportHeight),
        safeRect,
      );
    }).length;
    return {
      cameraMode: this.cameraMode,
      safeViewportExclusions: this.safeExclusions.length,
      safeRectX: this.labelSafeRect?.x ?? 0,
      safeRectY: this.labelSafeRect?.y ?? 0,
      safeRectWidth: this.labelSafeRect?.width ?? 0,
      safeRectHeight: this.labelSafeRect?.height ?? 0,
      activeCameraTransitions: this.cameraTransition ? 1 : 0,
      subjectScreenWidthRatio:
        subjectRect && safeRect && safeRect.width > 0 ? subjectRect.width / safeRect.width : 0,
      subjectScreenHeightRatio:
        subjectRect && safeRect && safeRect.height > 0 ? subjectRect.height / safeRect.height : 0,
      routesOutsideSafeRect,
      arrowheadsOutsideSafeRect,
      routeMarkersOutsideSafeRect,
      routeObstacleIntersections: routeDiagnostics.routeObstacleIntersections,
      routeEndpointDriftCount: routeDiagnostics.routeEndpointDriftCount,
      activeRouteWidthsBelowMinimum: routeDiagnostics.activeRouteWidthsBelowMinimum,
      visibleRoutesWithoutArrowheads: routeDiagnostics.visibleRoutesWithoutArrowheads,
      strongXRouteReversals: routeDiagnostics.strongXRouteReversals,
      flowTokensOffRoute: routeDiagnostics.flowTokensOffRoute,
      maximumFlowTokenRouteDistance: routeDiagnostics.maximumFlowTokenRouteDistance,
      routeReplanFailures: this.activeRoutes.root.userData.replanError ? 1 : 0,
      focusedEntitiesOutsideSafeRect,
      sceneBoundsOutsideContentRect:
        sceneRect && !projectedRectInside(sceneRect, contentRect, 3) ? 1 : 0,
      framingUsedStageFallback: this.framingUsedStageFallback,
      occupiedGuideBoundsEmpty: this.occupiedGuideBoundsEmpty,
      entityHandles: this.registry.size,
      relationHandles: this.relations.size + routeDiagnostics.routeHandles,
      labels: this.labels.size,
      callouts: this.callouts.size,
      layoutGuides: this.registry.guideCount,
      semanticIslands: this.registry.semanticIslandCount,
      foundationMeshes: stageDiagnostics.foundationMeshes,
      localAlignmentMarks: stageDiagnostics.localAlignmentMarks,
      dominantGridMarks: stageDiagnostics.dominantGridMarks,
      ...runtimeLayoutDiagnostics,
      ...runtimeHierarchyDiagnostics,
      activeAnimations: this.animations.activeCount,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      drawCalls: this.renderer.info.render.calls,
      pooledTokens: this.animations.pooledCount + routeDiagnostics.pooledFlowTokens,
      retainedExitHandles: this.pendingExitIds.size,
      routeHandles: routeDiagnostics.routeHandles,
      arrowheads: routeDiagnostics.leasedArrowheads,
      pooledArrowheads: routeDiagnostics.pooledArrowheads,
      flowTokens: routeDiagnostics.leasedFlowTokens,
      pooledFlowTokens: routeDiagnostics.pooledFlowTokens,
      routeMarkers: routeDiagnostics.leasedRouteMarkers,
      pooledRouteMarkers: routeDiagnostics.pooledRouteMarkers,
      wideLineGeometries: routeDiagnostics.wideLineGeometries,
      wideLineMaterials: routeDiagnostics.wideLineMaterials,
      renderTargets: this.postProcessing.diagnostics.renderTargets,
      eventListeners: this.listenerTracker.size,
    };
  }

  /** Serializable test bridge for asserting authored reading order without pixel sampling. */
  public getLayoutPositions(): Readonly<Record<EntityId, Position>> {
    return Object.fromEntries(this.layout?.positions ?? []) as Readonly<Record<EntityId, Position>>;
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.cancelCameraTransition(false);
    this.stopAmbientRouteFlowTimer();
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
