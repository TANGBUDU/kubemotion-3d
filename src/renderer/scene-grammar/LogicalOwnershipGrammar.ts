import { DESKTOP_SCENE_DENSITY_BUDGET, MOBILE_SCENE_DENSITY_BUDGET } from './SceneDensityBudget';
import type { SceneGrammar } from './SceneGrammar';

export const logicalOwnershipGrammar = Object.freeze({
  id: 'logical',
  purpose: 'Namespace scope and Deployment to ReplicaSet to Pod ownership.',
  allowedEntityKinds: ['Namespace', 'Deployment', 'ReplicaSet', 'Pod', 'Node'],
  defaultHiddenEntityKinds: ['Node'],
  primaryEntityKinds: ['Namespace', 'Deployment', 'ReplicaSet'],
  entityKindPriority: ['Namespace', 'Deployment', 'ReplicaSet', 'Pod', 'Node'],
  maxVisibleByKind: { Namespace: 1, Deployment: 3, ReplicaSet: 3, Pod: 4, Node: 3 },
  allowedRelationSemantics: ['scope', 'ownership', 'placement'],
  defaultHiddenRelationSemantics: ['placement'],
  relationFamilyPriority: ['ownership', 'scope', 'placement'],
  zones: [
    {
      id: 'namespace-workspace',
      allowedKinds: ['Namespace', 'Deployment', 'ReplicaSet', 'Pod'],
    },
    { id: 'placement-context', allowedKinds: ['Node'] },
  ],
  layoutAlgorithm: 'ownership-lanes',
  cameraType: 'orthographic-isometric',
  routeRules: {
    allowedSemantics: ['control'],
    requirePersistentRoute: true,
    routeParticipantsHavePriority: true,
  },
  aggregation: { aggregateKinds: ['Pod'], mobileAggregateKinds: ['Pod'] },
  separation: { horizontalClearance: 0.65, labelClearance: 10 },
  budgets: {
    desktop: {
      ...DESKTOP_SCENE_DENSITY_BUDGET,
      maxPrimaryEntities: 8,
      maxSecondaryEntities: 4,
      maxAnimatedTokens: 2,
    },
    mobile: {
      ...MOBILE_SCENE_DENSITY_BUDGET,
      maxPrimaryEntities: 5,
      maxSecondaryEntities: 2,
      maxAnimatedTokens: 1,
    },
  },
} satisfies SceneGrammar);
