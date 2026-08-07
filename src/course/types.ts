import type {
  EntityId,
  EntityStatus,
  LocalizedText,
  RelationId,
  SourceId,
  WorldDiff,
  WorldPatch,
  WorldSnapshot,
} from '../world/types';

export type ViewMode =
  | 'overview'
  | 'logical'
  | 'placement'
  | 'control-flow'
  | 'traffic'
  | 'storage';
export type Emphasis = 'normal' | 'focused' | 'dimmed' | 'hidden';
export type LabelMode = 'none' | 'short' | 'full';

export interface EntityViewState {
  readonly visible: boolean;
  readonly emphasis: Emphasis;
  readonly labelMode: LabelMode;
  readonly inspectorMode?: 'none' | 'compact' | 'expanded';
}

export interface RelationViewState {
  readonly visible: boolean;
  readonly emphasis: Exclude<Emphasis, 'hidden'>;
}

export interface SceneCallout {
  readonly id: string;
  readonly entityId: EntityId;
  readonly text: LocalizedText;
}

export interface ComparisonRowModel {
  readonly property: LocalizedText;
  readonly containerRestart: string;
  readonly podReplacement: string;
}

export interface ComparisonPanelModel {
  readonly title: LocalizedText;
  readonly rows: readonly ComparisonRowModel[];
}

export interface ViewProjection {
  readonly view: ViewMode;
  readonly cameraPresetId: string;
  readonly entityStates: Readonly<Record<EntityId, EntityViewState>>;
  readonly relationStates: Readonly<Record<RelationId, RelationViewState>>;
  readonly callouts: readonly SceneCallout[];
  readonly comparison?: ComparisonPanelModel;
}

export type EntitySelector =
  | { readonly byIds: readonly EntityId[] }
  | { readonly byKind: string; readonly namespace?: string }
  | {
      readonly byLabel: { readonly key: string; readonly value: string };
      readonly namespace?: string;
    }
  | {
      readonly byCategory:
        | 'api-object'
        | 'runtime-instance'
        | 'runtime-component'
        | 'infrastructure'
        | 'external';
    }
  | { readonly byNode: string };

export interface EntityViewRule {
  readonly selector: EntitySelector;
  readonly visible?: boolean;
  readonly emphasis?: Emphasis;
  readonly labelMode?: LabelMode;
  readonly inspectorMode?: 'none' | 'compact' | 'expanded';
  readonly allowEmpty?: boolean;
}

export interface RelationViewRule {
  readonly byType?: string;
  readonly byIds?: readonly RelationId[];
  readonly visible?: boolean;
  readonly emphasis?: Exclude<Emphasis, 'hidden'>;
  readonly allowEmpty?: boolean;
}

export interface ComparisonRequest {
  readonly type: 'container-restart-vs-pod-replacement';
  readonly restartStepId: string;
  readonly replacementStepId: string;
}

export interface ViewProjectionPatch {
  readonly view?: ViewMode;
  readonly cameraPresetId?: string;
  readonly resetEntities?: boolean;
  readonly entityRules?: readonly EntityViewRule[];
  readonly relationRules?: readonly RelationViewRule[];
  readonly callouts?: readonly SceneCallout[];
  readonly comparison?: ComparisonRequest;
}

interface TimedCue {
  readonly durationMs: number;
}

export type TransitionCue =
  | ({
      readonly type: 'data-packet' | 'dns-query' | 'api-request';
      readonly path: readonly EntityId[];
      readonly label: LocalizedText;
    } & TimedCue)
  | ({ readonly type: 'focus-camera'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'layout-transition' } & TimedCue)
  | ({ readonly type: 'container-failure'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'container-restart'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'entity-exit'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'entity-enter'; readonly entityId: EntityId } & TimedCue)
  | ({
      readonly type: 'reconcile-pulse';
      readonly fromEntityId: EntityId;
      readonly toEntityId: EntityId;
    } & TimedCue)
  | ({
      readonly type: 'scheduler-assignment';
      readonly schedulerId: EntityId;
      readonly podId: EntityId;
      readonly nodeId: EntityId;
    } & TimedCue)
  | ({
      readonly type: 'counter-change';
      readonly entityId: EntityId;
      readonly field: string;
      readonly from: number;
      readonly to: number;
    } & TimedCue)
  | ({ readonly type: 'relation-reveal'; readonly relationId: RelationId } & TimedCue)
  | ({
      readonly type: 'callout';
      readonly entityId: EntityId;
      readonly label: LocalizedText;
    } & TimedCue);

export interface TransitionPlan {
  readonly cues: readonly TransitionCue[];
}

export interface PlaybackRequest {
  readonly stepKey: string;
  readonly playbackId: number;
  readonly transition: TransitionPlan;
}

export interface LessonStepV2 {
  readonly id: string;
  readonly title: LocalizedText;
  readonly learningOutcome: LocalizedText;
  readonly narration: LocalizedText;
  readonly introducesTerms: readonly string[];
  readonly usesTerms: readonly string[];
  readonly sourceIds: readonly SourceId[];
  readonly worldPatch?: WorldPatch;
  readonly viewPatch: ViewProjectionPatch;
  readonly transition?: TransitionPlan;
}

export interface LessonV2 {
  readonly schemaVersion: 2;
  readonly id: string;
  readonly scenarioId: string;
  readonly chapterId: string;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly learningOutcome: LocalizedText;
  readonly prerequisites: readonly string[];
  readonly sourceIds: readonly SourceId[];
  readonly verifiedAt: string;
  readonly baseView: ViewProjectionPatch;
  readonly steps: readonly LessonStepV2[];
}

export interface CompiledStep {
  readonly lessonId: string;
  readonly stepId: string;
  readonly index: number;
  readonly beforeWorld: WorldSnapshot;
  readonly world: WorldSnapshot;
  readonly worldDiff: WorldDiff;
  readonly view: ViewProjection;
  readonly transition: TransitionPlan;
}

export interface CompiledLesson {
  readonly lesson: LessonV2;
  readonly initialWorld: WorldSnapshot;
  readonly steps: readonly CompiledStep[];
}

export interface LessonManifestEntry {
  readonly id: string;
  readonly chapterId: string;
  readonly status: 'available' | 'planned';
  readonly prerequisites: readonly string[];
  readonly title: LocalizedText;
  readonly learningOutcome: LocalizedText;
  readonly estimatedMinutes: number;
}

export interface CourseManifest {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly title: LocalizedText;
  readonly summary: LocalizedText;
  readonly lessonOrder: readonly string[];
  readonly lessons: readonly LessonManifestEntry[];
}

export interface SourceEntry {
  readonly id: SourceId;
  readonly title: string;
  readonly authority: string;
  readonly url: string;
  readonly verifiedAt: string;
  readonly type: 'official-documentation';
}

export interface GlossaryTerm {
  readonly id: string;
  readonly term: LocalizedText;
  readonly definition: LocalizedText;
  readonly sourceIds: readonly SourceId[];
}

export function isStatus(value: unknown): value is EntityStatus {
  return typeof value === 'string';
}
