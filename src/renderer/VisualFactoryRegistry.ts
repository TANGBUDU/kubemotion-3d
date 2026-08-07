import type { EntityViewState } from '../course/types';
import type { WorldEntity } from '../world/types';
import {
  ContainerVisualHandle,
  ControllerManagerVisualHandle,
  GenericVisualHandle,
  KubeletVisualHandle,
  NodeVisualHandle,
  PodVisualHandle,
  ReplicaSetVisualHandle,
  SchedulerVisualHandle,
  type EntityVisualHandle,
  type VisualContext,
} from './VisualHandles';

export interface EntityVisualFactory {
  readonly id: string;
  supports(entity: WorldEntity): boolean;
  create(entity: WorldEntity, view: EntityViewState, context: VisualContext): EntityVisualHandle;
}

export interface EntityVisualFactoryResolver {
  create(entity: WorldEntity, view: EntityViewState, context?: VisualContext): EntityVisualHandle;
}

type HandleConstructor = new (entity: WorldEntity, view: EntityViewState) => EntityVisualHandle;

const factory = (
  id: string,
  supports: (entity: WorldEntity) => boolean,
  Handle: HandleConstructor,
): EntityVisualFactory => ({
  id,
  supports,
  create: (entity, view) => new Handle(entity, view),
});

const isControllerManager = (entity: WorldEntity): boolean =>
  entity.kind === 'ControllerManager' || entity.kind === 'KubeControllerManager';

export const GOLDEN_LESSON_VISUAL_KINDS = Object.freeze([
  'Node',
  'Pod',
  'Container',
  'ReplicaSet',
  'Kubelet',
  'ControllerManager',
  'KubeControllerManager',
  'Scheduler',
] as const);

export class UnsupportedVisualError extends Error {
  public readonly entityId: string;
  public readonly kind: string;

  public constructor(entity: WorldEntity) {
    super(
      `No specialized visual factory supports ${entity.kind} entity "${entity.id}". ` +
        'Generic fallback is disabled for this scene.',
    );
    this.name = 'UnsupportedVisualError';
    this.entityId = entity.id;
    this.kind = entity.kind;
  }
}

const builtInFactories = (): readonly EntityVisualFactory[] => [
  factory('node-rack', (entity) => entity.kind === 'Node', NodeVisualHandle),
  factory('pod-shell', (entity) => entity.kind === 'Pod', PodVisualHandle),
  factory(
    'container-instance',
    (entity) => entity.kind === 'Container' && entity.category === 'runtime-instance',
    ContainerVisualHandle,
  ),
  factory('replicaset-counter', (entity) => entity.kind === 'ReplicaSet', ReplicaSetVisualHandle),
  factory('kubelet-agent', (entity) => entity.kind === 'Kubelet', KubeletVisualHandle),
  factory('controller-manager', isControllerManager, ControllerManagerVisualHandle),
  factory('scheduler', (entity) => entity.kind === 'Scheduler', SchedulerVisualHandle),
];

/**
 * Ordered registry for teaching-specific visuals. Custom factories are evaluated before built-ins;
 * the generic fallback is never inserted into the registry and is explicit at the call site.
 */
export class VisualFactoryRegistry implements EntityVisualFactoryResolver {
  private readonly factories: EntityVisualFactory[];

  public constructor(customFactories: readonly EntityVisualFactory[] = []) {
    const ids = new Set<string>();
    this.factories = [...customFactories, ...builtInFactories()];
    for (const visualFactory of this.factories) {
      if (ids.has(visualFactory.id)) {
        throw new Error(`Duplicate visual factory id "${visualFactory.id}".`);
      }
      ids.add(visualFactory.id);
    }
  }

  public resolve(entity: WorldEntity): EntityVisualFactory | undefined {
    return this.factories.find((candidate) => candidate.supports(entity));
  }

  public create(
    entity: WorldEntity,
    view: EntityViewState,
    context: VisualContext = {},
  ): EntityVisualHandle {
    const visualFactory = this.resolve(entity);
    if (visualFactory) return visualFactory.create(entity, view, context);
    if (context.allowGeneric === false) throw new UnsupportedVisualError(entity);
    return new GenericVisualHandle(entity, view);
  }

  public supportsSpecialized(entity: WorldEntity): boolean {
    return this.resolve(entity) !== undefined;
  }

  public get registeredFactoryIds(): readonly string[] {
    return this.factories.map((visualFactory) => visualFactory.id);
  }
}
