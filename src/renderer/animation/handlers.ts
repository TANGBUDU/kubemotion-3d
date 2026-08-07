import type { TransitionCue } from '../../course/types';
import type { EntityVisualHandle } from '../VisualHandles';
import type {
  ActiveCue,
  AnimationPhase,
  CueHandler,
  CueOfType,
  ResolvedAnimationContext,
} from './contracts';
import { NoopActiveCue, TimedActiveCue, VisualBaseline } from './runtime';

const event = <TCue extends TransitionCue>(cue: TCue, phase: AnimationPhase, progress: number) =>
  ({ cue, phase, progress }) as const;

const getLiveEntity = (
  context: ResolvedAnimationContext,
  entityId: string,
): EntityVisualHandle | undefined => {
  const handle = context.getEntity(entityId);
  return handle && !handle.isDisposed ? handle : undefined;
};

type RouteFlowCue = CueOfType<'data-packet' | 'dns-query' | 'api-request'>;

class RouteFlowMotion {
  private readonly target;
  private started = false;
  private released = false;

  public constructor(
    routeId: string,
    private readonly context: ResolvedAnimationContext,
  ) {
    this.target = context.getRoute?.(routeId);
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    this.target?.setFlowProgress(this.context.reducedMotion ? 1 : 0);
  }

  public update(progress: number): void {
    this.target?.setFlowProgress(this.context.reducedMotion ? 1 : progress);
  }

  public release(): void {
    if (!this.started || this.released) return;
    this.released = true;
    this.target?.finishFlow();
  }
}

class DataPathActiveCue extends TimedActiveCue {
  private readonly motion: RouteFlowMotion;

  public constructor(cue: RouteFlowCue, context: ResolvedAnimationContext) {
    super(cue.durationMs, context, cue.delayMs);
    this.motion = new RouteFlowMotion(cue.routeId, context);
  }

  protected override onStart(): void {
    this.motion.start();
  }

  protected override onUpdate(progress: number): void {
    this.motion.update(progress);
  }

  protected override onFinish(): void {
    this.motion.release();
  }

  protected override onCancel(): void {
    this.motion.release();
  }

  protected override onDispose(): void {
    this.motion.release();
  }
}

export class DataPathCueHandler implements CueHandler<RouteFlowCue> {
  public constructor(public readonly type: RouteFlowCue['type']) {}

  public start(cue: RouteFlowCue, context: ResolvedAnimationContext): ActiveCue {
    return new DataPathActiveCue(cue, context).begin();
  }
}

class FocusCameraActiveCue extends TimedActiveCue {
  public constructor(
    private readonly cue: CueOfType<'focus-camera'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
  }

  protected override onStart(): void {
    this.context.focusCamera?.(event(this.cue, 'start', this.context.reducedMotion ? 1 : 0));
  }

  protected override onUpdate(progress: number): void {
    this.context.focusCamera?.(
      event(this.cue, 'update', this.context.reducedMotion ? 1 : progress),
    );
  }

  protected override onFinish(): void {
    this.context.focusCamera?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.context.focusCamera?.(event(this.cue, 'cancel', 0));
  }
}

export class FocusCameraCueHandler implements CueHandler<CueOfType<'focus-camera'>> {
  public readonly type = 'focus-camera' as const;
  public start(cue: CueOfType<'focus-camera'>, context: ResolvedAnimationContext): ActiveCue {
    return new FocusCameraActiveCue(cue, context).begin();
  }
}

class LayoutTransitionActiveCue extends TimedActiveCue {
  public constructor(
    private readonly cue: CueOfType<'layout-transition'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
  }

  protected override onStart(): void {
    this.context.transitionLayout?.(event(this.cue, 'start', this.context.reducedMotion ? 1 : 0));
  }

  protected override onUpdate(progress: number): void {
    this.context.transitionLayout?.(
      event(this.cue, 'update', this.context.reducedMotion ? 1 : progress),
    );
  }

  protected override onFinish(): void {
    this.context.transitionLayout?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.context.transitionLayout?.(event(this.cue, 'cancel', 0));
  }
}

export class LayoutTransitionCueHandler implements CueHandler<CueOfType<'layout-transition'>> {
  public readonly type = 'layout-transition' as const;
  public start(cue: CueOfType<'layout-transition'>, context: ResolvedAnimationContext): ActiveCue {
    return new LayoutTransitionActiveCue(cue, context).begin();
  }
}

