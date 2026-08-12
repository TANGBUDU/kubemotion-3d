import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import {
  assertRoutePoints,
  clonePoints,
  flattenPoints,
  polylineLength,
  samplePolyline,
  stablePointsKey,
} from './polyline';
import type { ViewportResolution, WideLineStyle } from './relationTypes';

const validateResolution = (resolution: ViewportResolution): void => {
  if (
    !Number.isFinite(resolution.width) ||
    !Number.isFinite(resolution.height) ||
    !Number.isFinite(resolution.pixelRatio) ||
    resolution.width <= 0 ||
    resolution.height <= 0 ||
    resolution.pixelRatio <= 0
  ) {
    throw new Error('Wide-line resolution and pixel ratio must be positive finite values.');
  }
};

/** Owns one Line2, LineGeometry, and LineMaterial. No one-pixel WebGL fallback is used. */
export class WideLineHandle {
  public readonly root = new THREE.Group();
  public readonly material: LineMaterial;
  public readonly line: Line2;
  private currentGeometry = new LineGeometry();
  private currentStyle: WideLineStyle;
  private resolution: ViewportResolution;
  private points: readonly THREE.Vector3[] = [];
  private pointsKey = '';
  private disposed = false;

  public constructor(
    public readonly id: string,
    points: readonly THREE.Vector3[],
    style: WideLineStyle,
    resolution: ViewportResolution,
  ) {
    validateResolution(resolution);
    this.currentStyle = style;
    this.resolution = { ...resolution };
    this.root.name = `wide-line:${id}`;
    this.root.userData.routeId = id;
    this.root.userData.selectable = false;
    this.material = new LineMaterial({
      color: style.color,
      linewidth: style.widthCssPx,
      transparent: true,
      opacity: style.opacity,
      dashed: style.dashed,
      dashScale: style.dashScale,
      dashSize: style.dashSize,
      gapSize: style.gapSize,
      resolution: new THREE.Vector2(resolution.width, resolution.height),
      worldUnits: false,
      alphaToCoverage: true,
      depthWrite: false,
    });
    this.material.depthTest = true;
    this.line = new Line2(this.currentGeometry, this.material);
    this.line.name = `wide-line-mesh:${id}`;
    this.line.userData.routeId = id;
    this.line.userData.selectable = false;
    this.line.frustumCulled = false;
    this.root.add(this.line);
    this.updatePoints(points);
    this.applyStyle(style);
  }

  public updatePoints(points: readonly THREE.Vector3[]): void {
    this.assertUsable();
    assertRoutePoints(points);
    const nextKey = stablePointsKey(points);
    if (nextKey === this.pointsKey) return;
    this.points = clonePoints(points);
    this.pointsKey = nextKey;
    const nextGeometry = new LineGeometry();
    nextGeometry.setPositions(flattenPoints(this.points));
    nextGeometry.computeBoundingBox();
    nextGeometry.computeBoundingSphere();
    const previousGeometry = this.currentGeometry;
    this.currentGeometry = nextGeometry;
    this.line.geometry = nextGeometry;
    previousGeometry.dispose();
    this.line.computeLineDistances();
    this.line.userData.routeLength = polylineLength(this.points);
  }

  public applyStyle(style: WideLineStyle): void {
    this.assertUsable();
    const dashedChanged = this.currentStyle.dashed !== style.dashed;
    this.currentStyle = style;
    this.material.color.setHex(style.color);
    this.material.opacity = style.opacity;
    this.material.transparent = style.opacity < 1;
    this.material.linewidth = style.widthCssPx;
    this.material.dashed = style.dashed;
    this.material.dashScale = style.dashScale;
    this.material.dashSize = style.dashSize;
    this.material.gapSize = style.gapSize;
    this.material.depthWrite = false;
    if (dashedChanged) this.material.needsUpdate = true;
    this.line.renderOrder = style.renderOrder;
    this.root.renderOrder = style.renderOrder;
    this.root.userData.widthCssPx = style.widthCssPx;
    this.root.userData.dashed = style.dashed;
    this.root.userData.renderOrder = style.renderOrder;
    if (style.dashed) this.line.computeLineDistances();
  }

  public setResolution(width: number, height: number, pixelRatio = 1): void {
    this.assertUsable();
    const next = { width, height, pixelRatio };
    validateResolution(next);
    this.resolution = next;
    this.material.resolution.set(width, height);
    this.material.linewidth = this.currentStyle.widthCssPx;
  }

  public setOpacityFactor(factor: number): void {
    this.assertUsable();
    const normalized = Math.min(1, Math.max(0, factor));
    this.material.opacity = this.currentStyle.opacity * normalized;
    this.material.transparent = this.material.opacity < 1;
    this.material.needsUpdate = true;
  }

  public setVisible(visible: boolean): void {
    this.assertUsable();
    this.root.visible = visible;
  }

  public advanceDash(distance: number): void {
    this.assertUsable();
    if (this.currentStyle.dashed && Number.isFinite(distance)) {
      this.material.dashOffset -= distance;
    }
  }

  public sample(progress: number, target = new THREE.Vector3()): THREE.Vector3 {
    this.assertUsable();
    return samplePolyline(this.points, progress, target);
  }

  public getPoints(): readonly THREE.Vector3[] {
    this.assertUsable();
    return clonePoints(this.points);
  }

  public get length(): number {
    return polylineLength(this.points);
  }

  public get style(): WideLineStyle {
    return this.currentStyle;
  }

  public get geometry(): LineGeometry {
    return this.currentGeometry;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  private assertUsable(): void {
    if (this.disposed) throw new Error(`Wide line "${this.id}" has been disposed.`);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.root.visible = false;
    this.line.removeFromParent();
    this.root.removeFromParent();
    this.root.clear();
    this.currentGeometry.dispose();
    this.material.dispose();
    this.points = [];
  }
}
