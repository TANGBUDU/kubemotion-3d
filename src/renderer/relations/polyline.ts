import * as THREE from 'three';

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export const assertRoutePoints = (points: readonly THREE.Vector3[]): void => {
  if (points.length < 2) throw new Error('A rendered route requires at least two points.');
  for (const point of points) {
    if (![point.x, point.y, point.z].every(Number.isFinite)) {
      throw new Error('Route points must contain only finite coordinates.');
    }
  }
};

export const flattenPoints = (points: readonly THREE.Vector3[]): number[] =>
  points.flatMap((point) => [point.x, point.y, point.z]);

export const polylineLength = (points: readonly THREE.Vector3[]): number => {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (previous && current) length += previous.distanceTo(current);
  }
  return length;
};

export const samplePolyline = (
  points: readonly THREE.Vector3[],
  progress: number,
  target = new THREE.Vector3(),
): THREE.Vector3 => {
  assertRoutePoints(points);
  const totalLength = polylineLength(points);
  if (totalLength <= Number.EPSILON) return target.copy(points[0] ?? new THREE.Vector3());
  let remaining = clamp01(progress) * totalLength;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    const segmentLength = previous.distanceTo(current);
    if (remaining <= segmentLength || index === points.length - 1) {
      const alpha = segmentLength <= Number.EPSILON ? 0 : remaining / segmentLength;
      return target.lerpVectors(previous, current, clamp01(alpha));
    }
    remaining -= segmentLength;
  }
  return target.copy(points.at(-1) ?? new THREE.Vector3());
};

export const directionAtEnd = (
  points: readonly THREE.Vector3[],
  target = new THREE.Vector3(),
): THREE.Vector3 => {
  assertRoutePoints(points);
  for (let index = points.length - 1; index > 0; index -= 1) {
    const previous = points[index - 1];
    const current = points[index];
    if (!previous || !current) continue;
    target.subVectors(current, previous);
    if (target.lengthSq() > Number.EPSILON) return target.normalize();
  }
  return target.set(0, 1, 0);
};

export const directionAtProgress = (
  points: readonly THREE.Vector3[],
  progress: number,
  target = new THREE.Vector3(),
): THREE.Vector3 => {
  const before = samplePolyline(points, Math.max(0, progress - 0.005));
  const after = samplePolyline(points, Math.min(1, progress + 0.005));
  target.subVectors(after, before);
  return target.lengthSq() > Number.EPSILON ? target.normalize() : directionAtEnd(points, target);
};

export const distanceToPolyline = (
  points: readonly THREE.Vector3[],
  point: THREE.Vector3,
): number => {
  assertRoutePoints(points);
  let minimum = Number.POSITIVE_INFINITY;
  const segment = new THREE.Line3();
  const closest = new THREE.Vector3();
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    if (!start || !end) continue;
    segment.set(start, end).closestPointToPoint(point, true, closest);
    minimum = Math.min(minimum, closest.distanceTo(point));
  }
  return minimum;
};

export const stablePointsKey = (points: readonly THREE.Vector3[]): string =>
  points
    .map((point) => `${point.x.toFixed(5)},${point.y.toFixed(5)},${point.z.toFixed(5)}`)
    .join('|');

export const clonePoints = (points: readonly THREE.Vector3[]): readonly THREE.Vector3[] =>
  points.map((point) => point.clone());
