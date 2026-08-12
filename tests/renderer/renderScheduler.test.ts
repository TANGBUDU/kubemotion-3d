import { afterEach, describe, expect, it, vi } from 'vitest';
import { RenderScheduler } from '../../src/renderer/RenderScheduler';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RenderScheduler lifecycle', () => {
  it('cancels its queued frame and permanently rejects work after destroy', () => {
    let callback: FrameRequestCallback | undefined;
    const request = vi.fn((next: FrameRequestCallback) => {
      callback = next;
      return 41;
    });
    const cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', request);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    const render = vi.fn();
    const scheduler = new RenderScheduler(render);

    scheduler.markDirty();
    expect(request).toHaveBeenCalledTimes(1);
    scheduler.destroy();
    expect(cancel).toHaveBeenCalledWith(41);

    callback?.(16);
    scheduler.markDirty();
    scheduler.addReason('late-animation');
    expect(render).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
