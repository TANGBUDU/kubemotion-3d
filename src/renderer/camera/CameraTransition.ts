import * as THREE from 'three';

export interface OrthographicCameraPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly zoom: number;
}

const capturePose = (camera: THREE.OrthographicCamera): OrthographicCameraPose => ({
  position: camera.position.clone(),
  quaternion: camera.quaternion.clone(),
  left: camera.left,
  right: camera.right,
  top: camera.top,
  bottom: camera.bottom,
  zoom: camera.zoom,
});

export const applyCameraPose = (
  camera: THREE.OrthographicCamera,
  pose: OrthographicCameraPose,
): void => {
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.left = pose.left;
  camera.right = pose.right;
  camera.top = pose.top;
  camera.bottom = pose.bottom;
  camera.zoom = pose.zoom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

const easeInOut = (progress: number): number =>
  progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

export class CameraTransition {
  private readonly baseline: OrthographicCameraPose;
  private readonly destination: OrthographicCameraPose;
  private finished = false;
  private readonly baselineTarget: THREE.Vector3 | undefined;
  private readonly destinationTarget: THREE.Vector3 | undefined;

  public constructor(
    private readonly camera: THREE.OrthographicCamera,
    destination: OrthographicCameraPose,
    private readonly target?: THREE.Vector3,
    destinationTarget?: THREE.Vector3,
  ) {
    this.baseline = capturePose(camera);
    this.destination = {
      ...destination,
      position: destination.position.clone(),
      quaternion: destination.quaternion.clone(),
    };
    this.baselineTarget = target?.clone();
    this.destinationTarget = destinationTarget?.clone();
  }

  public update(progress: number): boolean {
    if (this.finished) return false;
    const amount = easeInOut(Math.min(1, Math.max(0, progress)));
    this.camera.position.lerpVectors(this.baseline.position, this.destination.position, amount);
    this.camera.quaternion.slerpQuaternions(
      this.baseline.quaternion,
      this.destination.quaternion,
      amount,
    );
    this.camera.left = THREE.MathUtils.lerp(this.baseline.left, this.destination.left, amount);
    this.camera.right = THREE.MathUtils.lerp(this.baseline.right, this.destination.right, amount);
    this.camera.top = THREE.MathUtils.lerp(this.baseline.top, this.destination.top, amount);
    this.camera.bottom = THREE.MathUtils.lerp(
      this.baseline.bottom,
      this.destination.bottom,
      amount,
    );
    this.camera.zoom = THREE.MathUtils.lerp(this.baseline.zoom, this.destination.zoom, amount);
    if (this.target && this.baselineTarget && this.destinationTarget) {
      this.target.lerpVectors(this.baselineTarget, this.destinationTarget, amount);
    }
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    if (progress >= 1) {
      this.finish();
      return false;
    }
    return true;
  }

  public finish(): void {
    applyCameraPose(this.camera, this.destination);
    if (this.target && this.destinationTarget) this.target.copy(this.destinationTarget);
    this.finished = true;
  }

  public cancel(restoreBaseline = true): void {
    if (restoreBaseline) {
      applyCameraPose(this.camera, this.baseline);
      if (this.target && this.baselineTarget) this.target.copy(this.baselineTarget);
    }
    this.finished = true;
  }
}

export const cameraPose = (camera: THREE.OrthographicCamera): OrthographicCameraPose =>
  capturePose(camera);