abstract class EntityVisualActiveCue<TCue extends TransitionCue> extends TimedActiveCue {
  protected readonly baseline: VisualBaseline;

  public constructor(
    protected readonly cue: TCue,
    protected readonly handle: EntityVisualHandle,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
    this.baseline = new VisualBaseline(handle.root);
  }

  protected restore(): void {
    this.baseline.restore();
  }
}

class ContainerFailureActiveCue extends EntityVisualActiveCue<CueOfType<'container-failure'>> {
  protected override onStart(): void {
    this.baseline.setVisible(true);
  }

  protected override onUpdate(progress: number): void {
    const collapse = Math.sin(Math.PI * progress);
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(1, 1 - collapse * 0.52, 1);
    this.baseline.setOpacityFactor(1 - collapse * 0.48);
  }

  protected override onFinish(): void {
    this.restore();
  }

  protected override onCancel(): void {
    this.restore();
  }
}

export class ContainerFailureCueHandler implements CueHandler<CueOfType<'container-failure'>> {
  public readonly type = 'container-failure' as const;
  public start(cue: CueOfType<'container-failure'>, context: ResolvedAnimationContext): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle
      ? new ContainerFailureActiveCue(cue, handle, context).begin()
      : new NoopActiveCue();
  }
}

class ContainerRestartActiveCue extends EntityVisualActiveCue<CueOfType<'container-restart'>> {
  protected override onStart(): void {
    this.baseline.setVisible(true);
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(1, 0.55, 1);
    this.baseline.setOpacityFactor(0.35);
  }

  protected override onUpdate(progress: number): void {
    if (!this.context.reducedMotion) {
      const overshoot = Math.sin(Math.PI * progress) * 0.08;
      this.baseline.setScaleFactor(
        1 + overshoot,
        0.55 + progress * 0.45 + overshoot,
        1 + overshoot,
      );
    }
    this.baseline.setOpacityFactor(0.35 + progress * 0.65);
  }

  protected override onFinish(): void {
    this.restore();
  }

  protected override onCancel(): void {
    this.restore();
  }
}

export class ContainerRestartCueHandler implements CueHandler<CueOfType<'container-restart'>> {
  public readonly type = 'container-restart' as const;
  public start(cue: CueOfType<'container-restart'>, context: ResolvedAnimationContext): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle
      ? new ContainerRestartActiveCue(cue, handle, context).begin()
      : new NoopActiveCue();
  }
}

class NodeRuntimeRestartActiveCue extends EntityVisualActiveCue<CueOfType<'node-runtime-restart'>> {
  private readonly motion: RouteFlowMotion;

  public constructor(
    cue: CueOfType<'node-runtime-restart'>,
    handle: EntityVisualHandle,
    context: ResolvedAnimationContext,
  ) {
    super(cue, handle, context);
    this.motion = new RouteFlowMotion(cue.routeId, context);
  }

  protected override onStart(): void {
    this.motion.start();
    this.baseline.setVisible(true);
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(1, 0.55, 1);
    this.baseline.setOpacityFactor(0.35);
  }

  protected override onUpdate(progress: number): void {
    this.motion.update(progress);
    if (!this.context.reducedMotion) {
      const overshoot = Math.sin(Math.PI * progress) * 0.08;
      this.baseline.setScaleFactor(
        1 + overshoot,
        0.55 + progress * 0.45 + overshoot,
        1 + overshoot,
      );
    }
    this.baseline.setOpacityFactor(0.35 + progress * 0.65);
  }

  private releaseAndRestore(): void {
    this.motion.release();
    this.restore();
  }

  protected override onFinish(): void {
    this.releaseAndRestore();
  }

  protected override onCancel(): void {
    this.releaseAndRestore();
  }

  protected override onDispose(): void {
    this.motion.release();
  }
}

/** Drives the local kubelet route and replacement runtime Container as one causal cue. */
export class NodeRuntimeRestartCueHandler implements CueHandler<CueOfType<'node-runtime-restart'>> {
  public readonly type = 'node-runtime-restart' as const;
  public start(
    cue: CueOfType<'node-runtime-restart'>,
    context: ResolvedAnimationContext,
  ): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle
      ? new NodeRuntimeRestartActiveCue(cue, handle, context).begin()
      : new NoopActiveCue();
  }
}

class ContainerStartActiveCue extends EntityVisualActiveCue<CueOfType<'container-start'>> {
  protected override onStart(): void {
    this.baseline.setVisible(true);
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(0.82, 0.58, 0.82);
    this.baseline.setOpacityFactor(0.28);
  }

