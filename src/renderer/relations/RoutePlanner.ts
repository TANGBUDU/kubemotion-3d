import * as THREE from 'three';
import { getTeachingRouteStyle } from './RelationStyleCatalog';
import { assertRoutePoints, polylineLength, samplePolyline, stablePointsKey } from './polyline';
import type {
  ActiveTeachingRoute,
  PlannedRouteHop,
  PlannedTeachingRoute,
  RouteAnchorResolver,
  RouteHop,
  RouteObstacle,
  RouteObstacleProvider,
  RouteStepMarker,
} from './relationTypes';

export interface RoutePlannerOptions {
  readonly obstacleClearance?: number;
  readonly gridMargin?: number;
  readonly preferredLaneX?: readonly number[];
  readonly preferredLaneZ?: readonly number[];
}

const DEFAULT_CLEARANCE = 0.32;
const DEFAULT_GRID_MARGIN = 0.08;
const COORDINATE_PRECISION = 5;

const rounded = (value: number): number => Number(value.toFixed(COORDINATE_PRECISION));
const coordinateKey = (x: number, z: number): string => `${rounded(x)},${rounded(z)}`;

const uniqueSorted = (values: readonly number[]): readonly number[] =>
  [...new Set(values.filter(Number.isFinite).map(rounded))].sort((left, right) => left - right);

const finiteVector = (point: THREE.Vector3): boolean =>
  [point.x, point.y, point.z].every(Number.isFinite);

const expandFootprint = (obstacle: RouteObstacle, clearance: number): THREE.Box3 => {
  const bounds = obstacle.bounds.clone();
  bounds.min.x -= clearance;
  bounds.min.z -= clearance;
  bounds.max.x += clearance;
  bounds.max.z += clearance;
  return bounds;
};

/** Liang-Barsky intersection against an obstacle's X/Z footprint. */
export const segmentIntersectsObstacle = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  obstacle: RouteObstacle,
  clearance = 0,
): boolean => {
  const bounds = expandFootprint(obstacle, clearance);
  const deltaX = end.x - start.x;
  const deltaZ = end.z - start.z;
  let minimum = 0;
  let maximum = 1;
  const slabs: readonly [number, number, number, number][] = [
    [start.x, deltaX, bounds.min.x, bounds.max.x],
    [start.z, deltaZ, bounds.min.z, bounds.max.z],
  ];
  for (const [origin, delta, lower, upper] of slabs) {
    if (Math.abs(delta) <= Number.EPSILON) {
      if (origin < lower || origin > upper) return false;
      continue;
    }
    const first = (lower - origin) / delta;
    const second = (upper - origin) / delta;
    const entry = Math.min(first, second);
    const exit = Math.max(first, second);
    minimum = Math.max(minimum, entry);
    maximum = Math.min(maximum, exit);
    if (minimum > maximum) return false;
  }
  return maximum >= 0 && minimum <= 1;
};

export const routeIntersectsObstacle = (
  points: readonly THREE.Vector3[],
  obstacle: RouteObstacle,
  clearance = 0,
): boolean => {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current && segmentIntersectsObstacle(previous, current, obstacle, clearance)) {
      return true;
    }
  }
  return false;
};

const removeConsecutiveDuplicates = (
  points: readonly THREE.Vector3[],
): readonly THREE.Vector3[] => {
  const result: THREE.Vector3[] = [];
  for (const point of points) {
    const previous = result.at(-1);
    if (!previous || previous.distanceToSquared(point) > 0.000_000_1) result.push(point.clone());
  }
  return result;
};

const bezierBetween = (start: THREE.Vector3, end: THREE.Vector3): readonly THREE.Vector3[] => {
  const midpoint = start.clone().lerp(end, 0.5);
  const direction = end.clone().sub(start);
  const horizontalLength = Math.hypot(direction.x, direction.z);
  if (horizontalLength > Number.EPSILON) {
    const offset = Math.min(1.1, horizontalLength * 0.12);
    midpoint.x += (-direction.z / horizontalLength) * offset;
    midpoint.z += (direction.x / horizontalLength) * offset;
  }
  return new THREE.QuadraticBezierCurve3(start, midpoint, end).getPoints(20);
};

interface GridNode {
  readonly key: string;
  readonly x: number;
  readonly z: number;
}

const pointInsideFootprint = (point: GridNode, bounds: THREE.Box3): boolean =>
  point.x > bounds.min.x &&
  point.x < bounds.max.x &&
  point.z > bounds.min.z &&
  point.z < bounds.max.z;

const pointInsideExpandedFootprint = (
  point: THREE.Vector3,
  obstacle: RouteObstacle,
  clearance: number,
): boolean => {
  const bounds = expandFootprint(obstacle, clearance);
  return (
    point.x >= bounds.min.x &&
    point.x <= bounds.max.x &&
    point.z >= bounds.min.z &&
    point.z <= bounds.max.z
  );
};

