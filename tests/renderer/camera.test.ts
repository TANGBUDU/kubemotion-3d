import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraFramer } from '../../src/renderer/camera/CameraFramer';
import { SafeViewport } from '../../src/renderer/camera/SafeViewport';

describe('CameraFramer authored composition', () => {
  it('clears stale user zoom and places the world target at the safe viewport center', () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 120);
    camera.zoom = 2.25;
    camera.updateProjectionMatrix();
    const viewport = new SafeViewport({
      viewport: { width: 1_280, height: 720 },
      insets: { right: 360, bottom: 84 },
    });
    const result = new CameraFramer().fit(
      camera,
      new THREE.Box3(new THREE.Vector3(-6, 0, -4), new THREE.Vector3(6, 5, 4)),
      viewport,
    );

    expect(camera.zoom).toBe(1);
    const projectedTarget = result.target.clone().project(camera);
    expect(projectedTarget.x).toBeCloseTo(viewport.centerNdc.x, 5);
    expect(projectedTarget.y).toBeCloseTo(viewport.centerNdc.y, 5);
  });
});
