import * as THREE from 'three';
import type { RouteStepMarker } from './relationTypes';

const MARKER_RADIUS = 0.29;
const MARKER_LIFT = 0.12;
const GLYPH_Z_OFFSET = 0.025;
const RIM_Z_OFFSET = 0.012;

const SEGMENTS_BY_DIGIT: Readonly<Record<string, readonly string[]>> = Object.freeze({
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'c', 'd'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
});

const HORIZONTAL_SEGMENTS = new Set(['a', 'd', 'g']);

const segmentCenter = (segment: string): readonly [number, number] => {
  switch (segment) {
    case 'a':
      return [0, 0.14];
    case 'b':
      return [0.09, 0.072];
    case 'c':
      return [0.09, -0.072];
    case 'd':
      return [0, -0.14];
    case 'e':
      return [-0.09, -0.072];
    case 'f':
      return [-0.09, 0.072];
    case 'g':
      return [0, 0];
    default:
      throw new Error(`Unknown route-marker glyph segment "${segment}".`);
  }
};

const appendQuad = (
  positions: number[],
  centerX: number,
  centerY: number,
  halfWidth: number,
  halfHeight: number,
): void => {
  const left = centerX - halfWidth;
  const right = centerX + halfWidth;
  const bottom = centerY - halfHeight;
  const top = centerY + halfHeight;
  positions.push(
    left,
    bottom,
    0,
    right,
    bottom,
    0,
    right,
    top,
    0,
    left,
    bottom,
    0,
    right,
    top,
    0,
    left,
    top,
    0,
  );
};

