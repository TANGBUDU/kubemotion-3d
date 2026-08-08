import * as THREE from 'three';
import type { RelationViewState, ViewProjection } from '../course/types';
import type { RelationId, RelationSemantic, WorldRelation, WorldSnapshot } from '../world/types';
import type { LayoutResult, Position, RelationRoute } from './LayoutEngine';
import type { SceneRegistry } from './SceneRegistry';
import type { AnchorKind } from './VisualHandles';

export interface RelationStyle {
  readonly color: number;
  readonly width: number;
  readonly dashed: boolean;
  readonly dashSize?: number;
  readonly gapSize?: number;
  readonly arrowhead: boolean;
  readonly opacity: number;
  readonly curve: 'straight' | 'arc' | 'orthogonal';
  readonly labelMode: 'none' | 'on-focus' | 'always';
}

const relationStyles: Readonly<Record<RelationSemantic, RelationStyle>> = Object.freeze({
  ownership: Object.freeze({
    color: 0xb792ff,
    width: 2.8,
    dashed: false,
    arrowhead: true,
    opacity: 0.88,
    curve: 'arc',
    labelMode: 'on-focus',
  }),
  scope: Object.freeze({
    color: 0x9fb3c8,
    width: 1.4,
    dashed: true,
    dashSize: 0.12,
    gapSize: 0.12,
    arrowhead: true,
    opacity: 0.46,
    curve: 'straight',
    labelMode: 'none',
  }),
  placement: Object.freeze({
    color: 0x5eb6ff,
    width: 2.2,
    dashed: true,
    dashSize: 0.42,
    gapSize: 0.17,
    arrowhead: true,
    opacity: 0.84,
    curve: 'orthogonal',
    labelMode: 'always',
  }),
  composition: Object.freeze({
    color: 0xd7e6f5,
    width: 1.8,
    dashed: true,
    dashSize: 0.08,
    gapSize: 0.07,
    arrowhead: true,
    opacity: 0.74,
    curve: 'straight',
    labelMode: 'on-focus',
  }),
  'control-observation': Object.freeze({
    color: 0xc29dff,
    width: 2.1,
    dashed: true,
    dashSize: 0.32,
    gapSize: 0.22,
    arrowhead: true,
    opacity: 0.78,
    curve: 'arc',
    labelMode: 'on-focus',
  }),
  selection: Object.freeze({
    color: 0x45d6d0,
    width: 1.8,
    dashed: true,
    dashSize: 0.22,
    gapSize: 0.1,
    arrowhead: true,
    opacity: 0.7,
    curve: 'arc',
    labelMode: 'on-focus',
  }),
  'endpoint-membership': Object.freeze({
    color: 0x68e0a5,
    width: 2.4,
    dashed: false,
    arrowhead: true,
    opacity: 0.86,
    curve: 'arc',
    labelMode: 'always',
  }),
  'data-flow': Object.freeze({
    color: 0x62c7ff,
    width: 3.2,
    dashed: false,
    arrowhead: true,
    opacity: 0.96,
    curve: 'straight',
    labelMode: 'always',
  }),
  'DNS-flow': Object.freeze({
    color: 0x45d6d0,
    width: 2.6,
    dashed: true,
    dashSize: 0.5,
    gapSize: 0.12,
    arrowhead: true,
    opacity: 0.92,
    curve: 'straight',
    labelMode: 'always',
  }),
  storage: Object.freeze({
    color: 0x62c998,
    width: 2.6,
    dashed: false,
    arrowhead: true,
    opacity: 0.84,
    curve: 'orthogonal',
    labelMode: 'on-focus',
  }),
  configuration: Object.freeze({
    color: 0xf0b44d,
    width: 1.7,
    dashed: true,
    dashSize: 0.18,
    gapSize: 0.2,
    arrowhead: true,
    opacity: 0.67,
    curve: 'orthogonal',
    labelMode: 'on-focus',
  }),
});

export const getRelationStyle = (semantic: RelationSemantic): RelationStyle =>
  relationStyles[semantic];

export interface RelationVisualHandle {
  readonly relationId: RelationId;
  readonly relation: WorldRelation;
  readonly root: THREE.Group;
  readonly line: THREE.Line;
  readonly style: RelationStyle;
  readonly isDisposed: boolean;
  update(
    relation: WorldRelation,
    route: RelationRoute,
    view: RelationViewState,
    entities: SceneRegistry,
  ): void;
  dispose(): void;
}

const anchorsFor = (relation: WorldRelation): readonly [AnchorKind, AnchorKind] => {
  if (relation.type === 'implemented-by') return ['local-runtime', 'local-runtime'];
  if (relation.type === 'stores-in') return ['storage', 'storage'];

  switch (relation.semantic) {
    case 'ownership':
      return ['ownership', 'ownership'];
    case 'placement':
      return ['placement', 'placement'];
    case 'composition':
      return ['composition', 'composition'];
    case 'control-observation':
    case 'configuration':
      return ['api-out', 'api-in'];
    case 'data-flow':
    case 'DNS-flow':
      return ['network-out', 'network-in'];
    case 'selection':
    case 'endpoint-membership':
      return ['api-out', 'api-in'];
    case 'scope':
      return ['right', 'left'];
    case 'storage':
      return ['storage', 'storage'];
  }
};

