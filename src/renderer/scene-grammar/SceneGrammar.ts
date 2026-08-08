import type { RouteSemantic, ViewMode, ViewProjection } from '../../course/types';
import type { EntityId, RelationId, RelationSemantic, WorldSnapshot } from '../../world/types';
import type { SceneDensityBudget, SceneViewportClass } from './SceneDensityBudget';

export type SceneEntityRole = 'primary' | 'secondary';
export type SceneLayoutAlgorithm =
  | 'foundation-islands'
  | 'ownership-lanes'
  | 'node-bays'
  | 'api-causality'
  | 'traffic-lane'
  | 'storage-chain';
export type SceneCameraType = 'orthographic-isometric' | 'low-distortion-perspective';

export interface SceneZoneDefinition {
  readonly id: string;
  readonly allowedKinds: readonly string[];
}

export interface SceneSeparationRules {
  readonly horizontalClearance: number;
  readonly labelClearance: number;
}

export interface SceneRouteRules {
  readonly allowedSemantics: readonly RouteSemantic[];
  readonly requirePersistentRoute: boolean;
  readonly routeParticipantsHavePriority: boolean;
}

export interface SceneAggregationRules {
  readonly aggregateKinds: readonly string[];
  readonly mobileAggregateKinds: readonly string[];
}

/**
 * Declarative contract for one teaching view. Layout code consumes the algorithm and zones in
 * later milestones; M1 uses the same contract as a mandatory visibility/density safety layer.
 */
export interface SceneGrammar {
  readonly id: ViewMode;
  readonly purpose: string;
  readonly allowedEntityKinds: readonly string[];
  readonly defaultHiddenEntityKinds: readonly string[];
  readonly primaryEntityKinds: readonly string[];
  readonly entityKindPriority: readonly string[];
  readonly maxVisibleByKind?: Readonly<Record<string, number>>;
  readonly allowedRelationSemantics: readonly RelationSemantic[];
  readonly defaultHiddenRelationSemantics: readonly RelationSemantic[];
  readonly relationFamilyPriority: readonly RelationSemantic[];
  readonly zones: readonly SceneZoneDefinition[];
  readonly layoutAlgorithm: SceneLayoutAlgorithm;
  readonly cameraType: SceneCameraType;
  readonly routeRules: SceneRouteRules;
  readonly aggregation: SceneAggregationRules;
  readonly separation: SceneSeparationRules;
  readonly budgets: Readonly<Record<SceneViewportClass, SceneDensityBudget>>;
}

export type SceneHiddenReason =
  | 'authored-hidden'
  | 'kind-not-allowed'
  | 'default-hidden'
  | 'kind-budget'
  | 'required-context-missing'
  | 'primary-budget'
  | 'secondary-budget';

export interface EffectiveScenePlan {
  readonly grammarId: ViewMode;
  readonly viewport: SceneViewportClass;
  readonly projection: ViewProjection;
  readonly visibleEntityIds: readonly EntityId[];
  readonly primaryEntityIds: readonly EntityId[];
  readonly secondaryEntityIds: readonly EntityId[];
  readonly visibleRelationIds: readonly RelationId[];
  readonly visibleRelationFamilies: readonly RelationSemantic[];
  readonly hiddenEntityReasons: Readonly<Record<EntityId, SceneHiddenReason>>;
  readonly densityBudget: SceneDensityBudget;
  readonly layoutAlgorithm: SceneLayoutAlgorithm;
  readonly cameraType: SceneCameraType;
  readonly zones: readonly SceneZoneDefinition[];
}

export interface EffectiveScenePlanOptions {
  readonly viewport?: SceneViewportClass;
  /** Apply a grammar's default-hidden rules. Explore uses true; authored lessons use false. */
  readonly applyGrammarDefaults?: boolean;
  /** Let a directly focused Explore match appear as bounded detail-on-demand. */
  readonly allowFocusedKindOverride?: boolean;
}

export type ScenePlanCompiler = (
  world: WorldSnapshot,
  authoredProjection: ViewProjection,
  options?: EffectiveScenePlanOptions,
) => EffectiveScenePlan;
