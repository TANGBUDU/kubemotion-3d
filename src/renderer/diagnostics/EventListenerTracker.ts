interface TrackedCleanup {
  readonly detach: () => void;
}

interface TrackedDomListener {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListenerOrEventListenerObject;
  readonly capture: boolean;
}

const captureFlag = (
  options?: boolean | AddEventListenerOptions | EventListenerOptions,
): boolean => (typeof options === 'boolean' ? options : (options?.capture ?? false));

const isEventTarget = (value: unknown): value is EventTarget =>
  typeof value === 'object' &&
  value !== null &&
  'addEventListener' in value &&
  'removeEventListener' in value;

/** Owns renderer-level listener cleanup and exposes the exact number still attached. */
export class EventListenerTracker {
  private readonly cleanups = new Set<TrackedCleanup>();
  private readonly domListeners = new Set<TrackedDomListener>();
  private readonly proxies = new WeakMap<EventTarget, EventTarget>();
  private disposed = false;

  /** Tracks event APIs such as Three.js EventDispatcher that are not DOM EventTargets. */
  public listen(attach: () => void, detach: () => void): () => void {
    if (this.disposed) throw new Error('Cannot attach an event listener after tracker disposal.');
    attach();
    const cleanup = { detach };
    this.cleanups.add(cleanup);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      if (!this.cleanups.delete(cleanup)) return;
      cleanup.detach();
    };
  }

  /**
   * Returns an identity-stable proxy that records DOM listeners, including listeners registered by
   * OrbitControls on the canvas and its owner document. Other DOM operations retain their native
   * receiver, so pointer capture, geometry reads, and style writes behave normally.
   */
  public wrapEventTarget<T extends EventTarget>(target: T): T {
    if (this.disposed) throw new Error('Cannot wrap an event target after tracker disposal.');
    const current = this.proxies.get(target);
    if (current) return current as T;

    const proxy = new Proxy(target, {
      get: (nativeTarget, property) => {
        if (property === 'addEventListener') {
          return (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions,
          ): void => {
            nativeTarget.addEventListener(type, listener, options);
            if (!listener) return;
            const capture = captureFlag(options);
            const exists = [...this.domListeners].some(
              (entry) =>
                entry.target === nativeTarget &&
                entry.type === type &&
                entry.listener === listener &&
                entry.capture === capture,
            );
            if (!exists) this.domListeners.add({ target: nativeTarget, type, listener, capture });
          };
        }
        if (property === 'removeEventListener') {
          return (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | EventListenerOptions,
          ): void => {
            nativeTarget.removeEventListener(type, listener, options);
            if (!listener) return;
            const capture = captureFlag(options);
            for (const entry of this.domListeners) {
              if (
                entry.target === nativeTarget &&
                entry.type === type &&
                entry.listener === listener &&
                entry.capture === capture
              ) {
                this.domListeners.delete(entry);
                break;
              }
            }
          };
        }
        if (property === 'ownerDocument') {
          const ownerDocument = Reflect.get(nativeTarget, property, nativeTarget) as unknown;
          return isEventTarget(ownerDocument) ? this.wrapEventTarget(ownerDocument) : ownerDocument;
        }
        if (property === 'getRootNode') {
          return (...args: unknown[]): Node => {
            const getRootNode = Reflect.get(nativeTarget, property, nativeTarget) as (
              ...parameters: unknown[]
            ) => Node;
            const root = getRootNode.apply(nativeTarget, args);
            return isEventTarget(root) ? this.wrapEventTarget(root) : root;
          };
        }
        const value = Reflect.get(nativeTarget, property, nativeTarget) as unknown;
        return typeof value === 'function' ? value.bind(nativeTarget) : value;
      },
      set: (nativeTarget, property, value) =>
        Reflect.set(nativeTarget, property, value, nativeTarget),
    });
    this.proxies.set(target, proxy);
    return proxy;
  }

  public get size(): number {
    return this.cleanups.size + this.domListeners.size;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanups) cleanup.detach();
    for (const entry of this.domListeners) {
      entry.target.removeEventListener(entry.type, entry.listener, entry.capture);
    }
    this.cleanups.clear();
    this.domListeners.clear();
  }
}
