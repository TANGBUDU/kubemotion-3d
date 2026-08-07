import * as THREE from 'three';
import { dimensions } from './dimensions';
import { palette } from './palette';

export const createFocusRingGeometry = (radius: number): THREE.RingGeometry =>
  new THREE.RingGeometry(radius, radius + dimensions.focus.ringThickness, 48, 1);

export const createFocusRingMaterial = (): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color: palette.focus,
    transparent: true,
    opacity: 0.86,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

export const emphasisScale = (emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden'): number =>
  emphasis === 'focused' ? 1.16 : 1;

export const emphasisOpacity = (emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden'): number => {
  if (emphasis === 'hidden') return 0;
  if (emphasis === 'dimmed') return 0.24;
  return 1;
};

export const emphasisEmissiveIntensity = (
  emphasis: 'normal' | 'focused' | 'dimmed' | 'hidden',
): number => (emphasis === 'focused' ? 0.32 : 0);
