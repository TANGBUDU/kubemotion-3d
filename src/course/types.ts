import type {
  EntityId,
  LocalizedText,
  RelationId,
  SourceId,
  WorldDiff,
  WorldEntityCategory,
  WorldPatch,
  WorldSnapshot,
} from '../world/types';

export type ViewMode =
  'overview' | 'logical' | 'placement' | 'control-flow' | 'traffic' | 'storage';
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

export type RouteAnchorKind =
  'center' | 'label' | 'ownership' | 'placement' | 'control' | 'data-path' | 'composition';

export type RouteSemantic = 'control' | 'scheduling' | 'data-flow' | 'dns' | 'node-runtime';

export interface RouteHop {
  readonly fromEntityId: EntityId;
  readonly fromAnchor: RouteAnchorKind;
  readonly toEntityId: EntityId;
  readonly toAnchor: RouteAnchorKind;
  readonly label?: LocalizedText;
}

export interface ActiveTeachingRoute {
  readonly id: string;
  readonly semantic: RouteSemantic;
  readonly requestId?: string;
  readonly hops: readonly RouteHop[];
  readonly label?: LocalizedText;
  readonly persistAfterAnimation: boolean;
  readonly numbered?: boolean;
}

export interface ComparisonRowModel {
  readonly property: LocalizedText;
  readonly containerRestart: LocalizedText;
  readonly podReplacement: LocalizedText;
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
  readonly activeRoutes: readonly ActiveTeachingRoute[];
  readonly comparison?: ComparisonPanelModel;
}

export type EntitySelector =
  | { readonly byIds: readonly EntityId[] }
  | { readonly byKind: string; readonly namespace?: string }
  | {
      readonly byLabel: { readonly key: string; readonly value: string };
      readonly namespace?: string;
    }
  | { readonly byCategory: WorldEntityCategory }
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
  readonly activeRoutes?: readonly ActiveTeachingRoute[];
  readonly comparison?: ComparisonRequest;
}

interface TimedCue {
  readonly durationMs: number;
  /** Optional causal offset. Reduced-motion playback intentionally collapses this delay. */
  readonly delayMs?: number;
}

type RoutedFlowCue<TType extends 'data-packet' | 'dns-query' | 'api-request'> = {
  readonly type: TType;
  readonly routeId: string;
  readonly label: LocalizedText;
} & TimedCue;

export type TransitionCue =
  | RoutedFlowCue<'data-packet'>
  | RoutedFlowCue<'dns-query'>
  | RoutedFlowCue<'api-request'>
  | ({ readonly type: 'focus-camera'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'layout-transition'; readonly entityIds?: readonly EntityId[] } & TimedCue)
  | ({ readonly type: 'container-failure'; readonly entityId: EntityId } & TimedCue)
  | ({
      readonly type: 'node-runtime-restart';
      readonly routeId: string;
      readonly entityId: EntityId;
    } & TimedCue)
  | ({ readonly type: 'container-restart'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'container-start'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'entity-exit'; readonly entityId: EntityId } & TimedCue)
  | ({ readonly type: 'entity-enter'; readonly entityId: EntityId } & TimedCue)
  | ({
      readonly type: 'reconcile-pulse';
      readonly fromEntityId: EntityId;
      readonly toEntityId: EntityId;
      readonly routeId: string;
    } & TimedCue)
  | ({
      readonly type: 'scheduler-assignment';
      readonly schedulerId: EntityId;
      readonly podId: EntityId;
      readonly nodeId: EntityId;
      readonly routeId: string;
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

export type EvidenceChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export interface EvidenceRow {
  readonly id: string;
  readonly entityId: EntityId;
  readonly change: EvidenceChangeKind;
  readonly label: LocalizedText;
  readonly before?: LocalizedText;
  readonly after?: LocalizedText;
  readonly path?: string;
}

export interface EvidenceRequest {
  readonly entityIds: readonly EntityId[];
  readonly mode: 'none' | 'snapshot' | 'diff' | 'diff-with-context';
}

export interface LessonStepV2 {
  readonly id: string;
  readonly title: LocalizedText;
  readonly learningOutcome: LocalizedText;
  readonly narration: LocalizedText;
  readonly teaching: {
    readonly whatChanged: LocalizedText;
    readonly whyItHappened: LocalizedText;
    readonly takeaway: LocalizedText;
  };
  readonly evidence: EvidenceRequest;
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
  readonly evidence: readonly EvidenceRow[];
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
