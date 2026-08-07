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
import { CameraController } from './CameraController';
import { LabelManager } from './LabelManager';
import { calculateLayout, type LayoutResult } from './LayoutEngine';
import { RelationRegistry } from './RelationRegistry';
import { RenderScheduler } from './RenderScheduler';
import { SceneRegistry } from './SceneRegistry';
import { VisualFactoryRegistry } from './VisualFactoryRegistry';

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
}

const exitProjection = (step: CompiledStep): ViewProjection => {
  const exitTargets = new Set(
    step.transition.cues.flatMap((cue) => (cue.type === 'entity-exit' ? [cue.entityId] : [])),
  );
  const entityStates: Record<EntityId, EntityViewState> = {};
  for (const entity of Object.values(step.beforeWorld.entities)) {
    const authored = step.view.entityStates[entity.id];
    entityStates[entity.id] = authored ?? {
      visible: true,
      emphasis: exitTargets.has(entity.id) ? 'focused' : 'normal',
      labelMode: exitTargets.has(entity.id) ? 'full' : 'short',
    };
  }
  const relationStates: Record<RelationId, RelationViewState> = {};
  for (const relation of Object.values(step.beforeWorld.relations)) {
    relationStates[relation.id] = step.view.relationStates[relation.id] ?? {
      visible: true,
      emphasis: 'normal',
    };
  }
  return {
    view: step.view.view,
    cameraPresetId: step.view.cameraPresetId,
    entityStates,
    relationStates,
    callouts: [],
  };
};

export class SceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly registry = new SceneRegistry(this.scene, new VisualFactoryRegistry(), {
    allowGeneric: false,
  });
  private readonly relations = new RelationRegistry(this.scene);
  private readonly controls = new OrbitControls(this.camera, this.renderer.domElement);
  private readonly cameraController = new CameraController(this.camera, this.controls);
  private readonly labels: LabelManager;
  private readonly callouts: CalloutManager;
  private readonly scheduler = new RenderScheduler((time) => this.render(time));
  private readonly animations: AnimationCoordinator;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly environmentResources: Array<{ dispose(): void }> = [];
  private readonly pendingExitIds = new Set<EntityId>();
  private locale: Locale = 'en';
  private onSelect: ((id?: EntityId | undefined) => void) | undefined;
  private selected: EntityId | undefined;
  private currentStep: CompiledStep | undefined;
  private layout: LayoutResult | undefined;
  private destroyed = false;

  public constructor(private readonly host: HTMLElement) {
    this.scene.background = new THREE.Color(0x08111f);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive Kubernetes 3D scene');
    this.host.append(this.renderer.domElement);
    this.labels = new LabelManager(host);
    this.callouts = new CalloutManager(host);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 34;
    this.controls.addEventListener('change', this.handleControlsChange);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointer);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.animations = new AnimationCoordinator({
      scene: this.scene,
      getEntity: (entityId) => this.registry.get(entityId),
      getRelation: (relationId) => this.relations.get(relationId),
      now: () => performance.now(),
      markDirty: () => this.scheduler.markDirty(),
      focusCamera: (event) => {
        if (event.phase !== 'start') return;
        const handle = this.registry.get(event.cue.entityId);
        if (handle) this.cameraController.focus(handle);
      },
      counterChange: (event) => {
        const handle = this.registry.get(event.cue.entityId);
        if (!handle) return;
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
    this.addEnvironment();
    this.cameraController.applyPreset('overview');
    this.resize();
  }

  private addEnvironment(): void {
    this.scene.add(new THREE.HemisphereLight(0xb9ddff, 0x08111f, 1.65));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(8, 14, 10);
    key.castShadow = true;
    this.scene.add(key);
    const grid = new THREE.GridHelper(28, 28, 0x29415e, 0x172a42);
    grid.position.y = -1;
    this.scene.add(grid);
    this.environmentResources.push(grid.geometry);
    if (Array.isArray(grid.material)) this.environmentResources.push(...grid.material);
    else this.environmentResources.push(grid.material);
  }

  public setLocale(locale: Locale): void {
    this.locale = locale;
    const step = this.currentStep;
    if (step) {
      this.labels.sync(this.registry, step.view, locale);
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
    this.currentStep = step;
    const nextLayout = calculateLayout({
      world: step.world,
      view: step.view,
      ...(this.layout ? { previous: this.layout } : {}),
    });

    // Drop stale relation resources while their endpoint handles still exist, then sync entities.
    this.relations.sync(step.world, step.view, nextLayout, this.registry);
    this.registry.sync(step.world, step.view);
    this.registry.applyLayout(nextLayout);
    this.relations.sync(step.world, step.view, nextLayout, this.registry);
    this.layout = nextLayout;
    this.labels.sync(this.registry, step.view, this.locale);
    this.callouts.sync(step.view.callouts, this.locale);
    this.cameraController.applyPreset(step.view.cameraPresetId);
    this.registry.setSelected(this.selected);
    const selectedHandle = this.selected ? this.registry.get(this.selected) : undefined;
    if (selectedHandle) this.cameraController.focus(selectedHandle);
    this.scheduler.markDirty();
  }

  private prepareExitHandles(step: CompiledStep): void {
    const hasExitCue = step.transition.cues.some((cue) => cue.type === 'entity-exit');
    if (!hasExitCue || step.worldDiff.removedEntities.length === 0) return;

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
    this.labels.sync(this.registry, step.view, this.locale);
    this.callouts.sync(step.view.callouts, this.locale);
  }

  public playTransition(request: PlaybackRequest, reducedMotion: boolean): void {
    const previousPlaybackId = this.animations.lastPlaybackId(request.stepKey);
    if (previousPlaybackId !== undefined && request.playbackId <= previousPlaybackId) return;
    this.animations.cancel();
    this.cleanupPendingExits();
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
    if (handle) this.cameraController.focus(handle);
    const step = this.currentStep;
    if (step) this.labels.sync(this.registry, step.view, this.locale);
    this.scheduler.markDirty();
  }

  public resetCamera(): void {
    this.cameraController.applyPreset(this.currentStep?.view.cameraPresetId ?? 'overview');
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
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.scheduler.markDirty();
  }

  private render(time: number): void {
    this.controls.update();
    if (!this.animations.update(time)) this.scheduler.removeReason('animations');
    this.labels.update(this.registry, this.camera, this.host.clientWidth, this.host.clientHeight);
    this.callouts.update(this.registry, this.camera, this.host.clientWidth, this.host.clientHeight);
    this.renderer.render(this.scene, this.camera);
  }

  public getDiagnostics(): SceneDiagnostics {
    return {
      entityHandles: this.registry.size,
      relationHandles: this.relations.size,
      labels: this.labels.size,
      callouts: this.callouts.size,
      activeAnimations: this.animations.activeCount,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      drawCalls: this.renderer.info.render.calls,
      pooledTokens: this.animations.pooledCount,
      retainedExitHandles: this.pendingExitIds.size,
    };
  }

  public destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scheduler.destroy();
    this.animations.destroy();
    this.cleanupPendingExits();
    this.resizeObserver.disconnect();
    this.controls.removeEventListener('change', this.handleControlsChange);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointer);
    this.callouts.clear();
    this.labels.clear();
    this.relations.clear();
    this.registry.clear();
    for (const resource of this.environmentResources) resource.dispose();
    this.environmentResources.length = 0;
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
    this.scene.clear();
  }
}
