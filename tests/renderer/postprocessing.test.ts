import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  PostProcessingPipeline,
  type PostProcessingAntialiasing,
} from '../../src/renderer/postprocessing/PostProcessingPipeline';

const rendererStub = (): THREE.WebGLRenderer =>
  ({
    getPixelRatio: () => 1,
    getSize: (target: THREE.Vector2) => target.set(320, 180),
    info: {
      autoReset: true,
      reset: () => undefined,
    },
  }) as unknown as THREE.WebGLRenderer;

describe('PostProcessingPipeline', () => {
  it.each([
    ['smaa', 4],
    ['fxaa', 2],
  ] as const)('owns a restrained %s chain with bounded render targets', (antialiasing, targets) => {
    const renderer = rendererStub();
    const pipeline = new PostProcessingPipeline(
      renderer,
      new THREE.Scene(),
      new THREE.OrthographicCamera(),
      { antialiasing: antialiasing as PostProcessingAntialiasing },
    );

    expect(pipeline.diagnostics).toEqual({
      renderTargets: targets,
      passes: 3,
      antialiasing,
    });
    expect(renderer.info.autoReset).toBe(false);
    expect(() => pipeline.setSize(0, 180, 1)).toThrow(/positive finite/);
    expect(() => pipeline.setSize(320, 180, 1)).not.toThrow();

    pipeline.dispose();
    pipeline.dispose();
    expect(renderer.info.autoReset).toBe(true);
    expect(pipeline.diagnostics).toEqual({
      renderTargets: 0,
      passes: 0,
      antialiasing,
    });
    expect(() => pipeline.render()).toThrow(/disposed/);
  });
});