const vectorFrom = (position: Position): THREE.Vector3 => new THREE.Vector3(...position);

const endpoints = (
  relation: WorldRelation,
  route: RelationRoute,
  entities: SceneRegistry,
): readonly [THREE.Vector3, THREE.Vector3] => {
  const fallbackStart = route.points[0] ? vectorFrom(route.points[0]) : new THREE.Vector3();
  const fallbackEnd = route.points.at(-1)
    ? vectorFrom(route.points.at(-1) ?? [0, 0, 0])
    : fallbackStart.clone();
  const [fromAnchor, toAnchor] = anchorsFor(relation);
  const start = entities.get(relation.from)?.getAnchor(fromAnchor) ?? fallbackStart;
  const end = entities.get(relation.to)?.getAnchor(toAnchor) ?? fallbackEnd;
  if (start.distanceToSquared(end) < 0.0001) end.add(new THREE.Vector3(0, 0.36, 0));
  return [start, end];
};

const routedPoints = (
  relation: WorldRelation,
  route: RelationRoute,
  style: RelationStyle,
  entities: SceneRegistry,
): readonly THREE.Vector3[] => {
  const [start, end] = endpoints(relation, route, entities);
  if (style.curve === 'arc') {
    const midpoint = start.clone().lerp(end, 0.5);
    midpoint.y += Math.max(0.75, start.distanceTo(end) * 0.13);
    return new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(20);
  }
  if (style.curve === 'orthogonal') {
    const bridgeY = Math.max(start.y, end.y) + 0.46;
    return [
      start,
      new THREE.Vector3(start.x, bridgeY, start.z),
      new THREE.Vector3(end.x, bridgeY, end.z),
      end,
    ];
  }
  return [start, end];
};

