import { z } from 'zod';
import type { EntityId, RelationId, SourceId } from '../domain/types';

const localizedText = z
  .object({
    en: z.string().min(1),
    ja: z.string().min(1),
    'zh-CN': z.string().min(1),
  })
  .strict();
const entityId = z.custom<EntityId>(
  (value) => typeof value === 'string' && value.split(':').length >= 5,
);
const relationId = z.custom<RelationId>((value) => typeof value === 'string' && value.length > 0);
const sourceId = z.custom<SourceId>((value) => typeof value === 'string' && value.length > 0);
const status = z.enum([
  'healthy',
  'ready',
  'not-ready',
  'pending',
  'starting',
  'terminating',
  'failed',
  'unknown',
]);

export const entitySchema = z.object({
  id: entityId,
  category: z.enum(['api-object', 'runtime-component', 'infrastructure', 'external']),
  kind: z.string().min(1),
  name: z.string().min(1),
  scope: z.enum(['namespaced', 'cluster', 'node', 'external']),
  namespace: z.string().min(1).optional(),
  nodeName: z.string().min(1).optional(),
  labels: z.record(z.string(), z.string()).optional(),
  annotations: z.record(z.string(), z.string()).optional(),
  status,
  semantics: z.object({
    participatesInDataPath: z.boolean(),
    participatesInControlPath: z.boolean(),
    isConfiguration: z.boolean(),
    isRuntime: z.boolean(),
  }),
  title: localizedText,
  summary: localizedText,
  details: localizedText.optional(),
  sourceIds: z.array(sourceId),
  visual: z.object({
    archetype: z.enum([
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
    ]),
    size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
    group: z.string().optional(),
  }),
  data: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const relationSchema = z.object({
  id: relationId,
  type: z.enum([
    'owns',
    'scoped-by',
    'scheduled-on',
    'selects',
    'contains-endpoint-for',
    'references',
    'configured-by',
    'implemented-by',
    'mounts',
    'binds-to',
    'stores-in',
    'watches',
    'reports-to',
  ]),
  from: entityId,
  to: entityId,
  semantic: z.enum([
    'ownership',
    'scope',
    'placement',
    'selection',
    'configuration',
    'storage',
    'control-observation',
  ]),
  directed: z.boolean(),
  title: localizedText,
  sourceIds: z.array(sourceId),
});

export const scenarioSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: localizedText,
  description: localizedText,
  generatedAt: z.iso.datetime(),
  synthetic: z.literal(true),
  entities: z.array(entitySchema),
  relations: z.array(relationSchema),
  sourceIds: z.array(sourceId),
});

const selectorSchema = z.union([
  z.object({ byIds: z.array(entityId) }),
  z.object({ byKind: z.string(), namespace: z.string().optional() }),
  z.object({
    byLabel: z.object({ key: z.string(), value: z.string() }),
    namespace: z.string().optional(),
  }),
  z.object({
    byCategory: z.enum(['api-object', 'runtime-component', 'infrastructure', 'external']),
  }),
  z.object({ byNode: z.string() }),
]);
const entityRuleSchema = z.object({
  selector: selectorSchema,
  visible: z.boolean().optional(),
  emphasis: z.enum(['normal', 'focused', 'dimmed', 'hidden']).optional(),
  statusOverride: status.optional(),
  labelMode: z.enum(['none', 'short', 'full']).optional(),
  allowEmpty: z.boolean().optional(),
});
const relationRuleSchema = z.object({
  byType: z.string().optional(),
  byIds: z.array(relationId).optional(),
  visible: z.boolean().optional(),
  emphasis: z.enum(['normal', 'focused', 'dimmed']).optional(),
  allowEmpty: z.boolean().optional(),
});
const patchSchema = z.object({
  view: z.enum(['overview', 'logical', 'placement', 'control-flow', 'traffic']).optional(),
  cameraPresetId: z.string().optional(),
  resetEntities: z.boolean().optional(),
  entityRules: z.array(entityRuleSchema).optional(),
  relationRules: z.array(relationRuleSchema).optional(),
  callouts: z.array(z.object({ entityId, text: localizedText })).optional(),
});
const flowTransition = (type: 'data-packet' | 'dns-query' | 'api-request') =>
  z.object({
    type: z.literal(type),
    path: z.array(entityId).min(2),
    label: localizedText,
    durationMs: z.number().int().min(300).max(4000),
  });
const transitionSchema = z.discriminatedUnion('type', [
  flowTransition('data-packet'),
  flowTransition('dns-query'),
  flowTransition('api-request'),
  z.object({
    type: z.literal('focus-camera'),
    entityId,
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('layout-transition'),
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('reconcile-pulse'),
    entityId,
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('lifecycle'),
    entityId,
    state: status,
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('status-change'),
    entityId,
    state: status,
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('relation-reveal'),
    relationId,
    durationMs: z.number().int().min(300).max(4000),
  }),
  z.object({
    type: z.literal('callout'),
    entityId,
    label: localizedText,
    durationMs: z.number().int().min(300).max(4000),
  }),
]);

export const lessonSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  scenarioId: z.string(),
  chapterId: z.string(),
  title: localizedText,
  summary: localizedText,
  learningOutcome: localizedText,
  prerequisites: z.array(z.string()),
  sourceIds: z.array(sourceId),
  verifiedAt: z.iso.date(),
  baseProjection: patchSchema,
  steps: z
    .array(
      z.object({
        id: z.string(),
        title: localizedText,
        learningOutcome: localizedText,
        narration: localizedText,
        introducesTerms: z.array(z.string()),
        usesTerms: z.array(z.string()),
        sourceIds: z.array(sourceId),
        projectionPatch: patchSchema,
        transition: z.array(transitionSchema),
      }),
    )
    .min(1),
});

const manifestEntrySchema = z.object({
  id: z.string(),
  chapterId: z.string(),
  status: z.enum(['available', 'planned']),
  prerequisites: z.array(z.string()),
  title: localizedText,
  learningOutcome: localizedText,
  estimatedMinutes: z.number().int().positive(),
});
export const courseSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: localizedText,
  summary: localizedText,
  lessonOrder: z.array(z.string()),
  lessons: z.array(manifestEntrySchema),
});
export const sourcesSchema = z.object({
  schemaVersion: z.literal(1),
  sources: z.record(
    z.string(),
    z.object({
      title: z.string(),
      authority: z.string(),
      url: z.url().startsWith('https://'),
      verifiedAt: z.iso.date(),
      type: z.literal('official-documentation'),
    }),
  ),
});
export const glossarySchema = z.object({
  schemaVersion: z.literal(1),
  terms: z.array(
    z.object({
      id: z.string(),
      term: localizedText,
      definition: localizedText.refine(
        (value) => Object.values(value).every((text) => text.length <= 240),
        'Glossary definitions must be at most 240 characters',
      ),
      sourceIds: z.array(sourceId),
    }),
  ),
});
