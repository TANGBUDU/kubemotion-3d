import type { PlaybackRequest } from '../course/types';
import type { ActiveCue, AnimationContext, ResolvedAnimationContext } from './animation/contracts';
import { CueHandlerRegistry } from './animation/handlers';
import { AnimationTokenPool } from './animation/runtime';

export type {
  ActiveCue,
  AnimationContext,
  AnimationPhase,
  CounterProgressEvent,
  CueHandler,
  CueOfType,
  CueProgressEvent,
  RelationAnimationTarget,
  TeachingRouteAnimationTarget,
} from './animation/contracts';

/**
 * Executes explicit playback commands. A repeated or stale playbackId for the same step is ignored,
 * so React rerenders cannot accidentally replay a transition.
 */
export class AnimationCoordinator {
  private readonly pool: AnimationTokenPool;
  private readonly handlers: CueHandlerRegistry;
  private readonly lastPlaybackIds = new Map<string, number>();
  private active: ActiveCue[] = [];
  private disposed = false;

  public constructor(private readonly baseContext: AnimationContext) {
    this.pool = new AnimationTokenPool(baseContext.scene);
    this.handlers = new CueHandlerRegistry();
  }

  /** Returns false only when the request was a duplicate/stale playback command. */
  public play(
    request: PlaybackRequest,
    reducedMotion = this.baseContext.reducedMotion ?? false,
  ): boolean {
    if (this.disposed) throw new Error('Cannot play animations after coordinator disposal.');
    const previousPlaybackId = this.lastPlaybackIds.get(request.stepKey);
    if (previousPlaybackId !== undefined && request.playbackId <= previousPlaybackId) return false;

    this.cancel();
    const context: ResolvedAnimationContext = {
      ...this.baseContext,
      now: this.baseContext.now ?? (() => performance.now()),
      reducedMotion,
    };

    const started: ActiveCue[] = [];
    try {
      for (const cue of request.transition.cues) {
        started.push(this.handlers.start(cue, context));
      }
    } catch (error: unknown) {
      for (const cue of started) {
        cue.cancel();
        cue.dispose();
      }
      throw error;
    }

    this.active = started;
    this.lastPlaybackIds.set(request.stepKey, request.playbackId);
    if (started.length > 0) this.baseContext.markDirty?.();
    return true;
  }

  /** Advances all active cues and returns true while another frame is required. */
  public update(now: number): boolean {
    if (this.active.length === 0) return false;
    const remaining: ActiveCue[] = [];
    try {
      for (const cue of this.active) {
        if (cue.update(now)) {
          remaining.push(cue);
        } else {
          cue.finish();
          cue.dispose();
        }
      }
    } catch (error: unknown) {
      for (const cue of this.active) {
        cue.cancel();
        cue.dispose();
      }
      this.active = [];
      throw error;
    }
    this.active = remaining;
    return remaining.length > 0;
  }

  /** Immediately settles all active cues at their factual final state. */
  public finish(): void {
    for (const cue of this.active) {
      cue.finish();
      cue.dispose();
    }
    this.active = [];
    this.baseContext.markDirty?.();
  }

  /** Stops playback and restores every captured visual baseline. */
  public cancel(): void {
    for (const cue of this.active) {
      cue.cancel();
      cue.dispose();
    }
    this.active = [];
    this.baseContext.markDirty?.();
  }

  public get activeCount(): number {
    return this.active.length;
  }

  public get pooledCount(): number {
    return this.pool.pooledCount;
  }

  public get leasedTokenCount(): number {
    return this.pool.leasedCount;
  }

  public lastPlaybackId(stepKey: string): number | undefined {
    return this.lastPlaybackIds.get(stepKey);
  }

  /**
   * Starts a new authored application of a step. React rerenders remain deduped,
   * while back/forward or direct navigation may replay the same playback id.
   */
  public forgetPlayback(stepKey: string): void {
    if (this.disposed) throw new Error('Cannot reset playback after coordinator disposal.');
    this.lastPlaybackIds.delete(stepKey);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.cancel();
    this.pool.dispose();
    this.lastPlaybackIds.clear();
    this.disposed = true;
  }

  /** Compatibility name for renderer owners whose lifecycle method is called destroy(). */
  public destroy(): void {
    this.dispose();
  }
}
