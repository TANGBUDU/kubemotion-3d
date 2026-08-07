import * as THREE from 'three';
import { CameraFramer, type CameraFrameOptions, type CameraFrameResult } from './CameraFramer';
import { SafeViewport, type SafeViewportInput } from './SafeViewport';

export interface LessonCameraFrame {
  readonly safeViewport: SafeViewport;
  readonly frame: CameraFrameResult;
}

export class OrthographicLessonCamera {
  public readonly camera: THREE.OrthographicCamera;
  private readonly framer = new CameraFramer();
  private lastBounds = new THREE.Box3(new THREE.Vector3(-5, 0, -4), new THREE.Vector3(5, 4, 4));
  private lastViewport = new SafeViewport({ viewport: { width: 1, height: 1 } });

  public constructor() {
    this.camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 120);
    this.camera.name = 'lesson-orthographic-camera';
    this.camera.position.set(12, 16, 12);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  public fit(
    bounds: THREE.Box3,
    viewportInput: SafeViewportInput,
    options?: CameraFrameOptions,
  ): LessonCameraFrame {
    this.lastBounds = bounds.clone();
    this.lastViewport = new SafeViewport(viewportInput);
    return {
      safeViewport: this.lastViewport,
      frame: this.framer.fit(this.camera, this.lastBounds, this.lastViewport, options),
    };
  }

  public resize(viewportInput: SafeViewportInput): LessonCameraFrame {
    return this.fit(this.lastBounds, viewportInput);
  }

  public reset(): CameraFrameResult {
    return this.framer.fit(this.camera, this.lastBounds, this.lastViewport);
  }
}
