import type { EntityViewState } from '../course/types';
import type { WorldEntity } from '../world/types';
import { ApiServerVisualHandle } from './visuals/ApiServerVisual';
import type { EntityVisualHandle, VisualContext } from './visuals/BaseVisualHandle';
import { ClientVisualHandle } from './visuals/ClientVisual';
import { ContainerVisualHandle } from './visuals/ContainerVisual';
import { ControllerManagerVisualHandle } from './visuals/ControllerManagerVisual';
import { EndpointSliceVisualHandle } from './visuals/EndpointSliceVisual';
import { GenericUnsupportedVisual } from './visuals/GenericUnsupportedVisual';
import { KubeletVisualHandle } from './visuals/KubeletVisual';
import { KubectlVisualHandle } from './visuals/KubectlVisual';
import { NodeVisualHandle } from './visuals/NodeVisual';
import { PodVisualHandle } from './visuals/PodVisual';
import { ReplicaSetVisualHandle } from './visuals/ReplicaSetVisual';
import { SchedulerVisualHandle } from './visuals/SchedulerVisual';
import { ServiceVisualHandle } from './visuals/ServiceVisual';

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

const isApiServer = (entity: WorldEntity): boolean =>
  entity.kind === 'KubeAPIServer' || entity.kind === 'ApiServer' || entity.kind === 'APIServer';

export const GOLDEN_LESSON_VISUAL_KINDS = Object.freeze([
  'Node',
  'Pod',
  'Container',
  'ReplicaSet',
  'KubeAPIServer',
  'Kubectl',
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
  factory(
    'client-pod-emitter',
    (entity) => entity.kind === 'Pod' && entity.data.trafficRole === 'client',
    ClientVisualHandle,
  ),
  factory('pod-shell', (entity) => entity.kind === 'Pod', PodVisualHandle),
  factory(
    'container-instance',
    (entity) => entity.kind === 'Container' && entity.category === 'runtime-status',
    ContainerVisualHandle,
  ),
  factory('replicaset-counter', (entity) => entity.kind === 'ReplicaSet', ReplicaSetVisualHandle),
  factory('service-routing-hub', (entity) => entity.kind === 'Service', ServiceVisualHandle),
  factory(
    'endpoint-slice-table',
    (entity) => entity.kind === 'EndpointSlice',
    EndpointSliceVisualHandle,
  ),
  factory('api-server-gateway', isApiServer, ApiServerVisualHandle),
  factory('kubectl-command-entry', (entity) => entity.kind === 'Kubectl', KubectlVisualHandle),
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
    return new GenericUnsupportedVisual(entity, view);
  }

  public supportsSpecialized(entity: WorldEntity): boolean {
    return this.resolve(entity) !== undefined;
  }

  public get registeredFactoryIds(): readonly string[] {
    return this.factories.map((visualFactory) => visualFactory.id);
  }
}
