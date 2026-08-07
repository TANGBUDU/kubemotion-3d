export type Locale = 'en' | 'ja' | 'zh-CN';
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type EntityId = string & { readonly __brand: 'EntityId' };
export type RelationId = string & { readonly __brand: 'RelationId' };
export type SourceId = string & { readonly __brand: 'SourceId' };

export interface LocalizedText {
  en: string;
  ja: string;
  'zh-CN': string;
}

export type EntityCategory = 'api-object' | 'runtime-component' | 'infrastructure' | 'external';
export type EntityScope = 'namespaced' | 'cluster' | 'node' | 'external';
export type EntityStatus =
  'healthy' | 'ready' | 'not-ready' | 'pending' | 'starting' | 'terminating' | 'failed' | 'unknown';

export type VisualArchetype =
  | 'cluster'
  | 'control-plane'
  | 'node'
  | 'namespace'
  | 'pod'
  | 'container'
  | 'deployment'
  | 'replicaset'
  | 'service'
  | 'endpointslice'
  | 'runtime'
  | 'config'
  | 'storage'
  | 'gateway'
  | 'external';

export interface EntitySemantics {
  participatesInDataPath: boolean;
  participatesInControlPath: boolean;
  isConfiguration: boolean;
  isRuntime: boolean;
}

export interface ClusterEntity {
  id: EntityId;
  category: EntityCategory;
  kind: string;
  name: string;
  scope: EntityScope;
  namespace?: string | undefined;
  nodeName?: string | undefined;
  labels?: Record<string, string> | undefined;
  annotations?: Record<string, string> | undefined;
  status: EntityStatus;
  semantics: EntitySemantics;
  title: LocalizedText;
  summary: LocalizedText;
  details?: LocalizedText | undefined;
  sourceIds: SourceId[];
  visual: {
    archetype: VisualArchetype;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | undefined;
    group?: string | undefined;
  };
  data?: Record<string, JsonValue> | undefined;
}

export type RelationType =
  | 'owns'
  | 'scoped-by'
  | 'scheduled-on'
  | 'selects'
  | 'contains-endpoint-for'
  | 'references'
  | 'configured-by'
  | 'implemented-by'
  | 'mounts'
  | 'binds-to'
  | 'stores-in'
  | 'watches'
  | 'reports-to';
export type RelationVisualSemantic =
  | 'ownership'
  | 'scope'
  | 'placement'
  | 'selection'
  | 'configuration'
  | 'storage'
  | 'control-observation';

export interface ClusterRelation {
  id: RelationId;
  type: RelationType;
  from: EntityId;
  to: EntityId;
  semantic: RelationVisualSemantic;
  directed: boolean;
  title: LocalizedText;
  sourceIds: SourceId[];
}

export interface ClusterSnapshot {
  schemaVersion: 1;
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  generatedAt: string;
  synthetic: true;
  entities: ClusterEntity[];
  relations: ClusterRelation[];
  sourceIds: SourceId[];
}

export interface ClusterGraph {
  snapshot: ClusterSnapshot;
  entityById: ReadonlyMap<EntityId, ClusterEntity>;
  outgoingByEntity: ReadonlyMap<EntityId, readonly ClusterRelation[]>;
  incomingByEntity: ReadonlyMap<EntityId, readonly ClusterRelation[]>;
  entitiesByKind: ReadonlyMap<string, readonly ClusterEntity[]>;
  entitiesByNamespace: ReadonlyMap<string, readonly ClusterEntity[]>;
  entitiesByNode: ReadonlyMap<string, readonly ClusterEntity[]>;
}
