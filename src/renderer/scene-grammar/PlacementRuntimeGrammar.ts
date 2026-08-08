import { DESKTOP_SCENE_DENSITY_BUDGET, MOBILE_SCENE_DENSITY_BUDGET } from './SceneDensityBudget';
import type { SceneGrammar } from './SceneGrammar';

export const placementRuntimeGrammar = Object.freeze({
  id: 'placement',
  purpose: 'Node, Pod bay, Container, and unscheduled Pod placement.',
  allowedEntityKinds: [
    'Cluster',
    'Node',
    'Pod',
    'Container',
    'Kubelet',
    'ContainerRuntime',
    'Scheduler',
    'KubeAPIServer',
  ],
  defaultHiddenEntityKinds: ['Scheduler', 'KubeAPIServer'],
  primaryEntityKinds: ['Node', 'Pod', 'Container'],
  entityKindPriority: [
    'Node',
    'Pod',
    'Container',
    'Kubelet',
    'ContainerRuntime',
    'Scheduler',
    'KubeAPIServer',
    'Cluster',
  ],
  maxVisibleByKind: {
    Cluster: 1,
    Node: 3,
    Pod: 7,
    Container: 7,
    Kubelet: 3,
    ContainerRuntime: 3,
    Scheduler: 1,
    KubeAPIServer: 1,
  },
  allowedRelationSemantics: ['placement', 'composition', 'control-observation'],
  defaultHiddenRelationSemantics: ['control-observation'],
  relationFamilyPriority: ['placement', 'composition', 'control-observation'],
  zones: [
    {
      id: 'worker-node-chassis',
      allowedKinds: ['Node', 'Pod', 'Container', 'Kubelet', 'ContainerRuntime'],
    },
    { id: 'unscheduled-queue', allowedKinds: ['Pod'] },
    { id: 'scheduling-context', allowedKinds: ['Scheduler', 'KubeAPIServer'] },
  ],
  layoutAlgorithm: 'node-bays',
  cameraType: 'orthographic-isometric',
  routeRules: {
    allowedSemantics: ['scheduling', 'node-runtime'],
    requirePersistentRoute: true,
    routeParticipantsHavePriority: true,
  },
  aggregation: { aggregateKinds: ['Pod'], mobileAggregateKinds: ['Pod', 'Node'] },
  separation: { horizontalClearance: 0.6, labelClearance: 10 },
  budgets: {
    desktop: {
      ...DESKTOP_SCENE_DENSITY_BUDGET,
      maxPrimaryEntities: 11,
      maxSecondaryEntities: 6,
      maxRelationLabels: 2,
      maxAnimatedTokens: 2,
    },
    mobile: {
      ...MOBILE_SCENE_DENSITY_BUDGET,
      maxPrimaryEntities: 6,
      maxSecondaryEntities: 2,
      maxAnimatedTokens: 1,
    },
  },
} satisfies SceneGrammar);
