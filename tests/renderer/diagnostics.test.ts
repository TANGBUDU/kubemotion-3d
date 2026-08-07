import { describe, expect, it, vi } from 'vitest';
import { EventListenerTracker } from '../../src/renderer/diagnostics/EventListenerTracker';

describe('EventListenerTracker', () => {
  it('reports attached listeners exactly and detaches each listener once', () => {
    const target = new EventTarget();
    const first = vi.fn();
    const second = vi.fn();
    const tracker = new EventListenerTracker();

    const releaseFirst = tracker.listen(
      () => target.addEventListener('first', first),
      () => target.removeEventListener('first', first),
    );
    tracker.listen(
      () => target.addEventListener('second', second),
      () => target.removeEventListener('second', second),
    );

    expect(tracker.size).toBe(2);
    target.dispatchEvent(new Event('first'));
    target.dispatchEvent(new Event('second'));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    releaseFirst();
    releaseFirst();
    expect(tracker.size).toBe(1);
    target.dispatchEvent(new Event('first'));
    expect(first).toHaveBeenCalledTimes(1);

    tracker.dispose();
    tracker.dispose();
    expect(tracker.size).toBe(0);
    target.dispatchEvent(new Event('second'));
    expect(second).toHaveBeenCalledTimes(1);
    expect(() =>
      tracker.listen(
        () => undefined,
        () => undefined,
      ),
    ).toThrow(/after tracker disposal/);
  });

  it('tracks DOM listeners added and removed through an identity-stable target proxy', () => {
    const target = new EventTarget();
    const listener = vi.fn();
    const tracker = new EventListenerTracker();
    const wrapped = tracker.wrapEventTarget(target);

    expect(tracker.wrapEventTarget(target)).toBe(wrapped);
    wrapped.addEventListener('change', listener, { passive: true });
    wrapped.addEventListener('change', listener, { passive: false });
    expect(tracker.size).toBe(1);
    wrapped.dispatchEvent(new Event('change'));
    expect(listener).toHaveBeenCalledTimes(1);

    wrapped.removeEventListener('change', listener);
    expect(tracker.size).toBe(0);
    tracker.dispose();
    expect(() => tracker.wrapEventTarget(target)).toThrow(/after tracker disposal/);
  });
});
