import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import {
  courseSchema,
  glossarySchema,
  legacyLessonMarkerSchema,
  lessonV2Schema,
  scenarioV2AuthorSchema,
  sourcesSchema,
} from '../src/content/schemas';
import { courseEngine } from '../src/course/CourseEngine';
import type { LessonV2 } from '../src/course/types';
import { validateWorldSnapshot } from '../src/world';
import type { WorldSnapshot } from '../src/world/types';

const root = resolve(import.meta.dirname, '..');
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const yaml = (path: string): unknown => {
  try {
    return parse(read(path), { merge: true });
  } catch (error) {
    throw new Error(`${path}: YAML parse failed: ${String(error)}`, { cause: error });
  }
};

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const lessonDirectory = 'content/courses/kubernetes-foundations/lessons';
const lessonFiles = readdirSync(resolve(root, lessonDirectory))
  .filter((file) => file.endsWith('.yaml'))
  .sort();
const sourcesData = sourcesSchema.parse(yaml('content/sources.yaml'));
const course = courseSchema.parse(yaml('content/courses/kubernetes-foundations/course.yaml'));
const authoredScenario = scenarioV2AuthorSchema.parse(
  yaml('content/scenarios/container-restart-golden.yaml'),
);

function uniqueRecord<T extends { readonly id: string }>(values: readonly T[], label: string) {
  const record: Record<string, T> = {};
  for (const value of values) {
    check(!record[value.id], `${label}: duplicate ID ${value.id}`);
    record[value.id] = value;
  }
  return record;
}

const scenario: WorldSnapshot = validateWorldSnapshot({
  schemaVersion: 2,
  scenarioId: authoredScenario.scenarioId,
  revision: authoredScenario.revision,
  entities: uniqueRecord(authoredScenario.entities, 'scenario entity'),
  relations: uniqueRecord(authoredScenario.relations, 'scenario relation'),
});

const sourceIds = new Set(Object.keys(sourcesData.sources));
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
const manifestById = new Map(course.lessons.map((entry) => [entry.id, entry]));
for (const id of course.lessonOrder)
  check(manifestById.has(id), `course.yaml: missing manifest entry ${id}`);

const visiting = new Set<string>();
const visited = new Set<string>();
function visit(id: string): void {
  if (visiting.has(id)) throw new Error(`course.yaml: prerequisite cycle at ${id}`);
  if (visited.has(id)) return;
  visiting.add(id);
  const entry = manifestById.get(id);
  check(entry !== undefined, `course.yaml: unknown prerequisite lesson ${id}`);
  for (const prerequisite of entry.prerequisites) visit(prerequisite);
  visiting.delete(id);
  visited.add(id);
}
for (const entry of course.lessons) visit(entry.id);

const v2Lessons = new Map<string, LessonV2>();
for (const file of lessonFiles) {
  const raw = yaml(`${lessonDirectory}/${file}`);
  check(Boolean(raw && typeof raw === 'object'), `${file}: lesson must be an object`);
  const schemaVersion = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (schemaVersion === 2) {
    const lesson = lessonV2Schema.parse(raw) as unknown as LessonV2;
    check(!v2Lessons.has(lesson.id), `${file}: duplicate lesson ID ${lesson.id}`);
    v2Lessons.set(lesson.id, lesson);
  } else {
    const legacy = legacyLessonMarkerSchema.parse(raw);
    check(
      manifestById.get(legacy.id)?.status === 'planned',
      `${file}: v1 lessons must remain explicitly planned until migrated`,
    );
  }
}

const available = course.lessons.filter((entry) => entry.status === 'available');
for (const entry of available)
  check(v2Lessons.has(entry.id), `${entry.id}: available lessons must use schemaVersion 2`);

const terms = new Set<string>();
for (const file of readdirSync(resolve(root, 'content/glossary'))
  .filter((name) => name.endsWith('.yaml'))
  .sort()) {
  const glossary = glossarySchema.parse(yaml(`content/glossary/${file}`));
  for (const term of glossary.terms) {
    check(!terms.has(term.id), `${file}: duplicate glossary term ${term.id}`);
    terms.add(term.id);
    checkSources(term.sourceIds, `${file}:${term.id}`);
  }
}

