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
import { assertRawLessonRouteContract } from '../src/content/rawRouteContract';
import { courseEngine } from '../src/course/CourseEngine';
import type { LessonV2 } from '../src/course/types';
import {
  getContainerData,
  getPodData,
  getReplicaSetData,
  validateWorldSnapshot,
} from '../src/world';
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
function yamlFilesUnder(relativeDirectory: string): string[] {
  const directory = resolve(root, relativeDirectory);
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) =>
      resolve(entry.parentPath, entry.name)
        .slice(directory.length + 1)
        .replaceAll('\\', '/'),
    )
    .sort();
}

const lessonFiles = yamlFilesUnder(lessonDirectory);
const scenarioDirectory = 'content/scenarios';
const scenarioFiles = readdirSync(resolve(root, scenarioDirectory))
  .filter((file) => file.endsWith('.yaml'))
  .sort();
const sourcesData = sourcesSchema.parse(yaml('content/sources.yaml'));
const course = courseSchema.parse(yaml('content/courses/kubernetes-foundations/course.yaml'));

function uniqueRecord<T extends { readonly id: string }>(values: readonly T[], label: string) {
  const record: Record<string, T> = {};
  for (const value of values) {
    check(!record[value.id], `${label}: duplicate ID ${value.id}`);
    record[value.id] = value;
  }
  return record;
}

const scenarios = new Map<string, WorldSnapshot>();
const v2ScenarioFiles: string[] = [];
for (const file of scenarioFiles) {
  const raw = yaml(`${scenarioDirectory}/${file}`);
  check(Boolean(raw && typeof raw === 'object'), `${file}: scenario must be an object`);
  if ((raw as { schemaVersion?: unknown }).schemaVersion !== 2) continue;
  v2ScenarioFiles.push(file);
  const authored = scenarioV2AuthorSchema.parse(raw);
  check(
    !scenarios.has(authored.scenarioId),
    `${file}: duplicate scenario ID ${authored.scenarioId}`,
  );
  scenarios.set(
    authored.scenarioId,
    validateWorldSnapshot({
      schemaVersion: 2,
      scenarioId: authored.scenarioId,
      revision: authored.revision,
      entities: uniqueRecord(authored.entities, `${file} entity`),
      relations: uniqueRecord(authored.relations, `${file} relation`),
    }),
  );
}

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
  const path = `${lessonDirectory}/${file}`;
  const raw = yaml(path);
  check(Boolean(raw && typeof raw === 'object'), `${file}: lesson must be an object`);
  assertRawLessonRouteContract(raw, path);
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
  const lessonScenario = scenarios.get(lesson.scenarioId);
  check(lessonScenario !== undefined, `${lesson.id}: unknown scenario ${lesson.scenarioId}`);
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
  const compiled = courseEngine.compileLesson(lesson, lessonScenario);
  for (const [index, sequential] of compiled.steps.entries()) {
    check(
      JSON.stringify(courseEngine.compileDirect(lesson, lessonScenario, index)) ===
        JSON.stringify(sequential),
      `${lesson.id}/${index}: direct compilation is not deterministic`,
    );
  }
  compiledLessons.push(compiled);
}

for (const scenario of scenarios.values()) {
  for (const entity of Object.values(scenario.entities)) checkSources(entity.sourceIds, entity.id);
  for (const relation of Object.values(scenario.relations)) {
    checkSources(relation.sourceIds, relation.id);
  }
}

const golden = compiledLessons.find(
  (compiled) => compiled.lesson.id === 'container-restart-vs-pod-replacement',
);
check(golden !== undefined, 'golden lesson must be available');
const goldenScenario = scenarios.get(golden.lesson.scenarioId);
check(goldenScenario !== undefined, 'golden scenario must be available');
const expectedGoldenSteps = [
  'scene-orientation',
  'healthy-baseline',
  'container-exits',
  'container-restarted',
  'kubectl-delete-pod',
  'controller-creates-replacement',
  'replacement-pending',
  'scheduler-binds-worker-c',
  'kubelet-starts-container',
  'compare-identities',
] as const;
check(
  JSON.stringify(golden.steps.map((step) => step.stepId)) === JSON.stringify(expectedGoldenSteps),
  'golden lesson must preserve the required ten-step teaching sequence',
);

const goldenStep = (stepId: (typeof expectedGoldenSteps)[number]) => {
  const value = golden.steps.find((step) => step.stepId === stepId);
  check(value !== undefined, `golden lesson step ${stepId} is missing`);
  return value;
};

const baseline = goldenStep('healthy-baseline');
const restarted = goldenStep('container-restarted');
const deleted = goldenStep('kubectl-delete-pod');
const created = goldenStep('controller-creates-replacement');
const pending = goldenStep('replacement-pending');
const scheduled = goldenStep('scheduler-binds-worker-c');
const started = goldenStep('kubelet-starts-container');
const apiServerId = 'runtime-component:cluster:global:KubeAPIServer:kube-apiserver';
const kubectlId = 'external:external:global:Kubectl:kubectl';
const newPodId = 'api-object:namespaced:shop:Pod:api-d-new';
const oldPodId = 'api-object:namespaced:shop:Pod:api-a-old';
const oldContainerId = 'container-status:shop:Pod:api-a-old:Container:api';
const newContainerId = 'container-status:shop:Pod:api-d-new:Container:api';
const replicaSetId = 'api-object:namespaced:shop:ReplicaSet:api-rs';

