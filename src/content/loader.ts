import { parse } from 'yaml';
import courseRaw from '../../content/courses/kubernetes-foundations/course.yaml?raw';
import goldenLessonRaw from '../../content/courses/kubernetes-foundations/lessons/container-restart-vs-pod-replacement.yaml?raw';
import foundationsRaw from '../../content/glossary/foundations.yaml?raw';
import lifecycleRaw from '../../content/glossary/lifecycle.yaml?raw';
import networkingRaw from '../../content/glossary/networking.yaml?raw';
import goldenScenarioRaw from '../../content/scenarios/container-restart-golden.yaml?raw';
import sourcesRaw from '../../content/sources.yaml?raw';
import type { CourseManifest, GlossaryTerm, LessonV2, SourceEntry } from '../course/types';
import { validateWorldSnapshot } from '../world/validation';
import type { WorldSnapshot } from '../world/types';
import {
  courseSchema,
  glossarySchema,
  lessonV2Schema,
  scenarioV2AuthorSchema,
  sourcesSchema,
} from './schemas';

const parseYaml = (raw: string): unknown => parse(raw, { merge: true });

function authoringScenarioToWorld(raw: string): WorldSnapshot {
  const authored = scenarioV2AuthorSchema.parse(parseYaml(raw));
  const entities: Record<string, (typeof authored.entities)[number]> = {};
  const relations: Record<string, (typeof authored.relations)[number]> = {};
  for (const entity of authored.entities) {
    if (entities[entity.id]) throw new Error(`Duplicate entity ID: ${entity.id}`);
    entities[entity.id] = entity;
  }
  for (const relation of authored.relations) {
    if (relations[relation.id]) throw new Error(`Duplicate relation ID: ${relation.id}`);
    relations[relation.id] = relation;
  }
  return validateWorldSnapshot({
    schemaVersion: 2,
    scenarioId: authored.scenarioId,
    revision: authored.revision,
    entities,
    relations,
  });
}

export const scenario: WorldSnapshot = authoringScenarioToWorld(goldenScenarioRaw);
export const course: CourseManifest = courseSchema.parse(parseYaml(courseRaw));
export const lessons: readonly LessonV2[] = [
  lessonV2Schema.parse(parseYaml(goldenLessonRaw)) as unknown as LessonV2,
];
export const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export const glossary: readonly GlossaryTerm[] = [
  foundationsRaw,
  networkingRaw,
  lifecycleRaw,
].flatMap((raw) => glossarySchema.parse(parseYaml(raw)).terms);
export const glossaryById = new Map(glossary.map((term) => [term.id, term]));

const parsedSources = sourcesSchema.parse(parseYaml(sourcesRaw));
export const sources = new Map<string, SourceEntry>(
  Object.entries(parsedSources.sources).map(([id, entry]) => [id, { id, ...entry }]),
);