  protected override onUpdate(progress: number): void {
    if (!this.context.reducedMotion) {
      const settle = Math.sin(Math.PI * progress) * 0.06;
      this.baseline.setScaleFactor(
        0.82 + progress * 0.18 + settle,
        0.58 + progress * 0.42 + settle,
        0.82 + progress * 0.18 + settle,
      );
    }
    this.baseline.setOpacityFactor(0.28 + progress * 0.72);
  }

  protected override onFinish(): void {
    this.restore();
  }

  protected override onCancel(): void {
    this.restore();
  }
}

/** First startup of a waiting Container; intentionally distinct from a restart generation. */
export class ContainerStartCueHandler implements CueHandler<CueOfType<'container-start'>> {
  public readonly type = 'container-start' as const;
  public start(cue: CueOfType<'container-start'>, context: ResolvedAnimationContext): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle ? new ContainerStartActiveCue(cue, handle, context).begin() : new NoopActiveCue();
  }
}

class EntityEnterActiveCue extends EntityVisualActiveCue<CueOfType<'entity-enter'>> {
  protected override onStart(): void {
    this.baseline.setVisible(true);
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(0.72);
    this.baseline.setOpacityFactor(0);
  }

  protected override onUpdate(progress: number): void {
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(0.72 + progress * 0.28);
    this.baseline.setOpacityFactor(progress);
  }

  protected override onFinish(): void {
    this.restore();
  }

  protected override onCancel(): void {
    this.restore();
  }
}

export class EntityEnterCueHandler implements CueHandler<CueOfType<'entity-enter'>> {
  public readonly type = 'entity-enter' as const;
  public start(cue: CueOfType<'entity-enter'>, context: ResolvedAnimationContext): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle ? new EntityEnterActiveCue(cue, handle, context).begin() : new NoopActiveCue();
  }
}

class EntityExitActiveCue extends EntityVisualActiveCue<CueOfType<'entity-exit'>> {
  protected override onUpdate(progress: number): void {
    if (!this.context.reducedMotion) this.baseline.setScaleFactor(1 - progress * 0.25);
    this.baseline.setOpacityFactor(1 - progress);
  }

  protected override onFinish(): void {
    this.restore();
    this.baseline.setVisible(false);
    this.context.entityExitComplete?.(this.cue.entityId);
  }

  protected override onCancel(): void {
    this.restore();
  }
}

export class EntityExitCueHandler implements CueHandler<CueOfType<'entity-exit'>> {
  public readonly type = 'entity-exit' as const;
  public start(cue: CueOfType<'entity-exit'>, context: ResolvedAnimationContext): ActiveCue {
    const handle = getLiveEntity(context, cue.entityId);
    return handle ? new EntityExitActiveCue(cue, handle, context).begin() : new NoopActiveCue();
  }
}

class ReconcilePulseActiveCue extends TimedActiveCue {
  private readonly fromBaseline: VisualBaseline | undefined;
  private readonly toBaseline: VisualBaseline | undefined;
  private readonly motion: RouteFlowMotion;

  public constructor(
    private readonly cue: CueOfType<'reconcile-pulse'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
    const from = getLiveEntity(context, cue.fromEntityId);
    const to = getLiveEntity(context, cue.toEntityId);
    this.fromBaseline = from ? new VisualBaseline(from.root) : undefined;
    this.toBaseline = to ? new VisualBaseline(to.root) : undefined;
    this.motion = new RouteFlowMotion(cue.routeId, context);
  }

  protected override onStart(): void {
    this.motion.start();
    this.context.reconcilePulse?.(event(this.cue, 'start', this.context.reducedMotion ? 1 : 0));
  }

  protected override onUpdate(progress: number): void {
    this.motion.update(progress);
    if (this.context.reducedMotion) {
      this.toBaseline?.setOpacityFactor(0.62 + progress * 0.38);
    } else {
      const pulse = Math.sin(Math.PI * progress);
      this.fromBaseline?.setScaleFactor(1 + pulse * 0.08);
      this.toBaseline?.setScaleFactor(1 + pulse * 0.14);
    }
    this.context.reconcilePulse?.(event(this.cue, 'update', progress));
  }

  private releaseAndRestore(): void {
    this.motion.release();
    this.fromBaseline?.restore();
    this.toBaseline?.restore();
  }

