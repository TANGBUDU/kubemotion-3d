import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const createRoundedBoxGeometry = (
  width: number,
  height: number,
  depth: number,
  radius: number,
  segments = 3,
): RoundedBoxGeometry => new RoundedBoxGeometry(width, height, depth, segments, radius);

export const createPillGeometry = (
  width: number,
  height: number,
  depth: number,
): RoundedBoxGeometry =>
  createRoundedBoxGeometry(width, height, depth, Math.min(height, depth) * 0.42, 3);

export const createFailureStripeGeometry = (
  width: number,
  height: number,
  depth = 0.025,
): THREE.BoxGeometry => {
  const diagonalLength = Math.hypot(width, height) * 0.72;
  const geometry = new THREE.BoxGeometry(diagonalLength, 0.055, depth);
  geometry.rotateZ(Math.atan2(height, width));
  return geometry;
};

export const createVentGeometry = (width: number, depth: number): THREE.BoxGeometry =>
  new THREE.BoxGeometry(width, 0.028, depth);
