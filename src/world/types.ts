export type EntityId = string;
export type RelationId = string;
export type SourceId = string;

export interface LocalizedText {
  readonly en: string;
  readonly ja: string;
  readonly 'zh-CN': string;
}

export const WORLD_ENTITY_CATEGORIES = [
  'api-object',
  'runtime-instance',
  'runtime-status',
  'runtime-component',
  'infrastructure',
  'external',
] as const;

export type WorldEntityCategory = (typeof WORLD_ENTITY_CATEGORIES)[number];

export const WORLD_ENTITY_STATUSES = [
  'healthy',
  'ready',
  'not-ready',
  'pending',
  'starting',
  'running',
  'waiting',
  'terminating',
  'terminated',
  'succeeded',
  'failed',
  'unknown',
] as const;

export type EntityStatus = (typeof WORLD_ENTITY_STATUSES)[number];

export const VISUAL_ARCHETYPES = [
  'cluster',
  'control-plane',
  'node',
  'namespace',
  'pod',
  'container',
  'deployment',
  'replicaset',
  'service',
  'endpointslice',
  'runtime',
  'config',
  'storage',
  'gateway',
  'external',
] as const;

export type VisualArchetype = (typeof VISUAL_ARCHETYPES)[number];
export type VisualSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface VisualDescriptor {
  readonly archetype: VisualArchetype;
  readonly size?: VisualSize;
  readonly group?: string;
}

export interface WorldEntity {
  readonly id: EntityId;
  readonly category: WorldEntityCategory;
  readonly kind: string;
  readonly name: string;
  readonly namespace?: string;
  readonly labels?: Readonly<Record<string, string>>;
  readonly status: EntityStatus;
  readonly data: Readonly<Record<string, unknown>>;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly sourceIds: readonly SourceId[];
  readonly visual: VisualDescriptor;
}

export const WORLD_RELATION_TYPES = [
  'owns',
  'scoped-by',
  'scheduled-on',
  'contains-runtime',
  'selects',
  'contains-endpoint-for',
  'contains-endpoint',
  'references',
  'configured-by',
  'implemented-by',
  'mounts',
  'binds-to',
  'stores-in',
  'watches',
  'reports-to',
  'routes-to',
  'resolves-to',
] as const;

export type RelationType = (typeof WORLD_RELATION_TYPES)[number];

export const WORLD_RELATION_SEMANTICS = [
  'ownership',
  'scope',
  'placement',
  'composition',
  'control-observation',
  'selection',
  'endpoint-membership',
  'data-flow',
  'DNS-flow',
  'storage',
  'configuration',
] as const;

export type RelationSemantic = (typeof WORLD_RELATION_SEMANTICS)[number];

export interface WorldRelation {
  readonly id: RelationId;
  readonly type: RelationType;
  readonly from: EntityId;
  readonly to: EntityId;
  readonly directed: boolean;
  readonly semantic: RelationSemantic;
  readonly title: LocalizedText;
  readonly sourceIds: readonly SourceId[];
  readonly data?: Readonly<Record<string, unknown>>;
}

export interface WorldSnapshot {
  readonly schemaVersion: 2;
  readonly scenarioId: string;
  readonly revision: number;
  readonly entities: Readonly<Record<EntityId, WorldEntity>>;
  readonly relations: Readonly<Record<RelationId, WorldRelation>>;
}

export interface PodData {
  readonly uid: string;
  readonly nodeName?: string;
  readonly phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown';
  readonly restartPolicy: 'Always' | 'OnFailure' | 'Never';
  readonly conditions: PodConditions;
}

export interface PodConditions {
  readonly podScheduled: boolean;
  readonly initialized: boolean;
  readonly containersReady: boolean;
  readonly ready: boolean;
}

export interface RunningContainerState {
  readonly kind: 'running';
  readonly startedAt: string;
}

export interface TerminatedContainerState {
  readonly kind: 'terminated';
  readonly reason: string;
  readonly exitCode: number;
  readonly finishedAt: string;
  readonly containerID: string;
}