const reconstructGridPath = (
  endKey: string,
  nodes: ReadonlyMap<string, GridNode>,
  previous: ReadonlyMap<string, string>,
  y: number,
): readonly THREE.Vector3[] => {
  const reversed: THREE.Vector3[] = [];
  let currentKey: string | undefined = endKey;
  while (currentKey) {
    const node = nodes.get(currentKey);
    if (!node) break;
    reversed.push(new THREE.Vector3(node.x, y, node.z));
    currentKey = previous.get(currentKey);
  }
  return reversed.reverse();
};

const gridRoute = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  obstacles: readonly RouteObstacle[],
  clearance: number,
  margin: number,
  preferredLaneX: readonly number[],
  preferredLaneZ: readonly number[],
): readonly THREE.Vector3[] => {
  const expanded = obstacles.map((obstacle) => expandFootprint(obstacle, clearance));
  const xCoordinates = uniqueSorted([
    start.x,
    end.x,
    ...preferredLaneX,
    ...expanded.flatMap((bounds) => [bounds.min.x - margin, bounds.max.x + margin]),
  ]);
  const zCoordinates = uniqueSorted([
    start.z,
    end.z,
    ...preferredLaneZ,
    ...expanded.flatMap((bounds) => [bounds.min.z - margin, bounds.max.z + margin]),
  ]);
  const nodes = new Map<string, GridNode>();
  for (const x of xCoordinates) {
    for (const z of zCoordinates) {
      const node = { key: coordinateKey(x, z), x, z };
      if (!expanded.some((bounds) => pointInsideFootprint(node, bounds))) {
        nodes.set(node.key, node);
      }
    }
  }

  const startKey = coordinateKey(start.x, start.z);
  const endKey = coordinateKey(end.x, end.z);
  if (!nodes.has(startKey) || !nodes.has(endKey)) {
    throw new Error('Route endpoint lies inside an unrelated obstacle footprint.');
  }

  const neighbors = new Map<string, Array<{ readonly key: string; readonly distance: number }>>();
  const nodeValues = [...nodes.values()].sort((left, right) => left.key.localeCompare(right.key));
  for (let leftIndex = 0; leftIndex < nodeValues.length; leftIndex += 1) {
    const left = nodeValues[leftIndex];
    if (!left) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < nodeValues.length; rightIndex += 1) {
      const right = nodeValues[rightIndex];
      if (!right || (left.x !== right.x && left.z !== right.z)) continue;
      const from = new THREE.Vector3(left.x, start.y, left.z);
      const to = new THREE.Vector3(right.x, start.y, right.z);
      if (obstacles.some((obstacle) => segmentIntersectsObstacle(from, to, obstacle, clearance))) {
        continue;
      }
      const distance = Math.abs(left.x - right.x) + Math.abs(left.z - right.z);
      const leftNeighbors = neighbors.get(left.key) ?? [];
      const rightNeighbors = neighbors.get(right.key) ?? [];
      leftNeighbors.push({ key: right.key, distance });
      rightNeighbors.push({ key: left.key, distance });
      neighbors.set(left.key, leftNeighbors);
      neighbors.set(right.key, rightNeighbors);
    }
  }

  const distances = new Map<string, number>([[startKey, 0]]);
  const previous = new Map<string, string>();
  const remaining = new Set(nodes.keys());
  while (remaining.size > 0) {
    const currentKey = [...remaining].sort((left, right) => {
      const difference =
        (distances.get(left) ?? Number.POSITIVE_INFINITY) -
        (distances.get(right) ?? Number.POSITIVE_INFINITY);
      return difference || left.localeCompare(right);
    })[0];
    if (!currentKey || !Number.isFinite(distances.get(currentKey))) break;
    remaining.delete(currentKey);
    if (currentKey === endKey) break;
    const currentDistance = distances.get(currentKey) ?? Number.POSITIVE_INFINITY;
    const adjacent = [...(neighbors.get(currentKey) ?? [])].sort((left, right) =>
      left.key.localeCompare(right.key),
    );
    for (const neighbor of adjacent) {
      if (!remaining.has(neighbor.key)) continue;
      const candidateDistance = currentDistance + neighbor.distance;
      const knownDistance = distances.get(neighbor.key) ?? Number.POSITIVE_INFINITY;
      const knownPrevious = previous.get(neighbor.key);
      if (
        candidateDistance < knownDistance - 0.000_001 ||
        (Math.abs(candidateDistance - knownDistance) <= 0.000_001 &&
          (knownPrevious === undefined || currentKey.localeCompare(knownPrevious) < 0))
      ) {
        distances.set(neighbor.key, candidateDistance);
        previous.set(neighbor.key, currentKey);
      }
    }
  }

  if (!Number.isFinite(distances.get(endKey))) {
    throw new Error('No obstacle-free orthogonal route could be planned.');
  }
  return reconstructGridPath(endKey, nodes, previous, start.y);
};

export class RoutePlanner {
  private readonly clearance: number;
  private readonly gridMargin: number;
  private readonly preferredLaneX: readonly number[];
  private readonly preferredLaneZ: readonly number[];

