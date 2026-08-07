import * as THREE from 'three';
import type { EntityStatus } from '../../world/types';
import { palette, statusColor } from './palette';

export type SurfaceTone = 'primary' | 'secondary' | 'elevated' | 'recessed';

const surfaceColor: Readonly<Record<SurfaceTone, number>> = {
  primary: palette.surfacePrimary,
  secondary: palette.surfaceSecondary,
  elevated: palette.surfaceElevated,
  recessed: palette.surfaceRecessed,
};

export interface StandardMaterialOptions {
  readonly tone?: SurfaceTone;
  readonly color?: number;
  readonly roughness?: number;
  readonly metalness?: number;
  readonly transparent?: boolean;
  readonly opacity?: number;
  readonly side?: THREE.Side;
}

export const createSurfaceMaterial = (
  options: StandardMaterialOptions = {},
): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({
    color: options.color ?? surfaceColor[options.tone ?? 'primary'],
    emissive: 0x000000,
    emissiveIntensity: 0,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.09,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    side: options.side ?? THREE.FrontSide,
  });

export const createShellMaterial = (): THREE.MeshStandardMaterial =>
  createSurfaceMaterial({
    color: palette.surfaceElevated,
    roughness: 0.48,
    metalness: 0.06,
    transparent: true,
    opacity: 0.24,
    side: THREE.DoubleSide,
  });

export const createStatusMaterial = (status: EntityStatus): THREE.MeshStandardMaterial =>
  createSurfaceMaterial({ color: statusColor(status), roughness: 0.46, metalness: 0.05 });

export const createFlatAccentMaterial = (color: number, opacity = 1): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 1,
    toneMapped: false,
  });

export const applyMaterialStatus = (
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial,
  status: EntityStatus,
): void => {
  material.color.setHex(statusColor(status));
};
