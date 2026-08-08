import * as THREE from 'three';
import { dimensions } from '../design/dimensions';
import type { CameraFrameOptions, CameraFrameResult } from './CameraFramer';
import { SafeViewport, type SafeViewportInput } from './SafeViewport';

export interface ExploreCameraFrame {
  readonly safeViewport: SafeViewport;
  readonly frame: CameraFrameResult;
}

const boxCorners = (box: THREE.Box3): readonly THREE.Vector3[] => {
  const { min, max } = box;
  return [
    new THREE.Vector3(min.x, min.y, min.z),
    new THREE.Vector3(max.x, min.y, min.z),
    new THREE.Vector3(min.x, max.y, min.z),
    new THREE.Vector3(max.x, max.y, min.z),
    new THREE.Vector3(min.x, min.y, max.z),
    new THREE.Vector3(max.x, min.y, max.z),
    new THREE.Vector3(min.x, max.y, max.z),
    new THREE.Vector3(max.x, max.y, max.z),
  ];
};

/**
 * Low-distortion perspective camera reserved for free Explore mode. Guided lessons continue to use
 * the orthographic teaching camera so authored comparisons remain stable and measurable.
 */
export class PerspectiveExploreCamera {
  public readonly camera: THREE.PerspectiveCamera;
  private lastBounds = new THREE.Box3(new THREE.Vector3(-5, 0, -4), new THREE.Vector3(5, 4, 4));
  private lastViewport = new SafeViewport({ viewport: { width: 1, height: 1 } });
  private lastViewportInput: SafeViewportInput = { viewport: { width: 1, height: 1 } };
  private lastOptions: CameraFrameOptions = {};

  public constructor() {
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 240);
    this.camera.name = 'explore-low-distortion-perspective-camera';
    this.camera.position.set(14, 18, 14);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  public fit(
    bounds: THREE.Box3,
    viewportInput: SafeViewportInput,
    options: CameraFrameOptions = {},
  ): ExploreCameraFrame {
    this.lastBounds = bounds.clone();
    this.lastViewportInput = {
      viewport: { ...viewportInput.viewport },
      ...(viewportInput.insets ? { insets: { ...viewportInput.insets } } : {}),
      ...(viewportInput.exclusions
        ? { exclusions: viewportInput.exclusions.map((rect) => ({ ...rect })) }
        : {}),
      ...(viewportInput.safeFrameRatio === undefined
        ? {}
        : { safeFrameRatio: viewportInput.safeFrameRatio }),
    };
    this.lastViewport = new SafeViewport(viewportInput);
    this.lastOptions = options;

    const validBounds = bounds.isEmpty()
      ? new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 2, 2))
      : bounds.clone();
    const target = validBounds.getCenter(new THREE.Vector3());
    const size = validBounds.getSize(new THREE.Vector3());
    const direction = (options.direction ?? new THREE.Vector3(1, 1.45, 1)).clone().normalize();

    this.camera.aspect = this.lastViewport.viewport.width / this.lastViewport.viewport.height;
    this.camera.up.set(0, 1, 0);
    this.camera.position.copy(target).addScaledVector(direction, Math.max(12, size.length() * 1.6));
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld(true);

    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1).normalize();
    const padding = options.padding ?? dimensions.camera.fitPadding;
    const tanHalfVerticalFov = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const tanHalfHorizontalFov = tanHalfVerticalFov * this.camera.aspect;
    let distance = Math.max(12, options.minViewHeight ?? 0);

    for (const corner of boxCorners(validBounds)) {
      const relative = corner.sub(target);
      const towardCamera = relative.dot(direction);
      const horizontal = Math.abs(relative.dot(right)) * padding;
      const vertical = Math.abs(relative.dot(up)) * padding;
      distance = Math.max(
        distance,
        towardCamera + horizontal / (tanHalfHorizontalFov * this.lastViewport.widthFraction),
        towardCamera + vertical / (tanHalfVerticalFov * this.lastViewport.heightFraction),
      );
    }

    const safeCenter = this.lastViewport.centerNdc;
    const halfWidthAtTarget = distance * tanHalfHorizontalFov;
    const halfHeightAtTarget = distance * tanHalfVerticalFov;
    const viewCenter = target
      .clone()
      .addScaledVector(right, -safeCenter.x * halfWidthAtTarget)
      .addScaledVector(up, -safeCenter.y * halfHeightAtTarget);

    this.camera.near = 0.1;
    this.camera.far = Math.max(240, distance + size.length() * 4);
    this.camera.position.copy(viewCenter).addScaledVector(direction, distance);
    this.camera.lookAt(viewCenter);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);

    return {
      safeViewport: this.lastViewport,
      frame: {
        worldBounds: validBounds,
        target,
        viewCenter,
        viewHeight: distance * tanHalfVerticalFov * 2,
        distance,
      },
    };
  }

  public resize(viewportInput: SafeViewportInput): ExploreCameraFrame {
    return this.fit(this.lastBounds, viewportInput, this.lastOptions);
  }

  public reset(): ExploreCameraFrame {
    return this.fit(this.lastBounds, this.lastViewportInput, this.lastOptions);
  }
}