export interface WaitingContainerState {
  readonly kind: 'waiting';
  readonly reason: string;
}

export type ContainerState =
  RunningContainerState | TerminatedContainerState | WaitingContainerState;

export interface ContainerData {
  readonly podId: EntityId;
  readonly name: string;
  readonly image: string;
  readonly containerID?: string;
  readonly restartCount: number;
  readonly ready: boolean;
  readonly started: boolean;
  readonly state: ContainerState;
  readonly lastState?: TerminatedContainerState;
}

export interface ReplicaSetData {
  readonly specReplicas: number;
  readonly statusReplicas: number;
  readonly readyReplicas: number;
}

export interface VisualDescriptorPatch {
  readonly archetype?: VisualArchetype;
  readonly size?: VisualSize | null;
  readonly group?: string | null;
}

export interface WorldEntityPatch {
  readonly id?: never;
  readonly category?: WorldEntityCategory;
  readonly kind?: string;
  readonly name?: string;
  readonly namespace?: string | null;
  /** Label values are merged. A null value removes one label; null removes all labels. */
  readonly labels?: Readonly<Record<string, string | null>> | null;
  readonly status?: EntityStatus;
  /** Data values are shallow-merged. Use a complete nested value when changing nested data. */
  readonly data?: Readonly<Record<string, unknown>>;
  readonly title?: LocalizedText;
  readonly summary?: LocalizedText;
  readonly sourceIds?: readonly SourceId[];
  readonly visual?: VisualDescriptorPatch;
}

export interface WorldRelationPatch {
  readonly id?: never;
  readonly type?: RelationType;
  readonly from?: EntityId;
  readonly to?: EntityId;
  readonly directed?: boolean;
  readonly semantic?: RelationSemantic;
  readonly title?: LocalizedText;
  readonly sourceIds?: readonly SourceId[];
  /** Data values are shallow-merged; null removes the relation data object. */
  readonly data?: Readonly<Record<string, unknown>> | null;
}

export type WorldOperation =
  | { readonly op: 'add-entity'; readonly entity: WorldEntity }
  | {
      readonly op: 'remove-entity';
      readonly entityId: EntityId;
      readonly allowMissing?: true;
    }
  | {
      readonly op: 'patch-entity';
      readonly entityId: EntityId;
      readonly patch: WorldEntityPatch;
    }
  | { readonly op: 'add-relation'; readonly relation: WorldRelation }
  | {
      readonly op: 'remove-relation';
      readonly relationId: RelationId;
      readonly allowMissing?: true;
    }
  | {
      readonly op: 'patch-relation';
      readonly relationId: RelationId;
      readonly patch: WorldRelationPatch;
    };

export interface WorldPatch {
  readonly operations: readonly WorldOperation[];
}

export type WorldEntityField = Exclude<keyof WorldEntity, 'id'>;
export type WorldRelationField = Exclude<keyof WorldRelation, 'id'>;

export interface EntityUpdate {
  readonly id: EntityId;
  readonly before: WorldEntity;
  readonly after: WorldEntity;
  readonly changedFields: readonly WorldEntityField[];
  /** Sorted RFC 6901-style paths, for example `/data/restartCount`. */
  readonly changedPaths: readonly string[];
}

export interface RelationUpdate {
  readonly id: RelationId;
  readonly before: WorldRelation;
  readonly after: WorldRelation;
  readonly changedFields: readonly WorldRelationField[];
  /** Sorted RFC 6901-style paths. */
  readonly changedPaths: readonly string[];
}

export interface WorldDiff {
  readonly addedEntities: readonly WorldEntity[];
  readonly removedEntities: readonly WorldEntity[];
  readonly updatedEntities: readonly EntityUpdate[];
  readonly addedRelations: readonly WorldRelation[];
  readonly removedRelations: readonly WorldRelation[];
  readonly updatedRelations: readonly RelationUpdate[];
}
