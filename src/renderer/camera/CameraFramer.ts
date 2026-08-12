import * as THREE from 'three';
import { dimensions } from '../design/dimensions';
import type { EntityVisualHandle } from '../visuals/BaseVisualHandle';
import type { SafeViewport } from './SafeViewport';

export interface CameraFrameResult {
  readonly worldBounds: THREE.Box3;
  readonly target: THREE.Vector3;
  readonly viewCenter: THREE.Vector3;
  readonly viewHeight: number;
  readonly distance: number;
}

export interface CameraFrameOptions {
  readonly padding?: number;
  readonly minViewHeight?: number;
  readonly direction?: THREE.Vector3;
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

export const boundsForHandles = (
  handles: Iterable<EntityVisualHandle>,
  target: THREE.Box3 = new THREE.Box3(),
): THREE.Box3 => {
  target.makeEmpty();
  const scratch = new THREE.Box3();
  for (const handle of handles) {
    if (!handle.root.visible || handle.isDisposed) continue;
    target.union(
      handle.getWorldBounds
        ? handle.getWorldBounds(scratch)
        : scratch.setFromObject(handle.root, true),
    );
  }
  return target;
};

export class CameraFramer {
  public fit(
    camera: THREE.OrthographicCamera,
    worldBounds: THREE.Box3,
    viewport: SafeViewport,
    options: CameraFrameOptions = {},
  ): CameraFrameResult {
    // OrbitControls stores orthographic user zoom on the camera. Every authored
    // frame is an absolute teaching composition, so stale interactive zoom must
    // not leak into step changes, resets, or resizes.
    camera.zoom = 1;
    const validBounds = worldBounds.isEmpty()
      ? new THREE.Box3(new THREE.Vector3(-2, 0, -2), new THREE.Vector3(2, 2, 2))
      : worldBounds.clone();
    const target = validBounds.getCenter(new THREE.Vector3());
    const size = validBounds.getSize(new THREE.Vector3());
    const direction = (options.direction ?? new THREE.Vector3(1, 1.45, 1)).clone().normalize();
    const distance = Math.max(12, size.length() * 1.6);

    camera.position.copy(target).addScaledVector(direction, distance);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const corner of boxCorners(validBounds)) {
      const relative = corner.sub(target);
      const x = relative.dot(right);
      const y = relative.dot(up);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }

    const padding = options.padding ?? dimensions.camera.fitPadding;
    const boundsWidth = Math.max(0.1, maxX - minX) * padding;
    const boundsHeight = Math.max(0.1, maxY - minY) * padding;
    const fullAspect = viewport.viewport.width / viewport.viewport.height;
    const halfHeight = Math.max(
      (options.minViewHeight ?? dimensions.camera.minViewHeight) / 2,
      boundsHeight / (2 * viewport.heightFraction),
      boundsWidth / (2 * fullAspect * viewport.widthFraction),
    );
    const halfWidth = halfHeight * fullAspect;
    const safeCenter = viewport.centerNdc;
    const viewCenter = target
      .clone()
      .addScaledVector(right, -safeCenter.x * halfWidth)
      .addScaledVector(up, -safeCenter.y * halfHeight);

    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.near = 0.1;
    camera.far = Math.max(100, distance + size.length() * 3);
    camera.position.copy(viewCenter).addScaledVector(direction, distance);
    camera.lookAt(viewCenter);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    return {
      worldBounds: validBounds,
      target,
      viewCenter,
      viewHeight: halfHeight * 2,
      distance,
    };
  }
}
