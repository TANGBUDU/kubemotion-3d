import { z } from 'zod';
import {
  VISUAL_ARCHETYPES,
  WORLD_ENTITY_CATEGORIES,
  WORLD_ENTITY_STATUSES,
  WORLD_RELATION_SEMANTICS,
  WORLD_RELATION_TYPES,
} from '../world/types';

export const localizedTextSchema = z
  .object({
    en: z.string().min(1),
    ja: z.string().min(1),
    'zh-CN': z.string().min(1),
  })
  .strict();

const entityIdSchema = z
  .string()
  .min(3)
  .refine((value) => value.includes(':'), 'Entity IDs must be semantic, colon-delimited IDs');
const relationIdSchema = z.string().min(1);
const sourceIdSchema = z.string().min(1);
const dataSchema = z.record(z.string(), z.unknown());

export const worldEntitySchema = z
  .object({
    id: entityIdSchema,
    category: z.enum(WORLD_ENTITY_CATEGORIES),
    kind: z.string().min(1),
    name: z.string().min(1),
    namespace: z.string().min(1).optional(),
    labels: z.record(z.string(), z.string()).optional(),
    status: z.enum(WORLD_ENTITY_STATUSES),
    data: dataSchema,
    title: localizedTextSchema,
    summary: localizedTextSchema,
    sourceIds: z.array(sourceIdSchema),
    visual: z
      .object({
        archetype: z.enum(VISUAL_ARCHETYPES),
        size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).optional(),
        group: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const worldRelationSchema = z
  .object({
    id: relationIdSchema,
    type: z.enum(WORLD_RELATION_TYPES),
    from: entityIdSchema,
    to: entityIdSchema,
    directed: z.boolean(),
    semantic: z.enum(WORLD_RELATION_SEMANTICS),
    title: localizedTextSchema,
    sourceIds: z.array(sourceIdSchema),
    data: dataSchema.optional(),
  })
  .strict();

export const scenarioV2AuthorSchema = z
  .object({
    schemaVersion: z.literal(2),
    scenarioId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    entities: z.array(worldEntitySchema),
    relations: z.array(worldRelationSchema),
  })
  .strict();

const entityPatchSchema = z
  .object({
    category: z.enum(WORLD_ENTITY_CATEGORIES).optional(),
    kind: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    namespace: z.string().min(1).nullable().optional(),
    labels: z.record(z.string(), z.string().nullable()).nullable().optional(),
    status: z.enum(WORLD_ENTITY_STATUSES).optional(),
    data: dataSchema.optional(),
    title: localizedTextSchema.optional(),
    summary: localizedTextSchema.optional(),
    sourceIds: z.array(sourceIdSchema).optional(),
    visual: z
      .object({
        archetype: z.enum(VISUAL_ARCHETYPES).optional(),
        size: z.enum(['xs', 'sm', 'md', 'lg', 'xl']).nullable().optional(),
        group: z.string().nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const relationPatchSchema = z
  .object({
    type: z.enum(WORLD_RELATION_TYPES).optional(),
    from: entityIdSchema.optional(),
    to: entityIdSchema.optional(),
    directed: z.boolean().optional(),
    semantic: z.enum(WORLD_RELATION_SEMANTICS).optional(),
    title: localizedTextSchema.optional(),
    sourceIds: z.array(sourceIdSchema).optional(),
    data: dataSchema.nullable().optional(),
  })
  .strict();

const worldOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add-entity'), entity: worldEntitySchema }).strict(),
  z
    .object({
      op: z.literal('remove-entity'),
      entityId: entityIdSchema,
      allowMissing: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({ op: z.literal('patch-entity'), entityId: entityIdSchema, patch: entityPatchSchema })
    .strict(),
  z.object({ op: z.literal('add-relation'), relation: worldRelationSchema }).strict(),
  z
    .object({
      op: z.literal('remove-relation'),
      relationId: relationIdSchema,
      allowMissing: z.literal(true).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('patch-relation'),
      relationId: relationIdSchema,
      patch: relationPatchSchema,
    })
    .strict(),
]);

export const worldPatchSchema = z.object({ operations: z.array(worldOperationSchema) }).strict();

const selectorSchema = z.union([
  z.object({ byIds: z.array(entityIdSchema) }).strict(),
  z.object({ byKind: z.string(), namespace: z.string().optional() }).strict(),
  z
    .object({
      byLabel: z.object({ key: z.string(), value: z.string() }).strict(),
      namespace: z.string().optional(),
    })
    .strict(),
  z.object({ byCategory: z.enum(WORLD_ENTITY_CATEGORIES) }).strict(),
  z.object({ byNode: z.string() }).strict(),
]);

const entityViewRuleSchema = z
  .object({
    selector: selectorSchema,
    visible: z.boolean().optional(),
    emphasis: z.enum(['normal', 'focused', 'dimmed', 'hidden']).optional(),
    labelMode: z.enum(['none', 'short', 'full']).optional(),
    inspectorMode: z.enum(['none', 'compact', 'expanded']).optional(),
    allowEmpty: z.boolean().optional(),
  })
  .strict();

const relationViewRuleSchema = z
  .object({
    byType: z.string().optional(),
    byIds: z.array(relationIdSchema).optional(),
    visible: z.boolean().optional(),
    emphasis: z.enum(['normal', 'focused', 'dimmed']).optional(),
    allowEmpty: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Boolean(value.byType || value.byIds), 'Relation rules need byType or byIds');

const calloutSchema = z
  .object({ id: z.string().min(1), entityId: entityIdSchema, text: localizedTextSchema })
  .strict();

const routeAnchorKindSchema = z.enum([
  'center',
  'label',
  'ownership',
  'placement',
  'control',
  'data-path',
  'composition',
]);

const routeHopSchema = z
  .object({
    fromEntityId: entityIdSchema,
    fromAnchor: routeAnchorKindSchema,
    toEntityId: entityIdSchema,
    toAnchor: routeAnchorKindSchema,
    label: localizedTextSchema.optional(),
  })
  .strict();

const activeTeachingRouteSchema = z
  .object({
    id: z.string().min(1),
    semantic: z.enum(['control', 'scheduling', 'data-flow', 'dns']),
    hops: z.array(routeHopSchema).min(1),
    label: localizedTextSchema.optional(),
    persistAfterAnimation: z.boolean(),
    numbered: z.boolean().optional(),
  })
  .strict();

const comparisonRequestSchema = z
  .object({
    type: z.literal('container-restart-vs-pod-replacement'),
    restartStepId: z.string().min(1),
    replacementStepId: z.string().min(1),
  })
  .strict();

export const viewProjectionPatchSchema = z
  .object({
    view: z
      .enum(['overview', 'logical', 'placement', 'control-flow', 'traffic', 'storage'])
      .optional(),
    cameraPresetId: z.string().min(1).optional(),
    resetEntities: z.boolean().optional(),
    entityRules: z.array(entityViewRuleSchema).optional(),
    relationRules: z.array(relationViewRuleSchema).optional(),
    callouts: z.array(calloutSchema).optional(),
    activeRoutes: z.array(activeTeachingRouteSchema).optional(),
    comparison: comparisonRequestSchema.optional(),
  })
  .strict();

const durationMs = z.number().int().min(80).max(6000);
const delayMs = z.number().int().min(0).max(6000).optional();
const transitionCueSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('data-packet'),
      routeId: z.string().min(1),
      label: localizedTextSchema,
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('dns-query'),
      routeId: z.string().min(1),
      label: localizedTextSchema,
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('api-request'),
      routeId: z.string().min(1),
      label: localizedTextSchema,
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({ type: z.literal('focus-camera'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({
      type: z.literal('layout-transition'),
      entityIds: z.array(entityIdSchema).min(1).optional(),
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({ type: z.literal('container-failure'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({ type: z.literal('container-restart'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({ type: z.literal('container-start'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({ type: z.literal('entity-exit'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({ type: z.literal('entity-enter'), entityId: entityIdSchema, durationMs, delayMs })
    .strict(),
  z
    .object({
      type: z.literal('reconcile-pulse'),
      fromEntityId: entityIdSchema,
      toEntityId: entityIdSchema,
      routeId: z.string().min(1),
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('scheduler-assignment'),
      schedulerId: entityIdSchema,
      podId: entityIdSchema,
      nodeId: entityIdSchema,
      routeId: z.string().min(1),
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('counter-change'),
      entityId: entityIdSchema,
      field: z.string().min(1),
      from: z.number(),
      to: z.number(),
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('relation-reveal'),
      relationId: relationIdSchema,
      durationMs,
      delayMs,
    })
    .strict(),
  z
    .object({
      type: z.literal('callout'),
      entityId: entityIdSchema,
      label: localizedTextSchema,
      durationMs,
      delayMs,
    })
    .strict(),
]);

export const transitionPlanSchema = z.object({ cues: z.array(transitionCueSchema) }).strict();

export const lessonV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    id: z.string().min(1),
    scenarioId: z.string().min(1),
    chapterId: z.string().min(1),
    title: localizedTextSchema,
    summary: localizedTextSchema,
    learningOutcome: localizedTextSchema,
    prerequisites: z.array(z.string()),
    sourceIds: z.array(sourceIdSchema),
    verifiedAt: z.iso.date(),
    baseView: viewProjectionPatchSchema,
    steps: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: localizedTextSchema,
            learningOutcome: localizedTextSchema,
            narration: localizedTextSchema,
            teaching: z
              .object({
                whatChanged: localizedTextSchema,
                whyItHappened: localizedTextSchema,
                takeaway: localizedTextSchema,
              })
              .strict(),
            evidence: z
              .object({
                entityIds: z.array(entityIdSchema),
                mode: z.enum(['none', 'snapshot', 'diff', 'diff-with-context']),
              })
              .strict(),
            introducesTerms: z.array(z.string()),
            usesTerms: z.array(z.string()),
            sourceIds: z.array(sourceIdSchema),
            worldPatch: worldPatchSchema.optional(),
            viewPatch: viewProjectionPatchSchema,
            transition: transitionPlanSchema.optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

/** Identifies retained v1 lesson files without reinterpreting them as v2. */
export const legacyLessonMarkerSchema = z
  .object({ schemaVersion: z.literal(1), id: z.string().min(1), scenarioId: z.string().min(1) })
  .passthrough();

const manifestEntrySchema = z
  .object({
    id: z.string(),
    chapterId: z.string(),
    status: z.enum(['available', 'planned']),
    prerequisites: z.array(z.string()),
    title: localizedTextSchema,
    learningOutcome: localizedTextSchema,
    estimatedMinutes: z.number().int().positive(),
  })
  .strict();

export const courseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string(),
    title: localizedTextSchema,
    summary: localizedTextSchema,
    lessonOrder: z.array(z.string()),
    lessons: z.array(manifestEntrySchema),
  })
  .strict();

export const sourcesSchema = z
  .object({
    schemaVersion: z.literal(1),
    sources: z.record(
      z.string(),
      z
        .object({
          title: z.string(),
          authority: z.string(),
          url: z.url().startsWith('https://'),
          verifiedAt: z.iso.date(),
          type: z.literal('official-documentation'),
        })
        .strict(),
    ),
  })
  .strict();

export const glossarySchema = z
  .object({
    schemaVersion: z.literal(1),
    terms: z.array(
      z
        .object({
          id: z.string(),
          term: localizedTextSchema,
          definition: localizedTextSchema.refine(
            (value) => Object.values(value).every((text) => text.length <= 240),
            'Glossary definitions must be at most 240 characters',
          ),
          sourceIds: z.array(sourceIdSchema),
        })
        .strict(),
    ),
  })
  .strict();
