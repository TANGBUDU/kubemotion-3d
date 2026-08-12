import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ThreeModule from 'three';

const rendererHarness = vi.hoisted(() => ({
  construct: vi.fn(),
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof ThreeModule>();
  return {
    ...actual,
    WebGLRenderer: class MockWebGLRenderer {
      public constructor(parameters: unknown) {
        rendererHarness.construct(parameters);
      }
    },
  };
});

import {
  SceneController,
  SceneRendererInitializationError,
} from '../../src/renderer/SceneController';

describe('SceneController renderer initialization classification', () => {
  beforeEach(() => {
    rendererHarness.construct.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves an unexpected renderer constructor error after a non-null context probe', () => {
    const context = {} as WebGLRenderingContext;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const sentinel = new TypeError('sentinel renderer construction failure');
    rendererHarness.construct.mockImplementation(() => {
      throw sentinel;
    });

    let caught: unknown;
    try {
      new SceneController(document.createElement('div'));
    } catch (error: unknown) {
      caught = error;
    }

    expect(caught).toBe(sentinel);
    expect(caught).not.toBeInstanceOf(SceneRendererInitializationError);
    expect(rendererHarness.construct).toHaveBeenCalledTimes(1);
    expect(rendererHarness.construct.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ context }),
    );
  });

  it('maps only a null context probe to SceneRendererInitializationError', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    expect(() => new SceneController(document.createElement('div'))).toThrow(
      SceneRendererInitializationError,
    );
    expect(rendererHarness.construct).not.toHaveBeenCalled();
  });
});
