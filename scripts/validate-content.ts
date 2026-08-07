import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import {
  courseSchema,
  glossarySchema,
  lessonSchema,
  scenarioSchema,
  sourcesSchema,
} from '../src/content/schemas';
import { createClusterGraph } from '../src/domain/clusterGraph';
import { courseEngine } from '../src/course/CourseEngine';
import type { Lesson } from '../src/course/types';

const root = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const yaml = (path: string): unknown => {
  try {
    return parse(read(path), { merge: true });
  } catch (error) {
    throw new Error(`${path}: YAML parse failed: ${String(error)}`, { cause: error });
  }
};
const lessonDirectory = 'content/courses/kubernetes-foundations/lessons';
const lessonFiles = readdirSync(resolve(root, lessonDirectory)).filter((file) =>
  file.endsWith('.yaml'),
);

const sourcesData = sourcesSchema.parse(yaml('content/sources.yaml'));
const scenario = scenarioSchema.parse(yaml('content/scenarios/demo-shop.yaml'));
const course = courseSchema.parse(yaml('content/courses/kubernetes-foundations/course.yaml'));
const lessons = lessonFiles.map((file) => lessonSchema.parse(yaml(`${lessonDirectory}/${file}`)));
const graph = createClusterGraph(scenario);
const sourceIds = new Set(Object.keys(sourcesData.sources));
const lessonById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function checkSources(ids: readonly string[], context: string): void {
  for (const id of ids) check(sourceIds.has(id), `${context}: unknown source ID ${id}`);
}

const allowedHosts = new Set(['kubernetes.io', 'gateway-api.sigs.k8s.io', 'threejs.org']);
for (const [id, source] of Object.entries(sourcesData.sources)) {
  check(
    allowedHosts.has(new URL(source.url).hostname),
    `content/sources.yaml: ${id} uses a disallowed host`,
  );
}
check(
  new Set(course.lessonOrder).size === course.lessonOrder.length,
  'course.yaml: duplicate lessonOrder ID',
);
check(
  course.lessonOrder.length === course.lessons.length,
  'course.yaml: lessonOrder does not match manifest',
);
for (const id of course.lessonOrder)
  check(
    course.lessons.some((entry) => entry.id === id),
    `course.yaml: missing manifest entry ${id}`,
  );
for (const entry of course.lessons.filter((item) => item.status === 'available')) {
  check(lessonById.has(entry.id), `course.yaml: available lesson file missing for ${entry.id}`);
}

const visiting = new Set<string>();
const visited = new Set<string>();
function visit(id: string): void {
  if (visiting.has(id)) throw new Error(`course.yaml: prerequisite cycle at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  const entry = course.lessons.find((item) => item.id === id);
  check(Boolean(entry), `course.yaml: unknown prerequisite lesson ${id}`);
  for (const prerequisite of entry?.prerequisites ?? []) visit(prerequisite);
  visiting.delete(id);
  visited.add(id);
}
for (const entry of course.lessons) visit(entry.id);

const terms = new Map<string, string>();
for (const file of readdirSync(resolve(root, 'content/glossary')).filter((name) =>
  name.endsWith('.yaml'),
)) {
  const glossary = glossarySchema.parse(yaml(`content/glossary/${file}`));
  for (const term of glossary.terms) {
    check(!terms.has(term.id), `content/glossary/${file}: duplicate term ${term.id}`);
    terms.set(term.id, file);
    checkSources(term.sourceIds, `content/glossary/${file}:${term.id}`);
  }
}

const introduced = new Set<string>();
for (const lessonId of course.lessonOrder) {
  const lesson = lessonById.get(lessonId);
  if (!lesson) continue;
  check(lesson.scenarioId === scenario.id, `${lesson.id}: unknown scenario ${lesson.scenarioId}`);
  checkSources(lesson.sourceIds, lesson.id);
  for (const step of lesson.steps) {
    for (const id of step.introducesTerms) {
      check(terms.has(id), `${lesson.id}/${step.id}: introduces unknown term ${id}`);
      introduced.add(id);
    }
    for (const id of step.usesTerms) {
      check(terms.has(id), `${lesson.id}/${step.id}: uses unknown term ${id}`);
      check(introduced.has(id), `${lesson.id}/${step.id}: term ${id} used before introduction`);
    }
    checkSources(step.sourceIds, `${lesson.id}/${step.id}`);
  }
  courseEngine.compileLesson(lesson as Lesson, graph);
}
for (const entity of scenario.entities) checkSources(entity.sourceIds, entity.id);
for (const relation of scenario.relations) checkSources(relation.sourceIds, relation.id);

for (const service of scenario.entities.filter((entity) => entity.kind === 'Service')) {
  const selector = service.data?.selector;
  check(typeof selector === 'string' && selector.includes('='), `${service.id}: missing selector`);
  const [key, value] = selector.split('=');
  const selected = scenario.entities.filter(
    (entity) =>
      entity.kind === 'Pod' &&
      entity.namespace === service.namespace &&
      entity.labels?.[key ?? ''] === value,
  );
  check(selected.length > 0, `${service.id}: selector matches no Pods`);
}

const contentText = [
  'content/sources.yaml',
  'content/scenarios/demo-shop.yaml',
  ...lessonFiles.map((file) => `${lessonDirectory}/${file}`),
  ...readdirSync(resolve(root, 'content/glossary')).map((file) => `content/glossary/${file}`),
  'content/courses/kubernetes-foundations/course.yaml',
]
  .map((path) => `${path}\n${read(path)}`)
  .join('\n');
const sensitivePatterns: readonly [RegExp, string][] = [
  [/\b10\.(?:\d{1,3}\.){2}\d{1,3}\b/, 'private IPv4'],
  [/\b172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3}\b/, 'private IPv4'],
  [/\b192\.168\.(?:\d{1,3}\.)\d{1,3}\b/, 'private IPv4'],
  [/\.(?:local|internal)\b/i, 'private domain suffix'],
  [/\b(?:prod|production|stage|stg)\b/i, 'environment name'],
  [/\bkubeconfig\b/i, 'cluster credential reference'],
  [/(?:token|password):\s*(?!example\b)\S+/i, 'secret-like value'],
];
for (const [pattern, label] of sensitivePatterns)
  check(!pattern.test(contentText), `content: denied ${label} pattern`);
for (const company of read('scripts/content-denylist.txt').split(/\r?\n/).filter(Boolean)) {
  check(
    !contentText.toLowerCase().includes(company.toLowerCase()),
    `content: denied name ${company}`,
  );
}
const misleading = [
  'Secret is encrypted because it is base64',
  'Service is a proxy Pod',
  'Deployment forwards traffic',
  'Scheduler starts containers',
  'Namespace contains Nodes',
  'kube-proxy is mandatory in every cluster',
];
for (const phrase of misleading)
  check(!contentText.includes(phrase), `content: misleading expression: ${phrase}`);

console.log(
  `Content validation passed: ${scenario.entities.length} entities, ${scenario.relations.length} relations, ${lessons.length} lessons, ${terms.size} terms, ${sourceIds.size} sources.`,
);
