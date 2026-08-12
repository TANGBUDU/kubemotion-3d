import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CameraFramer } from '../../src/renderer/camera/CameraFramer';
import {
  applyCameraPose,
  cameraPose,
  CameraTransition,
} from '../../src/renderer/camera/CameraTransition';
import { PerspectiveExploreCamera } from '../../src/renderer/camera/PerspectiveExploreCamera';
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

  it('derives a safe content rectangle from real overlay exclusions', () => {
    const viewport = new SafeViewport({
      viewport: { width: 1_280, height: 720 },
      exclusions: [
        { x: 0, y: 0, width: 1_280, height: 64 },
        { x: 920, y: 64, width: 360, height: 656 },
      ],
      safeFrameRatio: 0,
    });

    expect(viewport.contentRect).toEqual({ x: 0, y: 64, width: 920, height: 656 });
    expect(viewport.centerNdc.x).toBeCloseTo(-0.28125, 5);
    expect(viewport.centerNdc.y).toBeCloseTo(-0.08889, 4);
  });

  it('reports no usable frame when an exclusion covers the entire viewport', () => {
    const viewport = new SafeViewport({
      viewport: { width: 390, height: 600 },
      exclusions: [{ x: 0, y: 0, width: 390, height: 600 }],
    });

    expect(viewport.hasUsableArea).toBe(false);
    expect(viewport.contentRect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewport.safeRect).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    expect(viewport.contains({ x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });

  it('fits Explore perspective bounds around the same asymmetric safe frame', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-7, 0, -4), new THREE.Vector3(7, 5, 4));
    const explore = new PerspectiveExploreCamera();
    const result = explore.fit(bounds, {
      viewport: { width: 1_280, height: 720 },
      exclusions: [{ x: 960, y: 0, width: 320, height: 720 }],
      safeFrameRatio: 0.06,
    });

    const projectedTarget = result.frame.target.clone().project(explore.camera);
    expect(projectedTarget.x).toBeCloseTo(result.safeViewport.centerNdc.x, 5);
    expect(projectedTarget.y).toBeCloseTo(result.safeViewport.centerNdc.y, 5);

    const points = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ].map((point) => point.project(explore.camera));
    const xs = points.map((point) => ((point.x + 1) / 2) * 1_280);
    const ys = points.map((point) => ((1 - point.y) / 2) * 720);
    const safe = result.safeViewport.safeRect;
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(safe.x - 0.75);
    expect(Math.max(...xs)).toBeLessThanOrEqual(safe.x + safe.width + 0.75);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(safe.y - 0.75);
    expect(Math.max(...ys)).toBeLessThanOrEqual(safe.y + safe.height + 0.75);
  });

  it('interpolates camera and control target, then supports interruption or a fixed end state', () => {
    const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 120);
    camera.position.set(12, 16, 12);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    const target = new THREE.Vector3(0, 0, 0);
    const baseline = cameraPose(camera);

    camera.position.set(-4, 18, 9);
    camera.left = -5;
    camera.right = 5;
    camera.top = 3;
    camera.bottom = -3;
    camera.zoom = 1.45;
    camera.lookAt(3, 2, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const destination = cameraPose(camera);
    const destinationTarget = new THREE.Vector3(3, 2, -1);
    applyCameraPose(camera, baseline);

    const interrupted = new CameraTransition(camera, destination, target, destinationTarget);
    expect(interrupted.update(0.5)).toBe(true);
    const positionAtInterruption = camera.position.clone();
    const targetAtInterruption = target.clone();
    interrupted.cancel(false);
    expect(camera.position).toEqual(positionAtInterruption);
    expect(target).toEqual(targetAtInterruption);

    const completed = new CameraTransition(camera, destination, target, destinationTarget);
    completed.finish();
    expect(camera.position).toEqual(destination.position);
    expect(target).toEqual(destinationTarget);
    expect(camera.zoom).toBe(destination.zoom);
    expect(completed.update(0.5)).toBe(false);
  });
});
