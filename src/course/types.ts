import type {
  EntityCategory,
  EntityId,
  EntityStatus,
  LocalizedText,
  RelationId,
  SourceId,
} from '../domain/types';

export type ViewMode = 'overview' | 'logical' | 'placement' | 'control-flow' | 'traffic';
export type Emphasis = 'normal' | 'focused' | 'dimmed' | 'hidden';

export interface EntityProjection {
  visible: boolean;
  emphasis: Emphasis;
  statusOverride?: EntityStatus | undefined;
  labelMode?: 'none' | 'short' | 'full' | undefined;
}
export interface RelationProjection {
  visible: boolean;
  emphasis: Exclude<Emphasis, 'hidden'>;
}
export interface SceneCallout {
  entityId: EntityId;
  text: LocalizedText;
}
export interface SceneProjection {
  view: ViewMode;
  entityStates: Readonly<Record<EntityId, EntityProjection>>;
  relationStates: Readonly<Record<RelationId, RelationProjection>>;
  callouts: readonly SceneCallout[];
  cameraPresetId: string;
}

export type EntitySelector =
  | { byIds: EntityId[] }
  | { byKind: string; namespace?: string | undefined }
  | { byLabel: { key: string; value: string }; namespace?: string | undefined }
  | { byCategory: EntityCategory }
  | { byNode: string };

export interface ProjectionRule {
  selector: EntitySelector;
  visible?: boolean | undefined;
  emphasis?: Emphasis | undefined;
  statusOverride?: EntityStatus | undefined;
  labelMode?: 'none' | 'short' | 'full' | undefined;
  allowEmpty?: boolean | undefined;
}
export interface RelationProjectionRule {
  byType?: string | undefined;
  byIds?: RelationId[] | undefined;
  visible?: boolean | undefined;
  emphasis?: Exclude<Emphasis, 'hidden'> | undefined;
  allowEmpty?: boolean | undefined;
}
export interface SceneProjectionPatch {
  view?: ViewMode | undefined;
  cameraPresetId?: string | undefined;
  resetEntities?: boolean | undefined;
  entityRules?: ProjectionRule[] | undefined;
  relationRules?: RelationProjectionRule[] | undefined;
  callouts?: SceneCallout[] | undefined;
}

export type FlowKind = 'data-packet' | 'dns-query' | 'api-request';
export type TransitionCue =
  | { type: FlowKind; path: EntityId[]; label: LocalizedText; durationMs: number }
  | { type: 'focus-camera'; entityId: EntityId; durationMs: number }
  | { type: 'layout-transition'; durationMs: number }
  | { type: 'reconcile-pulse'; entityId: EntityId; durationMs: number }
  | { type: 'lifecycle'; entityId: EntityId; state: EntityStatus; durationMs: number }
  | { type: 'status-change'; entityId: EntityId; state: EntityStatus; durationMs: number }
  | { type: 'relation-reveal'; relationId: RelationId; durationMs: number }
  | { type: 'callout'; entityId: EntityId; label: LocalizedText; durationMs: number };

export interface LessonStep {
  id: string;
  title: LocalizedText;
  learningOutcome: LocalizedText;
  narration: LocalizedText;
  introducesTerms: string[];
  usesTerms: string[];
  sourceIds: SourceId[];
  projectionPatch: SceneProjectionPatch;
  transition: TransitionCue[];
}
export interface Lesson {
  schemaVersion: 1;
  id: string;
  scenarioId: string;
  chapterId: string;
  title: LocalizedText;
  summary: LocalizedText;
  learningOutcome: LocalizedText;
  prerequisites: string[];
  sourceIds: SourceId[];
  verifiedAt: string;
  baseProjection: SceneProjectionPatch;
  steps: LessonStep[];
}
export interface LessonManifestEntry {
  id: string;
  chapterId: string;
  status: 'available' | 'planned';
  prerequisites: string[];
  title: LocalizedText;
  learningOutcome: LocalizedText;
  estimatedMinutes: number;
}
export interface CourseManifest {
  schemaVersion: 1;
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  lessonOrder: string[];
  lessons: LessonManifestEntry[];
}
export interface SourceEntry {
  id: SourceId;
  title: string;
  authority: string;
  url: string;
  verifiedAt: string;
  type: 'official-documentation';
}
export interface GlossaryTerm {
  id: string;
  term: LocalizedText;
  definition: LocalizedText;
  sourceIds: SourceId[];
}
export interface CompiledLesson {
  lesson: Lesson;
  projections: readonly SceneProjection[];
  transitions: readonly (readonly TransitionCue[])[];
}
