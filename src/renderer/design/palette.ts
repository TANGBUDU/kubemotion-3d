import type { EntityStatus } from '../../world/types';

export const palette = Object.freeze({
  backgroundTop: 0x07111f,
  backgroundBottom: 0x0b1626,
  floor: 0x0d1a2a,
  floorGrid: 0x22364a,
  surfacePrimary: 0x16263a,
  surfaceSecondary: 0x20344b,
  surfaceElevated: 0x263d56,
  surfaceRecessed: 0x101e2f,
  runtimeModule: 0x245b72,
  runtimeModuleCap: 0x3a7891,
  borderNeutral: 0x577089,
  borderSubtle: 0x344b61,
  textPrimary: '#edf5fb',
  textSecondary: '#9eb1c2',
  textMuted: '#71869a',
  dataFlow: 0x35bdf6,
  dnsFlow: 0x2dd4bf,
  controlFlow: 0x9b87f5,
  scheduling: 0xf4aa3c,
  ownership: 0x9b87f5,
  storage: 0x43c69a,
  healthy: 0x42c994,
  pending: 0xf2b84b,
  starting: 0x5bb8f5,
  terminating: 0xf08a64,
  failed: 0xff667d,
  unknown: 0x91a4b6,
  focus: 0x8ed8ff,
});

export const statusColor = (status: EntityStatus): number => {
  switch (status) {
    case 'healthy':
    case 'ready':
    case 'running':
    case 'succeeded':
      return palette.healthy;
    case 'pending':
    case 'waiting':
    case 'not-ready':
      return palette.pending;
    case 'starting':
      return palette.starting;
    case 'terminating':
      return palette.terminating;
    case 'terminated':
    case 'failed':
      return palette.failed;
    case 'unknown':
      return palette.unknown;
  }
};

export const colorToCss = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;