/** Small vector seven-segment glyph; no canvas, texture, or bitmap allocation is involved. */
const createNumberGeometry = (number: number): THREE.BufferGeometry => {
  if (!Number.isInteger(number) || number < 1) {
    throw new Error('Route marker numbers must be positive integers.');
  }
  const digits = String(number);
  const digitAdvance = 0.22;
  const unscaledWidth = digits.length * digitAdvance - 0.04;
  const scale = Math.min(1, 0.4 / unscaledWidth);
  const firstCenter = -((digits.length - 1) * digitAdvance) / 2;
  const positions: number[] = [];

  [...digits].forEach((digit, digitIndex) => {
    const segments = SEGMENTS_BY_DIGIT[digit];
    if (!segments) throw new Error(`Unsupported route marker digit "${digit}".`);
    const digitCenter = firstCenter + digitIndex * digitAdvance;
    for (const segment of segments) {
      const [segmentX, segmentY] = segmentCenter(segment);
      const horizontal = HORIZONTAL_SEGMENTS.has(segment);
      appendQuad(
        positions,
        (digitCenter + segmentX) * scale,
        segmentY * scale,
        (horizontal ? 0.075 : 0.021) * scale,
        (horizontal ? 0.021 : 0.058) * scale,
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `route-marker-glyph:${number}`;
  return geometry;
};

export interface RouteMarkerAppearance {
  readonly color: number;
  readonly opacity: number;
  readonly renderOrder: number;
}

export interface RouteMarkerLease {
  readonly object: THREE.Group;
  setMarker(marker: RouteStepMarker, routeId: string): void;
  setAppearance(appearance: RouteMarkerAppearance): void;
  setVisible(visible: boolean): void;
  release(): void;
}

interface OwnedMarker {
  readonly root: THREE.Group;
  readonly badge: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  readonly rim: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly glyph: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
}

/**
 * Pooled, vector-only numbered route badges. Badge/rim geometries and cached digit geometries are
 * shared; the small mutable materials stay attached to reusable marker objects.
 */
export class RouteMarkerPool {
  private readonly badgeGeometry = new THREE.CircleGeometry(MARKER_RADIUS, 32);
  private readonly rimGeometry = new THREE.RingGeometry(MARKER_RADIUS - 0.035, MARKER_RADIUS, 32);
  private readonly glyphGeometries = new Map<number, THREE.BufferGeometry>();
  private readonly available: OwnedMarker[] = [];
  private readonly leased = new Set<OwnedMarker>();
  private readonly owned = new Set<OwnedMarker>();
  private disposed = false;

  public constructor(private readonly defaultParent: THREE.Object3D) {
    this.badgeGeometry.name = 'route-marker-badge';
    this.rimGeometry.name = 'route-marker-rim';
  }

  public acquire(
    appearance: RouteMarkerAppearance,
    parent: THREE.Object3D = this.defaultParent,
  ): RouteMarkerLease {
    if (this.disposed) throw new Error('Cannot acquire a route marker from a disposed pool.');
    const marker = this.available.pop() ?? this.create();
    this.leased.add(marker);
    parent.add(marker.root);
    marker.root.visible = true;
    this.applyAppearance(marker, appearance);
    let released = false;
    return {
      object: marker.root,
      setMarker: (stepMarker, routeId) => this.place(marker, stepMarker, routeId),
      setAppearance: (next) => this.applyAppearance(marker, next),
      setVisible: (visible) => {
        marker.root.visible = visible;
      },
      release: () => {
        if (released) return;
        released = true;
        this.release(marker);
      },
    };
  }

  private glyphGeometry(number: number): THREE.BufferGeometry {
    const current = this.glyphGeometries.get(number);
    if (current) return current;
    const geometry = createNumberGeometry(number);
    this.glyphGeometries.set(number, geometry);
    return geometry;
  }

  private create(): OwnedMarker {
    const root = new THREE.Group();
    root.name = 'route-step-marker';
    root.rotation.x = -Math.PI / 2;
    root.userData.role = 'route-step-marker';
    root.userData.selectable = false;

    const commonMaterial = {
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      side: THREE.DoubleSide,
    } as const;
    const badge = new THREE.Mesh(
      this.badgeGeometry,
      new THREE.MeshBasicMaterial({ ...commonMaterial, color: 0x111827, opacity: 0.94 }),
    );
    badge.name = 'route-marker-badge';
    const rim = new THREE.Mesh(
      this.rimGeometry,
      new THREE.MeshBasicMaterial({ ...commonMaterial, color: 0xffffff }),
    );
    rim.name = 'route-marker-rim';
    rim.position.z = RIM_Z_OFFSET;
    const glyph = new THREE.Mesh(
      this.glyphGeometry(1),
      new THREE.MeshBasicMaterial({ ...commonMaterial, color: 0xffffff }),
    );
    glyph.name = 'route-marker-vector-glyph';
    glyph.position.z = GLYPH_Z_OFFSET;
    root.add(badge, rim, glyph);

    const marker = { root, badge, rim, glyph };
    this.owned.add(marker);
    return marker;
  }

  private place(marker: OwnedMarker, stepMarker: RouteStepMarker, routeId: string): void {
    if (!Number.isInteger(stepMarker.number) || stepMarker.number < 1) {
      throw new Error('Route marker numbers must be positive integers.');
    }
    marker.glyph.geometry = this.glyphGeometry(stepMarker.number);
    marker.root.name = `route-step-marker:${stepMarker.number}`;
    marker.root.position.copy(stepMarker.position);
    marker.root.position.y += MARKER_LIFT;
    marker.root.userData.routeId = routeId;
    marker.root.userData.markerNumber = stepMarker.number;
    marker.root.userData.hopIndex = stepMarker.hopIndex;
    marker.root.userData.vectorGlyph = true;
  }

  private applyAppearance(marker: OwnedMarker, appearance: RouteMarkerAppearance): void {
    const opacity = Math.min(1, Math.max(0, appearance.opacity));
    marker.badge.material.opacity = Math.max(0.82, opacity * 0.94);
    marker.rim.material.color.setHex(appearance.color);
    marker.rim.material.opacity = opacity;
    marker.glyph.material.opacity = opacity;
    marker.badge.renderOrder = appearance.renderOrder;
    marker.rim.renderOrder = appearance.renderOrder + 1;
    marker.glyph.renderOrder = appearance.renderOrder + 2;
    marker.badge.material.needsUpdate = true;
    marker.rim.material.needsUpdate = true;
    marker.glyph.material.needsUpdate = true;
  }

  private release(marker: OwnedMarker): void {
    if (!this.leased.delete(marker)) return;
    marker.root.removeFromParent();
    marker.root.visible = false;
    marker.root.position.set(0, 0, 0);
    marker.root.name = 'route-step-marker';
    delete marker.root.userData.routeId;
    delete marker.root.userData.markerNumber;
    delete marker.root.userData.hopIndex;
    this.available.push(marker);
  }

  public get leasedCount(): number {
    return this.leased.size;
  }

  public get pooledCount(): number {
    return this.available.length;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const marker of this.owned) {
      marker.root.removeFromParent();
      marker.badge.material.dispose();
      marker.rim.material.dispose();
      marker.glyph.material.dispose();
    }
    this.badgeGeometry.dispose();
    this.rimGeometry.dispose();
    for (const geometry of this.glyphGeometries.values()) geometry.dispose();
    this.available.length = 0;
    this.leased.clear();
    this.owned.clear();
    this.glyphGeometries.clear();
  }
}
