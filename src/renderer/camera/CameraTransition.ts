import * as THREE from 'three';

export interface OrthographicCameraPose {
  readonly position: THREE.Vector3;
  readonly quaternion: THREE.Quaternion;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const capturePose = (camera: THREE.OrthographicCamera): OrthographicCameraPose => ({
  position: camera.position.clone(),
  quaternion: camera.quaternion.clone(),
  left: camera.left,
  right: camera.right,
  top: camera.top,
  bottom: camera.bottom,
});

const applyPose = (camera: THREE.OrthographicCamera, pose: OrthographicCameraPose): void => {
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.left = pose.left;
  camera.right = pose.right;
  camera.top = pose.top;
  camera.bottom = pose.bottom;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
};

const easeInOut = (progress: number): number =>
  progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

export class CameraTransition {
  private readonly baseline: OrthographicCameraPose;
  private readonly destination: OrthographicCameraPose;
  private finished = false;

  public constructor(
    private readonly camera: THREE.OrthographicCamera,
    destination: OrthographicCameraPose,
  ) {
    this.baseline = capturePose(camera);
    this.destination = {
      ...destination,
      position: destination.position.clone(),
      quaternion: destination.quaternion.clone(),
    };
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
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    if (progress >= 1) {
      this.finish();
      return false;
    }
    return true;
  }

  public finish(): void {
    applyPose(this.camera, this.destination);
    this.finished = true;
  }

  public cancel(): void {
    applyPose(this.camera, this.baseline);
    this.finished = true;
  }
}

export const cameraPose = (camera: THREE.OrthographicCamera): OrthographicCameraPose =>
  capturePose(camera);
