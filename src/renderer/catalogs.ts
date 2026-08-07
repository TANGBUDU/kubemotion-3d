import * as THREE from 'three';
import type { EntityStatus, VisualArchetype } from '../domain/types';

export class GeometryCatalog {
  private readonly geometries = new Map<VisualArchetype, THREE.BufferGeometry>();

  get(archetype: VisualArchetype): THREE.BufferGeometry {
    const existing = this.geometries.get(archetype);
    if (existing) return existing;
    const geometry = this.create(archetype);
    this.geometries.set(archetype, geometry);
    return geometry;
  }

  private create(archetype: VisualArchetype): THREE.BufferGeometry {
    switch (archetype) {
      case 'cluster':
        return new THREE.CylinderGeometry(9, 9, 0.24, 48);
      case 'node':
        return new THREE.BoxGeometry(4.5, 0.55, 3.6);
      case 'namespace':
        return new THREE.CylinderGeometry(4.2, 4.2, 0.12, 32);
      case 'pod':
        return new THREE.CapsuleGeometry(0.46, 0.8, 5, 12);
      case 'service':
        return new THREE.TorusGeometry(0.62, 0.18, 10, 28);
      case 'endpointslice':
        return new THREE.BoxGeometry(1.35, 0.18, 0.9);
      case 'deployment':
        return new THREE.BoxGeometry(1.4, 0.16, 1);
      case 'replicaset':
        return new THREE.BoxGeometry(1.05, 0.16, 0.72);
      case 'control-plane':
        return new THREE.CylinderGeometry(0.65, 0.65, 0.6, 8);
      case 'runtime':
        return new THREE.CylinderGeometry(0.38, 0.38, 0.62, 8);
      case 'storage':
        return new THREE.CylinderGeometry(0.62, 0.62, 0.4, 18);
      case 'gateway':
        return new THREE.BoxGeometry(1.2, 1.2, 0.32);
      case 'external':
        return new THREE.SphereGeometry(0.58, 16, 12);
      case 'config':
        return new THREE.BoxGeometry(1.1, 0.12, 0.82);
      case 'container':
        return new THREE.BoxGeometry(0.32, 0.32, 0.32);
    }
  }

  dispose(): void {
    for (const geometry of this.geometries.values()) geometry.dispose();
  }
  get size(): number {
    return this.geometries.size;
  }
}

const statusColors: Record<EntityStatus, number> = {
  healthy: 0x45c486,
  ready: 0x45c486,
  'not-ready': 0xf0b44d,
  pending: 0xf0b44d,
  starting: 0x5eb6ff,
  terminating: 0xef6a78,
  failed: 0xef6a78,
  unknown: 0x9fb3c8,
};

export class MaterialCatalog {
  private readonly materials = new Map<string, THREE.MeshStandardMaterial>();

  get(archetype: VisualArchetype, status: EntityStatus): THREE.MeshStandardMaterial {
    const key = `${archetype}:${status}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const base =
      archetype === 'namespace' || archetype === 'cluster' ? 0x29415e : statusColors[status];
    const material = new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.56,
      metalness: archetype === 'node' ? 0.32 : 0.08,
      transparent: archetype === 'namespace' || archetype === 'cluster',
      opacity: archetype === 'namespace' ? 0.28 : archetype === 'cluster' ? 0.34 : 1,
    });
    this.materials.set(key, material);
    return material;
  }

  dispose(): void {
    for (const material of this.materials.values()) material.dispose();
  }
}