const compiledLessons = [];
for (const entry of available) {
  const lesson = v2Lessons.get(entry.id);
  check(lesson !== undefined, `${entry.id}: missing v2 lesson`);
  check(lesson.scenarioId === scenario.scenarioId, `${lesson.id}: unknown scenario`);
  checkSources(lesson.sourceIds, lesson.id);
  const introduced = new Set<string>();
  for (const step of lesson.steps) {
    for (const id of step.introducesTerms) {
      check(terms.has(id), `${lesson.id}/${step.id}: introduces unknown term ${id}`);
      check(!introduced.has(id), `${lesson.id}/${step.id}: introduces ${id} more than once`);
      introduced.add(id);
    }
    for (const id of step.usesTerms) {
      check(terms.has(id), `${lesson.id}/${step.id}: uses unknown term ${id}`);
      check(introduced.has(id), `${lesson.id}/${step.id}: term ${id} used before introduction`);
    }
    checkSources(step.sourceIds, `${lesson.id}/${step.id}`);
  }
  const compiled = courseEngine.compileLesson(lesson, scenario);
  for (const [index, sequential] of compiled.steps.entries()) {
    check(
      JSON.stringify(courseEngine.compileDirect(lesson, scenario, index)) ===
        JSON.stringify(sequential),
      `${lesson.id}/${index}: direct compilation is not deterministic`,
    );
  }
  compiledLessons.push(compiled);
}

for (const entity of Object.values(scenario.entities)) checkSources(entity.sourceIds, entity.id);
for (const relation of Object.values(scenario.relations)) checkSources(relation.sourceIds, relation.id);

const golden = compiledLessons.find(
  (compiled) => compiled.lesson.id === 'container-restart-vs-pod-replacement',
);
check(golden !== undefined, 'golden lesson must be available');
const pending = golden.steps.find((step) => step.stepId === 'replacement-pending');
const healthy = golden.steps.find((step) => step.stepId === 'healthy-pod');
const restarted = golden.steps.find((step) => step.stepId === 'container-restarted');
check(pending !== undefined, 'golden lesson pending step is missing');
check(healthy !== undefined, 'golden lesson healthy step is missing');
check(restarted !== undefined, 'golden lesson restart step is missing');
const newPodId = 'api-object:namespaced:shop:Pod:api-d-new';
const oldContainerId = 'runtime-instance:shop:Pod:api-a-old:Container:api';
check(!healthy.world.entities[newPodId], 'replacement Pod must not exist before creation');
check(Boolean(pending.worldDiff.addedEntities.find((item) => item.id === newPodId)), 'identity replacement must add a new entity ID');
check(
  restarted.worldDiff.updatedEntities.some(
    (update) =>
      update.id === oldContainerId && update.changedPaths.includes('/data/restartCount'),
  ),
  'restart claim must patch Container restartCount',
);

const contentPaths = [
  'content/sources.yaml',
  'content/scenarios/container-restart-golden.yaml',
  ...lessonFiles.map((file) => `${lessonDirectory}/${file}`),
  ...readdirSync(resolve(root, 'content/glossary')).map((file) => `content/glossary/${file}`),
  'content/courses/kubernetes-foundations/course.yaml',
];
const contentText = contentPaths.map((path) => `${path}\n${read(path)}`).join('\n');
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

const misleadingPatterns: readonly [RegExp, string][] = [
  [/Secret is encrypted because it is base64/i, 'Base64 is encryption'],
  [/Service is a proxy Pod/i, 'Service as proxy Pod'],
  [/Deployment forwards traffic/i, 'Deployment in the data path'],
  [/Scheduler starts containers/i, 'Scheduler starts containers'],
  [/Namespace contains Nodes/i, 'Namespace contains Nodes'],
  [/kube-proxy is mandatory in every cluster/i, 'universal kube-proxy requirement'],
  [/EndpointSlice(?:s)? (?:contains?|tracks?) only ready/i, 'EndpointSlice as ready-only list'],
];
for (const [pattern, label] of misleadingPatterns)
  check(!pattern.test(contentText), `content: misleading claim (${label})`);

console.log(
  `Content validation passed: ${Object.keys(scenario.entities).length} entities, ${Object.keys(scenario.relations).length} relations, ${available.length} verified v2 lesson, ${course.lessons.length - available.length} planned lessons, ${terms.size} terms, ${sourceIds.size} official sources.`,
);