  protected override onFinish(): void {
    this.releaseAndRestore();
    this.context.reconcilePulse?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.releaseAndRestore();
    this.context.reconcilePulse?.(event(this.cue, 'cancel', 0));
  }

  protected override onDispose(): void {
    this.motion.release();
  }
}

export class ReconcilePulseCueHandler implements CueHandler<CueOfType<'reconcile-pulse'>> {
  public readonly type = 'reconcile-pulse' as const;
  public start(cue: CueOfType<'reconcile-pulse'>, context: ResolvedAnimationContext): ActiveCue {
    return new ReconcilePulseActiveCue(cue, context).begin();
  }
}

class SchedulerAssignmentActiveCue extends TimedActiveCue {
  private readonly podBaseline: VisualBaseline | undefined;
  private readonly motion: RouteFlowMotion;

  public constructor(
    private readonly cue: CueOfType<'scheduler-assignment'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
    const pod = getLiveEntity(context, cue.podId);
    this.podBaseline = pod ? new VisualBaseline(pod.root) : undefined;
    this.motion = new RouteFlowMotion(cue.routeId, context);
  }

  protected override onStart(): void {
    this.motion.start();
    if (this.context.reducedMotion) this.podBaseline?.setOpacityFactor(0.55);
    this.context.schedulerAssignment?.(
      event(this.cue, 'start', this.context.reducedMotion ? 1 : 0),
    );
  }

  protected override onUpdate(progress: number): void {
    this.motion.update(progress);
    if (this.context.reducedMotion) {
      this.podBaseline?.setOpacityFactor(0.55 + progress * 0.45);
    } else {
      this.podBaseline?.setScaleFactor(1 + Math.sin(Math.PI * progress) * 0.08);
    }
    this.context.schedulerAssignment?.(event(this.cue, 'update', progress));
  }

  private releaseAndRestore(): void {
    this.motion.release();
    this.podBaseline?.restore();
  }

  protected override onFinish(): void {
    this.releaseAndRestore();
    this.context.schedulerAssignment?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.releaseAndRestore();
    this.context.schedulerAssignment?.(event(this.cue, 'cancel', 0));
  }

  protected override onDispose(): void {
    this.motion.release();
  }
}

export class SchedulerAssignmentCueHandler implements CueHandler<
  CueOfType<'scheduler-assignment'>
> {
  public readonly type = 'scheduler-assignment' as const;
  public start(
    cue: CueOfType<'scheduler-assignment'>,
    context: ResolvedAnimationContext,
  ): ActiveCue {
    return new SchedulerAssignmentActiveCue(cue, context).begin();
  }
}

class CounterChangeActiveCue extends TimedActiveCue {
  public constructor(
    private readonly cue: CueOfType<'counter-change'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
  }

  private emit(phase: AnimationPhase, progress: number, value: number): void {
    this.context.counterChange?.({ cue: this.cue, phase, progress, value });
  }

  protected override onStart(): void {
    this.emit('start', 0, this.cue.from);
  }

  protected override onUpdate(progress: number): void {
    this.emit('update', progress, this.cue.from + (this.cue.to - this.cue.from) * progress);
  }

  protected override onFinish(): void {
    this.emit('finish', 1, this.cue.to);
  }

  protected override onCancel(): void {
    // The world snapshot already owns the new factual value; cancellation restores that baseline.
    this.emit('cancel', 1, this.cue.to);
  }
}

export class CounterChangeCueHandler implements CueHandler<CueOfType<'counter-change'>> {
  public readonly type = 'counter-change' as const;
  public start(cue: CueOfType<'counter-change'>, context: ResolvedAnimationContext): ActiveCue {
    return new CounterChangeActiveCue(cue, context).begin();
  }
}

class RelationRevealActiveCue extends TimedActiveCue {
  private readonly baseline: VisualBaseline | undefined;

  public constructor(
    private readonly cue: CueOfType<'relation-reveal'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
    const target = context.getRelation?.(cue.relationId);
    this.baseline = target ? new VisualBaseline(target.root) : undefined;
  }

  protected override onStart(): void {
    this.baseline?.setVisible(true);
    this.baseline?.setOpacityFactor(0);
    this.context.relationReveal?.(event(this.cue, 'start', 0));
  }

  protected override onUpdate(progress: number): void {
    this.baseline?.setOpacityFactor(progress);
    this.context.relationReveal?.(event(this.cue, 'update', progress));
  }

