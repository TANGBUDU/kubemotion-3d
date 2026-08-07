import type * as THREE from 'three';
import type {
  ActiveTeachingRoute,
  RouteAnchorKind,
  RouteHop,
  RouteSemantic,
} from '../../course/types';
import type { EntityId, RelationSemantic } from '../../world/types';

export type {
  ActiveTeachingRoute,
  RouteAnchorKind,
  RouteHop,
  RouteSemantic,
} from '../../course/types';

export type RelationEmphasis = 'normal' | 'focused' | 'dimmed' | 'active';
export type RouteCurve = 'straight' | 'bezier' | 'orthogonal';

export interface WideLineStyle {
  readonly color: number;
  /** Screen-space width before device-pixel-ratio scaling. */
  readonly widthCssPx: number;
  readonly opacity: number;
  readonly dashed: boolean;
  /** Dash and gap distances are measured along the world-space route. */
  readonly dashSize: number;
  readonly gapSize: number;
  readonly dashScale: number;
  readonly arrowhead: boolean;
  readonly chevrons: boolean;
  readonly curve: RouteCurve;
  readonly elevation: number;
  readonly renderOrder: number;
  readonly labelMode: 'none' | 'on-focus' | 'always';
}

export interface ContextRelationStyle extends WideLineStyle {
  readonly semantic: RelationSemantic;
  /** Composition is communicated through nesting and therefore does not render externally. */
  readonly externalLine: boolean;
}

export interface TeachingRouteStyle extends WideLineStyle {
  readonly semantic: RouteSemantic;
  readonly tokenColor: number;
  readonly tokenCount: number;
}

export interface ViewportResolution {
  readonly width: number;
  readonly height: number;
  readonly pixelRatio: number;
}

export interface RouteObstacle {
  readonly entityId: EntityId;
  readonly bounds: THREE.Box3;
}

export interface RouteAnchorResolver {
  resolveAnchor(entityId: EntityId, anchor: RouteAnchorKind): THREE.Vector3 | undefined;
}

export interface RouteObstacleProvider {
  getObstacles(): readonly RouteObstacle[];
}

export interface PlannedRouteHop {
  readonly index: number;
  readonly hop: RouteHop;
  readonly points: readonly THREE.Vector3[];
  readonly length: number;
}

export interface RouteStepMarker {
  readonly number: number;
  readonly hopIndex: number;
  readonly position: THREE.Vector3;
}

export interface PlannedTeachingRoute {
  readonly route: ActiveTeachingRoute;
  readonly points: readonly THREE.Vector3[];
  readonly hops: readonly PlannedRouteHop[];
  readonly markers: readonly RouteStepMarker[];
  readonly totalLength: number;
  /** Stable value suitable for direct-navigation equality and renderer update deduplication. */
  readonly stableKey: string;
}

export interface RelationLayerDiagnostics {
  readonly routeHandles: number;
  readonly wideLineGeometries: number;
  readonly wideLineMaterials: number;
  readonly leasedArrowheads: number;
  readonly pooledArrowheads: number;
  readonly leasedFlowTokens: number;
  readonly pooledFlowTokens: number;
  readonly leasedRouteMarkers: number;
  readonly pooledRouteMarkers: number;
}

export interface RouteSyncResult {
  readonly added: readonly string[];
  readonly updated: readonly string[];
  readonly removed: readonly string[];
}