const pointsKey = (points: readonly THREE.Vector3[]): string =>
  points
    .map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)},${point.z.toFixed(4)}`)
    .join('|');

const materialFor = (style: RelationStyle): THREE.LineBasicMaterial | THREE.LineDashedMaterial => {
  if (style.dashed) {
    return new THREE.LineDashedMaterial({
      color: style.color,
      linewidth: style.width,
      dashSize: style.dashSize ?? 0.25,
      gapSize: style.gapSize ?? 0.15,
      transparent: true,
      opacity: style.opacity,
      depthWrite: false,
    });
  }
  return new THREE.LineBasicMaterial({
    color: style.color,
    linewidth: style.width,
    transparent: true,
    opacity: style.opacity,
    depthWrite: false,
  });
};

class RelationHandle implements RelationVisualHandle {
  public readonly relationId: RelationId;
  public readonly root = new THREE.Group();
  public readonly line: THREE.Line;
  private readonly arrow: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  private currentRelation: WorldRelation;
  private currentStyle: RelationStyle;
  private geometry = new THREE.BufferGeometry();
  private lineMaterial: THREE.LineBasicMaterial | THREE.LineDashedMaterial;
  private routeKey = '';
  private disposed = false;

  public constructor(
    relation: WorldRelation,
    route: RelationRoute,
    view: RelationViewState,
    entities: SceneRegistry,
  ) {
    this.relationId = relation.id;
    this.currentRelation = relation;
    this.currentStyle = getRelationStyle(relation.semantic);
    this.root.name = `relation:${relation.id}`;
    this.root.userData.relationId = relation.id;
    this.root.userData.semantic = relation.semantic;
    this.root.userData.selectable = false;
    this.lineMaterial = materialFor(this.currentStyle);
    this.line = new THREE.Line(this.geometry, this.lineMaterial);
    this.line.userData.selectable = false;
    this.line.userData.role = 'relation-line';
    this.root.add(this.line);
    const arrowGeometry = new THREE.ConeGeometry(0.12, 0.36, 10);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: this.currentStyle.color,
      transparent: true,
      opacity: this.currentStyle.opacity,
      depthWrite: false,
    });
    this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    this.arrow.userData.selectable = false;
    this.arrow.userData.role = 'relation-arrowhead';
    this.root.add(this.arrow);
    this.update(relation, route, view, entities);
  }

  public get relation(): WorldRelation {
    return this.currentRelation;
  }

  public get style(): RelationStyle {
    return this.currentStyle;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  private replaceStyle(style: RelationStyle): void {
    this.lineMaterial.dispose();
    this.lineMaterial = materialFor(style);
    this.line.material = this.lineMaterial;
    this.arrow.material.color.setHex(style.color);
    this.routeKey = '';
  }

  public update(
    relation: WorldRelation,
    route: RelationRoute,
    view: RelationViewState,
    entities: SceneRegistry,
  ): void {
    if (this.disposed) throw new Error(`Cannot update disposed relation "${this.relationId}".`);
    if (relation.id !== this.relationId) {
      throw new Error(`Relation handle "${this.relationId}" cannot update "${relation.id}".`);
    }
    const nextStyle = getRelationStyle(relation.semantic);
    if (nextStyle !== this.currentStyle) this.replaceStyle(nextStyle);
    this.currentStyle = nextStyle;
    this.currentRelation = relation;
    this.root.userData.semantic = relation.semantic;
    this.root.userData.labelMode = nextStyle.labelMode;
    this.root.userData.emphasis = view.emphasis;
    this.root.visible = view.visible;

    const points = routedPoints(relation, route, nextStyle, entities);
    const nextRouteKey = pointsKey(points);
    if (nextRouteKey !== this.routeKey) {
      const nextGeometry = new THREE.BufferGeometry().setFromPoints([...points]);
      const oldGeometry = this.geometry;
      this.geometry = nextGeometry;
      this.line.geometry = nextGeometry;
      oldGeometry.dispose();
      if (this.lineMaterial instanceof THREE.LineDashedMaterial) this.line.computeLineDistances();
      this.routeKey = nextRouteKey;
    }

    const opacityFactor =
      view.emphasis === 'dimmed' ? 0.22 : view.emphasis === 'focused' ? 1.18 : 1;
    this.lineMaterial.opacity = Math.min(1, nextStyle.opacity * opacityFactor);
    this.lineMaterial.linewidth = nextStyle.width * (view.emphasis === 'focused' ? 1.55 : 1);
    this.line.renderOrder = view.emphasis === 'focused' ? 6 : 0;
    const last = points.at(-1);
    const beforeLast = points.at(-2);
    if (last && beforeLast) {
      const direction = last.clone().sub(beforeLast).normalize();
      this.arrow.position.copy(last).addScaledVector(direction, -0.14);
      this.arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    }
    this.arrow.visible = relation.directed && nextStyle.arrowhead && view.visible;
    this.arrow.material.opacity = Math.min(1, nextStyle.opacity * opacityFactor);
    this.arrow.scale.setScalar(
      view.emphasis === 'focused' ? 1.35 : view.emphasis === 'dimmed' ? 0.72 : 1,
    );
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.visible = false;
    this.root.removeFromParent();
    this.root.clear();
    this.geometry.dispose();
    this.lineMaterial.dispose();
    this.arrow.geometry.dispose();
    this.arrow.material.dispose();
  }
}

export interface RelationSyncResult {
  readonly added: readonly RelationId[];
  readonly updated: readonly RelationId[];
  readonly removed: readonly RelationId[];
}

/** Diffs relation handles by stable RelationId and owns every per-relation GPU resource. */
export class RelationRegistry {
  private readonly handles = new Map<RelationId, RelationVisualHandle>();

  public constructor(private readonly scene: THREE.Object3D) {}

  public get(relationId: RelationId): RelationVisualHandle | undefined {
    return this.handles.get(relationId);
  }

  public sync(
    world: WorldSnapshot,
    view: ViewProjection,
    layout: LayoutResult,
    entities: SceneRegistry,
  ): RelationSyncResult {
    const desired = Object.values(world.relations)
      .filter((relation) => {
        const state = view.relationStates[relation.id];
        return (
          state?.visible === true &&
          layout.routes.has(relation.id) &&
          entities.get(relation.from) !== undefined &&
          entities.get(relation.to) !== undefined
        );
      })
      .sort((left, right) => left.id.localeCompare(right.id));
    const desiredIds = new Set(desired.map((relation) => relation.id));
    const removed: RelationId[] = [];
    for (const relationId of [...this.handles.keys()].sort()) {
      if (desiredIds.has(relationId)) continue;
      removed.push(relationId);
      this.remove(relationId);
    }

    const added: RelationId[] = [];
    const updated: RelationId[] = [];
    for (const relation of desired) {
      const route = layout.routes.get(relation.id);
      const state = view.relationStates[relation.id];
      if (!route || !state) continue;
      const current = this.handles.get(relation.id);
      if (current) {
        current.update(relation, route, state, entities);
        updated.push(relation.id);
      } else {
        const handle = new RelationHandle(relation, route, state, entities);
        this.handles.set(relation.id, handle);
        this.scene.add(handle.root);
        added.push(relation.id);
      }
    }
    return { added, updated, removed };
  }

  public remove(relationId: RelationId): void {
    const handle = this.handles.get(relationId);
    if (!handle) return;
    handle.dispose();
    this.handles.delete(relationId);
  }

  public clear(): void {
    for (const relationId of [...this.handles.keys()]) this.remove(relationId);
  }

  public values(): Iterable<RelationVisualHandle> {
    return this.handles.values();
  }

  public get size(): number {
    return this.handles.size;
  }
}
