import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Locale } from '../domain/types';
import type { ClusterGraph, EntityId } from '../domain/types';
import type { SceneProjection, TransitionCue } from '../course/types';
import { AnimationCoordinator } from './AnimationCoordinator';
import { CameraController } from './CameraController';
import { GeometryCatalog, MaterialCatalog } from './catalogs';
import { LabelManager } from './LabelManager';
import { calculateLayout } from './LayoutEngine';
import { RenderScheduler } from './RenderScheduler';
import { SceneObjectFactory } from './SceneObjectFactory';
import { SceneRegistry } from './SceneRegistry';

export interface SceneDiagnostics {
  entities: number;
  labels: number;
  activeAnimations: number;
  geometries: number;
  textures: number;
  programs: number;
  drawCalls: number;
  pooledPackets: number;
}

export class SceneController {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly geometries = new GeometryCatalog();
  private readonly materials = new MaterialCatalog();
  private readonly factory = new SceneObjectFactory(this.geometries, this.materials);
  private readonly registry = new SceneRegistry(this.scene, this.factory);
  private readonly controls = new OrbitControls(this.camera, this.renderer.domElement);
  private readonly cameraController = new CameraController(this.camera, this.controls);
  private readonly labels: LabelManager;
  private readonly animations = new AnimationCoordinator(this.scene);
  private readonly scheduler = new RenderScheduler((time) => this.render(time));
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private graph?: ClusterGraph;
  private locale: Locale = 'en';
  private onSelect?: (id?: EntityId) => void;
  private selected: EntityId | undefined;
  private destroyed = false;

  constructor(private readonly host: HTMLElement) {
    this.scene.background = new THREE.Color(0x08111f);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive Kubernetes 3D scene');
    this.host.append(this.renderer.domElement);
    this.labels = new LabelManager(host);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 34;
    this.controls.addEventListener('change', this.handleControlsChange);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointer);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
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
  }

  setGraph(graph: ClusterGraph): void {
    this.graph = graph;
  }
  setLocale(locale: Locale): void {
    this.locale = locale;
    this.labels.sync(this.registry, locale);
    this.scheduler.markDirty();
  }
  setOnSelect(callback: (id?: EntityId) => void): void {
    this.onSelect = callback;
  }

  applyProjection(projection: SceneProjection): void {
    const graph = this.graph;
    if (!graph) return;
    this.animations.cancel();
    const layout = calculateLayout(graph, projection);
    for (const entity of graph.snapshot.entities) {
      const state = projection.entityStates[entity.id];
      if (!state) continue;
      const handle = this.registry.ensure(entity);
      handle.root.visible = state.visible && state.emphasis !== 'hidden';
      this.factory.update(handle, state.statusOverride ?? entity.status, state.emphasis);
      const position = layout.positions.get(entity.id);
      if (position) handle.root.position.set(...position);
    }
    this.updateRelations(projection);
    this.labels.sync(this.registry, this.locale);
    this.cameraController.applyPreset(projection.cameraPresetId);
    this.setSelection(this.selected);
    this.scheduler.markDirty();
  }

  private updateRelations(projection: SceneProjection): void {
    const old = this.scene.getObjectByName('relations');
    if (old) {
      old.traverse((child) => {
        if (child instanceof THREE.Line) child.geometry.dispose();
      });
      this.scene.remove(old);
    }
    const group = new THREE.Group();
    group.name = 'relations';
    for (const relation of this.graph?.snapshot.relations ?? []) {
      if (!projection.relationStates[relation.id]?.visible) continue;
      const from = this.registry.get(relation.from)?.root.position;
      const to = this.registry.get(relation.to)?.root.position;
      if (!from || !to) continue;
      const color =
        relation.semantic === 'control-observation'
          ? 0xb792ff
          : relation.semantic === 'storage'
            ? 0x62c998
            : 0x5eb6ff;
      const material = new THREE.LineDashedMaterial({
        color,
        dashSize: 0.25,
        gapSize: 0.15,
        transparent: true,
        opacity: 0.78,
      });
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]),
        material,
      );
      line.computeLineDistances();
      group.add(line);
    }
    this.scene.add(group);
  }

  playTransition(cues: readonly TransitionCue[], reducedMotion: boolean): void {
    this.animations.play(cues, this.registry, reducedMotion);
    if (this.animations.activeCount > 0) this.scheduler.addReason('animations');
    this.scheduler.markDirty();
  }
  setSelection(id?: EntityId): void {
    this.selected = id;
    for (const handle of this.registry.values())
      handle.selectionRing.visible = handle.entity.id === id;
    const handle = id ? this.registry.get(id) : undefined;
    if (handle) this.cameraController.focus(handle);
    this.scheduler.markDirty();
  }
  resetCamera(): void {
    this.cameraController.applyPreset('overview');
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
    const hit = this.raycaster.intersectObjects(
      [...this.registry.values()].map((handle) => handle.mesh),
    )[0];
    let object: THREE.Object3D | null = hit?.object ?? null;
    while (object && !object.userData.entityId) object = object.parent;
    this.onSelect?.(object?.userData.entityId as EntityId | undefined);
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
    this.renderer.render(this.scene, this.camera);
  }
  getDiagnostics(): SceneDiagnostics {
    return {
      entities: this.registry.size,
      labels: this.labels.size,
      activeAnimations: this.animations.activeCount,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures,
      programs: this.renderer.info.programs?.length ?? 0,
      drawCalls: this.renderer.info.render.calls,
      pooledPackets: this.animations.pooledCount,
    };
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scheduler.destroy();
    this.animations.destroy();
    this.resizeObserver.disconnect();
    this.controls.removeEventListener('change', this.handleControlsChange);
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('pointerup', this.handlePointer);
    this.labels.clear();
    this.registry.clear();
    this.geometries.dispose();
    this.materials.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