  public constructor(
    private readonly anchors: RouteAnchorResolver,
    private readonly obstacleProvider?: RouteObstacleProvider,
    options: RoutePlannerOptions = {},
  ) {
    this.clearance = options.obstacleClearance ?? DEFAULT_CLEARANCE;
    this.gridMargin = options.gridMargin ?? DEFAULT_GRID_MARGIN;
    this.preferredLaneX = options.preferredLaneX ?? [];
    this.preferredLaneZ = options.preferredLaneZ ?? [];
    if (this.clearance < 0 || this.gridMargin <= 0) {
      throw new Error(
        'Route planner clearance must be non-negative and grid margin must be positive.',
      );
    }
  }

  private obstaclesFor(
    hop: RouteHop,
    start: THREE.Vector3,
    end: THREE.Vector3,
  ): readonly RouteObstacle[] {
    return [...(this.obstacleProvider?.getObstacles() ?? [])]
      .filter(
        (obstacle) =>
          obstacle.entityId !== hop.fromEntityId &&
          obstacle.entityId !== hop.toEntityId &&
          !pointInsideExpandedFootprint(start, obstacle, this.clearance) &&
          !pointInsideExpandedFootprint(end, obstacle, this.clearance),
      )
      .sort((left, right) => left.entityId.localeCompare(right.entityId))
      .map((obstacle) => ({ entityId: obstacle.entityId, bounds: obstacle.bounds.clone() }));
  }

  private planHop(route: ActiveTeachingRoute, hop: RouteHop, index: number): PlannedRouteHop {
    const start = this.anchors.resolveAnchor(hop.fromEntityId, hop.fromAnchor)?.clone();
    const end = this.anchors.resolveAnchor(hop.toEntityId, hop.toAnchor)?.clone();
    if (!start) {
      throw new Error(`Route "${route.id}" cannot resolve ${hop.fromEntityId}:${hop.fromAnchor}.`);
    }
    if (!end) {
      throw new Error(`Route "${route.id}" cannot resolve ${hop.toEntityId}:${hop.toAnchor}.`);
    }
    if (!finiteVector(start) || !finiteVector(end)) {
      throw new Error(`Route "${route.id}" resolved a non-finite anchor.`);
    }
    if (start.distanceToSquared(end) <= 0.000_000_1) {
      throw new Error(`Route "${route.id}" hop ${index + 1} has coincident anchors.`);
    }

    const style = getTeachingRouteStyle(route.semantic);
    const routeY = Math.max(start.y, end.y) + style.elevation;
    const liftedStart = new THREE.Vector3(start.x, routeY, start.z);
    const liftedEnd = new THREE.Vector3(end.x, routeY, end.z);
    // A Pod or Container endpoint can legitimately sit inside its Node/Pod visual. Those
    // enclosing hierarchy shells are not blockers; unrelated footprints still are.
    const obstacles = this.obstaclesFor(hop, start, end);
    const direct =
      style.curve === 'bezier'
        ? bezierBetween(liftedStart, liftedEnd)
        : removeConsecutiveDuplicates([
            liftedStart,
            new THREE.Vector3(liftedEnd.x, routeY, liftedStart.z),
            liftedEnd,
          ]);
    const directIsClear = obstacles.every(
      (obstacle) => !routeIntersectsObstacle(direct, obstacle, this.clearance),
    );
    const middle = directIsClear
      ? direct
      : gridRoute(
          liftedStart,
          liftedEnd,
          obstacles,
          this.clearance,
          this.gridMargin,
          this.preferredLaneX,
          this.preferredLaneZ,
        );
    const points = removeConsecutiveDuplicates([start, ...middle, end]);
    assertRoutePoints(points);
    const blocking = obstacles.find((obstacle) =>
      routeIntersectsObstacle(points, obstacle, this.clearance),
    );
    if (blocking) {
      throw new Error(
        `Route "${route.id}" still intersects obstacle "${blocking.entityId}" after planning.`,
      );
    }
    return Object.freeze({ index, hop, points, length: polylineLength(points) });
  }

  public plan(route: ActiveTeachingRoute): PlannedTeachingRoute {
    if (route.id.trim().length === 0) throw new Error('Teaching route IDs cannot be empty.');
    if (route.hops.length === 0) {
      throw new Error(`Teaching route "${route.id}" requires at least one hop.`);
    }
    const hops = route.hops.map((hop, index) => this.planHop(route, hop, index));
    const points: THREE.Vector3[] = [];
    for (const hop of hops) {
      for (const point of hop.points) {
        const previous = points.at(-1);
        if (!previous || previous.distanceToSquared(point) > 0.000_000_1)
          points.push(point.clone());
      }
    }
    assertRoutePoints(points);
    const markers: RouteStepMarker[] = route.numbered
      ? hops.map((hop) =>
          Object.freeze({
            number: hop.index + 1,
            hopIndex: hop.index,
            position: samplePolyline(hop.points, 0.5),
          }),
        )
      : [];
    const totalLength = hops.reduce((sum, hop) => sum + hop.length, 0);
    return Object.freeze({
      route,
      points,
      hops,
      markers,
      totalLength,
      stableKey: `${route.id}:${route.semantic}:${stablePointsKey(points)}`,
    });
  }
}
