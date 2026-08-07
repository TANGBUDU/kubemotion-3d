import { parse } from 'yaml';
import courseRaw from '../../content/courses/kubernetes-foundations/course.yaml?raw';
import lesson1Raw from '../../content/courses/kubernetes-foundations/lessons/cluster-overview.yaml?raw';
import lesson2Raw from '../../content/courses/kubernetes-foundations/lessons/pod-and-placement.yaml?raw';
import lesson3Raw from '../../content/courses/kubernetes-foundations/lessons/manifest-to-running-pod.yaml?raw';
import lesson4Raw from '../../content/courses/kubernetes-foundations/lessons/service-and-endpoints.yaml?raw';
import lesson5Raw from '../../content/courses/kubernetes-foundations/lessons/container-restart-vs-pod-replacement.yaml?raw';
import foundationsRaw from '../../content/glossary/foundations.yaml?raw';
import lifecycleRaw from '../../content/glossary/lifecycle.yaml?raw';
import networkingRaw from '../../content/glossary/networking.yaml?raw';
import scenarioRaw from '../../content/scenarios/demo-shop.yaml?raw';
import sourcesRaw from '../../content/sources.yaml?raw';
import { sourceId } from '../domain/ids';
import type { ClusterSnapshot } from '../domain/types';
import type { CourseManifest, GlossaryTerm, Lesson, SourceEntry } from '../course/types';
import {
  courseSchema,
  glossarySchema,
  lessonSchema,
  scenarioSchema,
  sourcesSchema,
} from './schemas';

const parseYaml = (raw: string): unknown => parse(raw, { merge: true });

export const scenario: ClusterSnapshot = scenarioSchema.parse(parseYaml(scenarioRaw));
export const course: CourseManifest = courseSchema.parse(parseYaml(courseRaw));
export const lessons: readonly Lesson[] = [
  lesson1Raw,
  lesson2Raw,
  lesson3Raw,
  lesson4Raw,
  lesson5Raw,
].map((raw) => lessonSchema.parse(parseYaml(raw)));

export const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));
export const glossary: readonly GlossaryTerm[] = [
  foundationsRaw,
  networkingRaw,
  lifecycleRaw,
].flatMap((raw) => glossarySchema.parse(parseYaml(raw)).terms);
export const glossaryById = new Map(glossary.map((term) => [term.id, term]));

const parsedSources = sourcesSchema.parse(parseYaml(sourcesRaw));
export const sources = new Map<string, SourceEntry>(
  Object.entries(parsedSources.sources).map(([id, entry]) => [id, { id: sourceId(id), ...entry }]),
);
