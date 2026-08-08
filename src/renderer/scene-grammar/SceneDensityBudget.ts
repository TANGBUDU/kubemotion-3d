export type SceneViewportClass = 'desktop' | 'mobile';

export interface SceneDensityBudget {
  readonly maxPrimaryEntities: number;
  readonly maxSecondaryEntities: number;
  readonly maxEntityLabels: number;
  readonly maxRelationLabels: number;
  readonly maxFocusedEntities: number;
  readonly maxAnimatedTokens: number;
  readonly maxRelationFamilies: number;
}

/** Directive-level ceilings shared by every view grammar. */
export const DESKTOP_SCENE_DENSITY_BUDGET: SceneDensityBudget = Object.freeze({
  maxPrimaryEntities: 12,
  maxSecondaryEntities: 8,
  maxEntityLabels: 7,
  maxRelationLabels: 3,
  maxFocusedEntities: 3,
  maxAnimatedTokens: 6,
  maxRelationFamilies: 2,
});

export const MOBILE_SCENE_DENSITY_BUDGET: SceneDensityBudget = Object.freeze({
  maxPrimaryEntities: 7,
  maxSecondaryEntities: 3,
  maxEntityLabels: 3,
  maxRelationLabels: 1,
  maxFocusedEntities: 2,
  maxAnimatedTokens: 3,
  maxRelationFamilies: 2,
});