check(
  goldenScenario.entities[apiServerId]?.kind === 'KubeAPIServer',
  'golden scenario must model API Server',
);
check(
  goldenScenario.entities[kubectlId]?.kind === 'Kubectl',
  'golden scenario must model the kubectl actor',
);
check(
  goldenScenario.relations['kubectl-requests-api-server']?.from === kubectlId &&
    goldenScenario.relations['kubectl-requests-api-server']?.to === apiServerId,
  'kubectl must reach cluster objects through the API Server',
);

check(!baseline.world.entities[newPodId], 'replacement Pod must not exist in the baseline');
check(
  restarted.worldDiff.addedEntities.length === 0 &&
    restarted.worldDiff.removedEntities.length === 0,
  'in-place restart must preserve Pod and Container entity IDs',
);
check(
  restarted.worldDiff.updatedEntities.some(
    (update) => update.id === oldContainerId && update.changedPaths.includes('/data/restartCount'),
  ),
  'restart claim must patch Container restartCount',
);
check(
  !deleted.world.entities[oldPodId] &&
    !deleted.world.entities[oldContainerId] &&
    !deleted.world.entities[newPodId],
  'explicit deletion must remove the old Pod before replacement exists',
);
check(
  getReplicaSetData(deleted.world.entities[replicaSetId]!).statusReplicas === 2 &&
    getReplicaSetData(deleted.world.entities[replicaSetId]!).readyReplicas === 2,
  'deletion must expose the ReplicaSet deficit',
);
check(
  Boolean(created.worldDiff.addedEntities.find((item) => item.id === newPodId)) &&
    Boolean(created.worldDiff.addedEntities.find((item) => item.id === newContainerId)),
  'controller reconciliation must create distinct replacement identities',
);
check(
  getPodData(created.world.entities[newPodId]!).nodeName === undefined &&
    getPodData(created.world.entities[newPodId]!).phase === 'Pending' &&
    created.world.entities[newContainerId]?.status === 'waiting',
  'controller-created replacement must begin Pending and unscheduled',
);
check(
  pending.worldDiff.addedEntities.length === 0 &&
    pending.worldDiff.removedEntities.length === 0 &&
    pending.worldDiff.updatedEntities.length === 0,
  'the Pending teaching beat must observe the existing world without inventing a mutation',
);
check(
  getPodData(scheduled.world.entities[newPodId]!).nodeName === 'worker-c' &&
    getPodData(scheduled.world.entities[newPodId]!).phase === 'Pending' &&
    scheduled.world.entities[newContainerId]?.status === 'waiting' &&
    getReplicaSetData(scheduled.world.entities[replicaSetId]!).readyReplicas === 2,
  'Scheduler binding must not start the Container or restore readiness',
);
check(
  getPodData(started.world.entities[newPodId]!).phase === 'Running' &&
    started.world.entities[newContainerId]?.status === 'running' &&
    getContainerData(started.world.entities[newContainerId]!).restartCount === 0 &&
    getReplicaSetData(started.world.entities[replicaSetId]!).readyReplicas === 3,
  'kubelet startup must be the separate beat that restores readiness',
);

for (const step of golden.steps) {
  const routes = new Map(step.view.activeRoutes.map((route) => [route.id, route]));
  for (const cue of step.transition.cues) {
    if ('routeId' in cue) {
      check(routes.has(cue.routeId), `${step.stepId}: routed cue must reference an active route`);
    }
  }
  for (const route of step.view.activeRoutes) {
    if (route.semantic === 'control' || route.semantic === 'scheduling') {
      check(
        route.hops.some(
          (hop) => hop.fromEntityId === apiServerId || hop.toEntityId === apiServerId,
        ),
        `${step.stepId}/${route.id}: golden control routes must expose API mediation`,
      );
    }
  }
  check(
    step.stepId === 'scene-orientation' ? step.evidence.length === 0 : step.evidence.length > 0,
    `${step.stepId}: compiled evidence must match the authored teaching mode`,
  );
}

const contentPaths = [
  'content/sources.yaml',
  ...v2ScenarioFiles.map((file) => `${scenarioDirectory}/${file}`),
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

const entityCount = [...scenarios.values()].reduce(
  (total, scenario) => total + Object.keys(scenario.entities).length,
  0,
);
const relationCount = [...scenarios.values()].reduce(
  (total, scenario) => total + Object.keys(scenario.relations).length,
  0,
);
console.log(
  `Content validation passed: ${scenarios.size} v2 scenarios, ${entityCount} entities, ${relationCount} relations, ${available.length} verified v2 lessons, ${course.lessons.length - available.length} planned lessons, ${terms.size} terms, ${sourceIds.size} official sources.`,
);
