import type * as THREE from 'three';
import type { PlaybackRequest, TransitionCue } from '../../course/types';
import type { EntityId, RelationId } from '../../world/types';
import type { EntityVisualHandle } from '../VisualHandles';

export type AnimationPhase = 'start' | 'update' | 'finish' | 'cancel';

export type CueOfType<TType extends TransitionCue['type']> = Extract<
  TransitionCue,
  { readonly type: TType }
>;

export interface CueProgressEvent<TCue extends TransitionCue> {
  readonly cue: TCue;
  readonly phase: AnimationPhase;
  readonly progress: number;
}

export interface CounterProgressEvent extends CueProgressEvent<CueOfType<'counter-change'>> {
  readonly value: number;
}

export interface RelationAnimationTarget {
  readonly root: THREE.Object3D;
}

/** The animation layer drives the renderer-owned route that is already visible in the scene. */
export interface TeachingRouteAnimationTarget {
  readonly root: THREE.Object3D;
  setFlowProgress(
    progress: number,
    direction?: 'forward' | 'reverse',
    flowPhase?: 'request' | 'response',
  ): void;
  finishFlow(): void;
}

/**
 * Renderer-owned capabilities used by animations. SceneController can provide these callbacks
 * without exposing React, DOM state, camera internals, or a concrete relation registry.
 */
export interface AnimationContext {
  readonly scene: THREE.Scene;
  readonly getEntity: (entityId: EntityId) => EntityVisualHandle | undefined;
  readonly getRelation?: (relationId: RelationId) => RelationAnimationTarget | undefined;
  readonly getRoute?: (routeId: string) => TeachingRouteAnimationTarget | undefined;
  readonly now?: () => number;
  readonly reducedMotion?: boolean;
  readonly markDirty?: () => void;
  readonly focusCamera?: (event: CueProgressEvent<CueOfType<'focus-camera'>>) => void;
  readonly transitionLayout?: (event: CueProgressEvent<CueOfType<'layout-transition'>>) => void;
  readonly reconcilePulse?: (event: CueProgressEvent<CueOfType<'reconcile-pulse'>>) => void;
  readonly schedulerAssignment?: (
    event: CueProgressEvent<CueOfType<'scheduler-assignment'>>,
  ) => void;
  readonly counterChange?: (event: CounterProgressEvent) => void;
  readonly relationReveal?: (event: CueProgressEvent<CueOfType<'relation-reveal'>>) => void;
  readonly callout?: (event: CueProgressEvent<CueOfType<'callout'>>) => void;
  /** Called after an exit reaches its committed hidden state. */
  readonly entityExitComplete?: (entityId: EntityId) => void;
}

export interface ResolvedAnimationContext extends AnimationContext {
  readonly now: () => number;
  readonly reducedMotion: boolean;
}

export interface ActiveCue {
  /** Returns true while the cue still needs animation frames. */
  update(now: number): boolean;
  /** Commits the cue's settled state. Must be idempotent. */
  finish(): void;
  /** Restores a valid renderer baseline. Must be idempotent. */
  cancel(): void;
  /** Releases transient resources. Must be idempotent. */
  dispose(): void;
}

export interface CueHandler<TCue extends TransitionCue> {
  readonly type: TCue['type'];
  start(cue: TCue, context: ResolvedAnimationContext): ActiveCue;
}

export interface PlaybackResult {
  readonly accepted: boolean;
  readonly request: PlaybackRequest;
}