  protected override onFinish(): void {
    this.baseline?.restore();
    this.context.relationReveal?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.baseline?.restore();
    this.context.relationReveal?.(event(this.cue, 'cancel', 1));
  }
}

export class RelationRevealCueHandler implements CueHandler<CueOfType<'relation-reveal'>> {
  public readonly type = 'relation-reveal' as const;
  public start(cue: CueOfType<'relation-reveal'>, context: ResolvedAnimationContext): ActiveCue {
    return new RelationRevealActiveCue(cue, context).begin();
  }
}

class CalloutActiveCue extends TimedActiveCue {
  public constructor(
    private readonly cue: CueOfType<'callout'>,
    context: ResolvedAnimationContext,
  ) {
    super(cue.durationMs, context, cue.delayMs);
  }

  protected override onStart(): void {
    this.context.callout?.(event(this.cue, 'start', 0));
  }

  protected override onUpdate(progress: number): void {
    this.context.callout?.(event(this.cue, 'update', progress));
  }

  protected override onFinish(): void {
    this.context.callout?.(event(this.cue, 'finish', 1));
  }

  protected override onCancel(): void {
    this.context.callout?.(event(this.cue, 'cancel', 0));
  }
}

export class CalloutCueHandler implements CueHandler<CueOfType<'callout'>> {
  public readonly type = 'callout' as const;
  public start(cue: CueOfType<'callout'>, context: ResolvedAnimationContext): ActiveCue {
    return new CalloutActiveCue(cue, context).begin();
  }
}

const assertNever = (cue: never): never => {
  throw new Error(`Unsupported transition cue: ${JSON.stringify(cue)}`);
};

/** Exhaustive, type-safe dispatcher. Each semantic cue has its own handler implementation. */
export class CueHandlerRegistry {
  private readonly dataPacket: DataPathCueHandler;
  private readonly dnsQuery: DataPathCueHandler;
  private readonly apiRequest: DataPathCueHandler;
  private readonly focusCamera = new FocusCameraCueHandler();
  private readonly layoutTransition = new LayoutTransitionCueHandler();
  private readonly containerFailure = new ContainerFailureCueHandler();
  private readonly nodeRuntimeRestart = new NodeRuntimeRestartCueHandler();
  private readonly containerRestart = new ContainerRestartCueHandler();
  private readonly containerStart = new ContainerStartCueHandler();
  private readonly entityExit = new EntityExitCueHandler();
  private readonly entityEnter = new EntityEnterCueHandler();
  private readonly reconcilePulse: ReconcilePulseCueHandler;
  private readonly schedulerAssignment: SchedulerAssignmentCueHandler;
  private readonly counterChange = new CounterChangeCueHandler();
  private readonly relationReveal = new RelationRevealCueHandler();
  private readonly callout = new CalloutCueHandler();

  public constructor() {
    this.dataPacket = new DataPathCueHandler('data-packet');
    this.dnsQuery = new DataPathCueHandler('dns-query');
    this.apiRequest = new DataPathCueHandler('api-request');
    this.reconcilePulse = new ReconcilePulseCueHandler();
    this.schedulerAssignment = new SchedulerAssignmentCueHandler();
  }

  public start(cue: TransitionCue, context: ResolvedAnimationContext): ActiveCue {
    switch (cue.type) {
      case 'data-packet':
        return this.dataPacket.start(cue, context);
      case 'dns-query':
        return this.dnsQuery.start(cue, context);
      case 'api-request':
        return this.apiRequest.start(cue, context);
      case 'focus-camera':
        return this.focusCamera.start(cue, context);
      case 'layout-transition':
        return this.layoutTransition.start(cue, context);
      case 'container-failure':
        return this.containerFailure.start(cue, context);
      case 'node-runtime-restart':
        return this.nodeRuntimeRestart.start(cue, context);
      case 'container-restart':
        return this.containerRestart.start(cue, context);
      case 'container-start':
        return this.containerStart.start(cue, context);
      case 'entity-exit':
        return this.entityExit.start(cue, context);
      case 'entity-enter':
        return this.entityEnter.start(cue, context);
      case 'reconcile-pulse':
        return this.reconcilePulse.start(cue, context);
      case 'scheduler-assignment':
        return this.schedulerAssignment.start(cue, context);
      case 'counter-change':
        return this.counterChange.start(cue, context);
      case 'relation-reveal':
        return this.relationReveal.start(cue, context);
      case 'callout':
        return this.callout.start(cue, context);
      default:
        return assertNever(cue);
    }
  }
}
