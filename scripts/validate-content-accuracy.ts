import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { parse } from 'yaml';
import { lessonV2Schema, scenarioV2AuthorSchema } from '../src/content/schemas';
import { courseEngine } from '../src/course/CourseEngine';
import type { CompiledLesson, CompiledStep, LessonV2 } from '../src/course/types';
import { validateWorldSnapshot } from '../src/world';
import type { WorldEntity, WorldSnapshot } from '../src/world/types';

const root = resolve(import.meta.dirname, '..');

function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const read = (path: string): string => readFileSync(resolve(root, path), 'utf8');
const yaml = (path: string): unknown => parse(read(path), { merge: true });

const textExtensions = new Set(['.css', '.html', '.json', '.md', '.ts', '.tsx', '.yaml', '.yml']);
const currentPublicTextTargets = [
  'README.md',
  'README.ja.md',
  'README.zh-CN.md',
  'CONTRIBUTING.md',
  'content',
  'src',
  'tests',
  'docs/review',
  'docs/accuracy-policy.md',
  'docs/architecture.md',
  'docs/content-authoring.md',
  'docs/deployment.md',
  'docs/monitoring-boundary.md',
  'docs/scene-grammars.md',
  'docs/visualization-semantics.md',
] as const;
const intentionallyExcludedHistoricalPaths = [
  'docs/current-prototype-audit.md',
  'docs/audit/prototype-baseline',
] as const;

function collectTextFiles(relativePath: string): string[] {
  const absolutePath = resolve(root, relativePath);
  const stat = statSync(absolutePath);
  if (stat.isFile()) return textExtensions.has(extname(relativePath)) ? [relativePath] : [];
  return readdirSync(absolutePath)
    .sort()
    .flatMap((name) => collectTextFiles(`${relativePath}/${name}`));
}

const forbiddenPatterns: readonly { readonly pattern: RegExp; readonly label: string }[] = [
  { pattern: /currentReplicas/, label: 'nonexistent ReplicaSet currentReplicas field' },
  { pattern: /ReplicaSet Current/i, label: 'ReplicaSet Current UI label' },
  { pattern: /data\.currentReplicas/, label: 'ReplicaSet current counter path' },
  { pattern: /counters\.current/, label: 'ReplicaSet current counter key' },
  { pattern: /instanceGeneration/, label: 'synthetic Container generation field' },
  { pattern: /instance generation/i, label: 'obsolete Container generation wording' },
  { pattern: /インスタンス世代/, label: 'obsolete Japanese Container generation wording' },
  { pattern: /实例代次/, label: 'obsolete Chinese Container generation wording' },
  { pattern: /Container generation/i, label: 'synthetic Container generation copy' },
  { pattern: /Generation [12]/, label: 'synthetic Container generation value' },
  { pattern: /same Container entity returned/i, label: 'same runtime Container identity claim' },
  { pattern: /Traffic reroutes/i, label: 'in-flight request reroute wording' },
  { pattern: /Rerouted request/i, label: 'in-flight request reroute label' },
  { pattern: /reroute to Ready/i, label: 'in-flight request reroute hop' },
  { pattern: /再ルーティングされたリクエスト/, label: 'Japanese rerouted-request label' },
  { pattern: /改道后的请求/, label: 'Chinese rerouted-request label' },
  {
    pattern: /Pod status\s+(?:ready|not-ready)/i,
    label: 'renderer-only Pod status exposed as a learner fact',
  },
  { pattern: /Local ephemeral data/i, label: 'unmodeled storage comparison property' },
  { pattern: /same Pod lifecycle only/i, label: 'ambiguous storage lifetime claim' },
  { pattern: /not automatically preserved/i, label: 'unmodeled storage preservation claim' },
  { pattern: /new-generation/, label: 'obsolete runtime-generation CSS class' },
  {
    pattern: /API-mediated story from one in-place Container restart/i,
    label: 'local restart described as API-mediated',
  },
  {
    pattern: /Pending の置換 Pod 内で待機する Container インスタンス/,
    label: 'Japanese waiting runtime instance before containerID',
  },
  {
    pattern: /Pending 替换 Pod 内等待中的容器实例/,
    label: 'Chinese waiting runtime instance before containerID',
  },
  { pattern: /contains runtime/i, label: 'runtime containment instead of status-slot relation' },
  { pattern: /ランタイムを内包/, label: 'Japanese runtime containment relation' },
  { pattern: /包含运行实例/, label: 'Chinese runtime containment relation' },
  { pattern: /desired\/current\/ready/i, label: 'obsolete ReplicaSet counter wording' },
  { pattern: /reconciliation knot/i, label: 'rejected Controller Manager visual' },
  { pattern: /cyan assignment marker/i, label: 'rejected Scheduler visual' },
];

check(
  currentPublicTextTargets.every((path) => existsSync(resolve(root, path))),
  'current-public scan target is missing',
);
check(
  intentionallyExcludedHistoricalPaths.every(
    (path) => !currentPublicTextTargets.includes(path as (typeof currentPublicTextTargets)[number]),
  ),
  'historical audit path must not be part of the current-public scan',
);

const scannedFiles = [...new Set(currentPublicTextTargets.flatMap(collectTextFiles))].sort();
for (const path of scannedFiles) {
  const source = read(path);
  for (const { pattern, label } of forbiddenPatterns) {
    check(!pattern.test(source), `${path}: forbidden ${label}`);
  }
}

const publicReadmes = {
  en: read('README.md'),
  ja: read('README.ja.md'),
  zh: read('README.zh-CN.md'),
} as const;
const requiredReadmeFacts = [
  'why-kubernetes-exists',
  'cluster-overview',
  'pod-and-container',
  'pod-and-placement',
  'deployment-replicaset-and-pods',
  'manifest-to-running-pod',
  'pending-and-scheduling',
  'container-restart-vs-pod-replacement',
  'labels-and-selectors',
  'service-routes-to-pods',
  'dns-and-service-discovery',
  'probes-and-rolling-update',
  'containerID',
  'restartCount',
  'lastState',
  'SPEC',
  'OBSERVED',
  'READY',
  'content:accuracy',
  'visual:capture',
  'golden-step-00-1440x900.png',
] as const;
const requiredValidationCommands = [
  'pnpm format:check',
  'pnpm lint',
  'pnpm typecheck',
  'pnpm content:validate',
  'pnpm content:accuracy',
  'pnpm test:unit -- --run',
  'pnpm build',
  'pnpm test:e2e',
  'pnpm visual:capture',
] as const;
for (const [locale, source] of Object.entries(publicReadmes)) {
  for (const fact of requiredReadmeFacts) {
    check(source.includes(fact), `README ${locale}: missing current release fact ${fact}`);
  }
  for (const command of requiredValidationCommands) {
    check(source.includes(command), `README ${locale}: missing validation command ${command}`);
  }
}
check(
  publicReadmes.en.includes('12 fully verified lessons') &&
    publicReadmes.en.includes('10-step Pod lifecycle') &&
    publicReadmes.en.includes('6-step Service traffic path') &&
    publicReadmes.en.includes('10 planned lessons'),
  'English README: release scope must state 12 verified, 10-step Pod, 6-step Service, and 10 planned',
);
check(
  publicReadmes.ja.includes('完全に検証済みのレッスンは12本') &&
    publicReadmes.ja.includes('Pod ライフサイクルは10ステップ') &&
    publicReadmes.ja.includes('Service トラフィックは6ステップ') &&
    /計画中(?:のレッスン)?は10本/.test(publicReadmes.ja),
  'Japanese README: release scope must state 12 verified, 10-step Pod, 6-step Service, and 10 planned',
);
check(
  publicReadmes.zh.includes('12 节完整验证课程') &&
    publicReadmes.zh.includes('10 步 Pod 生命周期') &&
    publicReadmes.zh.includes('6 步 Service 流量路径') &&
    publicReadmes.zh.includes('10 节规划中课程'),
  'Chinese README: release scope must state 12 verified, 10-step Pod, 6-step Service, and 10 planned',
);
check(
  !/(?:one verified lesson|1 fully verified lesson)/i.test(publicReadmes.en),
  'English README: obsolete one-lesson release claim',
);
check(
  !/(?:完全に検証(?:された|済み)のレッスン[^\n]*1\s*本|7\s*ステップ|21\s*本は計画中)/.test(
    publicReadmes.ja,
  ),
  'Japanese README: obsolete release count',
);
check(
  !/(?:1\s*节完整验证课程|7\s*个确定性的事实步骤|21\s*节规划中课程)/.test(publicReadmes.zh),
  'Chinese README: obsolete release count',
);

const visualizationSemantics = read('docs/visualization-semantics.md');
for (const currentConcept of [
  'Container status slot',
  'containerID',
  'restartCount',
  'lastState',
  'SPEC',
  'OBSERVED',
  'READY',
  'node-runtime',
  'EndpointSlice',
  'Request A',
  'Request B',
  'WorldEntity.status',
]) {
  check(
    visualizationSemantics.includes(currentConcept),
    `visualization semantics: missing current concept ${currentConcept}`,
  );
}

const historicalAudit = read('docs/current-prototype-audit.md');
check(
  historicalAudit.startsWith(
    '# Current prototype audit\n\n> Historical audit of prototype commit `c515f8a`. This file describes rejected behavior and is not current product documentation.',
  ),
  'prototype audit: explicit historical banner missing',
);

const linkDocuments = [
  'README.md',
  'README.ja.md',
  'README.zh-CN.md',
  'docs/visualization-semantics.md',
] as const;
const markdownLinkPattern = /!?\[[^\]]*\]\(([^)]+)\)/g;
let checkedLocalLinks = 0;
for (const documentPath of linkDocuments) {
  const source = read(documentPath);
  for (const match of source.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1]?.trim().replace(/^<|>$/g, '');
    if (!rawTarget || rawTarget.startsWith('#') || /^(?:https?:|mailto:|data:)/i.test(rawTarget)) {
      continue;
    }
    const localTarget = decodeURIComponent(rawTarget.split(/[?#]/, 1)[0] ?? '');
    check(localTarget.length > 0, `${documentPath}: empty local link target`);
    check(
      existsSync(resolve(root, dirname(documentPath), localTarget)),
      `${documentPath}: missing local link ${rawTarget}`,
    );
    checkedLocalLinks += 1;
  }
}
for (const requiredLink of [
  'docs/review/screenshots/golden-step-00-1440x900.png',
  'docs/architecture.md',
  'docs/accuracy-policy.md',
  'docs/visualization-semantics.md',
  'docs/review/VISUAL_ACCEPTANCE_CHECKLIST.md',
  'docs/review/BEFORE_AFTER.md',
]) {
  check(
    Object.values(publicReadmes).every((source) => source.includes(requiredLink)),
    `public READMEs: missing required local link ${requiredLink}`,
  );
}
check(checkedLocalLinks >= 18, 'public documentation: expected at least 18 local links');

const finalPrDescription = read('docs/review/PR_FINAL_DESCRIPTION.md');
check(!/PENDING_/.test(finalPrDescription), 'final PR description: validation placeholders remain');
for (const requiredClaim of [
  'twelve verified foundation-first lessons',
  'distinguish container packaging from Kubernetes orchestration',
  'manifest-driven `/learn` continuation',
  'normalized lesson deep links',
  'explicit completion',
  'first-unfinished next-lesson routing',
  'serialized cross-tab completion merges',
  'Reset-generation guard',
  'visible saving/saved/failed states',
  'local WebGL fallback and Retry',
  'SPEC / OBSERVED / READY',
  '54 entities, 64 relations',
  '`containerID`',
  '`restartCount`',
  '`lastState`',
  `${scannedFiles.length} current-public text files`,
  '45 files, 326 tests',
  '`pnpm visual:m5`',
  '`pnpm visual:m6`',
  '`pnpm visual:m7`',
  '`pnpm visual:m8`',
  '9 cases / 36 screenshots',
  '10 objectives / 45 screenshots',
  '13 objectives / 51 screenshots',
  '136 passed, 53 skipped, 0 failed',
  'forced-lock contention tests reconcile both writer tabs',
  'pending completion → later Reset',
  'injected `localStorage.setItem` failure',
  'Home preview / CTA coherence',
  '20-cycle twelve-lesson renderer resource pressure gate',
  '38 full-page + 5 focused = 43 screenshots',
]) {
  check(
    finalPrDescription.includes(requiredClaim),
    `final PR description: missing required claim ${requiredClaim}`,
  );
}
for (const obsoleteClaim of [
  '174 current-public text files',
  '190 current-public text files',
  '194 current-public text files',
  '207 current-public text files',
  '208 current-public text files',
  '211 current-public text files',
  '212 current-public text files',
  '218 current-public text files',
  '238 current-public text files',
  '23 files, 176 tests',
  '31 files, 212 tests',
  '32 files, 226 tests',
  '32 files, 229 tests',
  '34 files, 237 tests',
  '34 files, 238 tests',
  '35 files, 244 tests',
  '38 files, 261 tests',
  '38 files, 264 tests',
  '41 files, 273 tests',
  '41 files, 274 tests',
  '42 files, 292 tests',
  '44 files, 318 tests',
  '45 files, 324 tests',
  '45 files, 325 tests',
  '30 entities, 32 relations',
  '32 entities, 34 relations',
  '123 passed, 45 skipped, 0 failed',
  '102 passed, 45 skipped, 0 failed',
  '66 passed, 39 skipped, 0 failed',
]) {
  check(
    !finalPrDescription.includes(obsoleteClaim),
    `final PR description: obsolete validation count ${obsoleteClaim}`,
  );
}

interface VisualManifestCapture {
  readonly kind: string;
  readonly file: string;
  readonly inspection: {
    readonly labelsOutsideStage: number;
    readonly maximumLabelOverlap: number;
    readonly visibleComparisonRows: number;
    readonly evidenceText: string;
  };
}

const visualManifest = JSON.parse(read('docs/review/screenshots/manifest.json')) as {
  readonly captures: readonly VisualManifestCapture[];
};
check(visualManifest.captures.length === 43, 'visual manifest: expected 43 captures');
check(
  visualManifest.captures.filter((capture) => capture.kind === 'full-page').length === 38 &&
    visualManifest.captures.filter((capture) => capture.kind === 'focused-element').length === 5,
  'visual manifest: expected 38 full-page and 5 focused captures',
);
check(
  visualManifest.captures.every(
    (capture) =>
      capture.inspection.labelsOutsideStage === 0 && capture.inspection.maximumLabelOverlap <= 0.12,
  ),
  'visual manifest: label overlap or stage-boundary gate failed',
);
const mobileComparisonCapture = visualManifest.captures.find(
  (capture) => capture.file === 'golden-step-09-390x844.png',
);
check(mobileComparisonCapture !== undefined, 'visual manifest: mobile comparison capture missing');
check(
  mobileComparisonCapture.inspection.visibleComparisonRows === 12,
  'visual manifest: mobile comparison must expose all six properties in both cards',
);
const focusedServiceEvidence = visualManifest.captures.find(
  (capture) => capture.file === 'evidence-service-step-04-1280x720.png',
);
check(
  focusedServiceEvidence !== undefined,
  'visual manifest: focused Service Step 4 Evidence capture missing',
);
check(
  !/Pod status/i.test(focusedServiceEvidence.inspection.evidenceText) &&
    focusedServiceEvidence.inspection.evidenceText.includes('ContainersReady') &&
    focusedServiceEvidence.inspection.evidenceText.includes('Pod Ready'),
  'visual manifest: focused Service Evidence must contain real Pod conditions only',
);

function uniqueRecord<T extends { readonly id: string }>(values: readonly T[], label: string) {
  const record: Record<string, T> = {};
  for (const value of values) {
    check(record[value.id] === undefined, `${label}: duplicate ID ${value.id}`);
    record[value.id] = value;
  }
  return record;
}

const scenarioFiles = readdirSync(resolve(root, 'content/scenarios'))
  .filter((name) => name.endsWith('.yaml'))
  .sort();
const scenarios = new Map<string, WorldSnapshot>();
for (const file of scenarioFiles) {
  const raw = yaml(`content/scenarios/${file}`);
  if ((raw as { schemaVersion?: unknown } | undefined)?.schemaVersion !== 2) continue;
  const authored = scenarioV2AuthorSchema.parse(raw);
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

const lessonFiles = readdirSync(resolve(root, 'content/courses/kubernetes-foundations/lessons'))
  .filter((name) => name.endsWith('.yaml'))
  .sort();
const lessons = new Map<string, LessonV2>();
for (const file of lessonFiles) {
  const raw = yaml(`content/courses/kubernetes-foundations/lessons/${file}`);
  if ((raw as { schemaVersion?: unknown } | undefined)?.schemaVersion !== 2) continue;
  const lesson = lessonV2Schema.parse(raw) as unknown as LessonV2;
  lessons.set(lesson.id, lesson);
}

function compileLesson(id: string): CompiledLesson {
  const lesson = lessons.get(id);
  check(lesson !== undefined, `accuracy: missing lesson ${id}`);
  const scenario = scenarios.get(lesson.scenarioId);
  check(scenario !== undefined, `accuracy: missing scenario ${lesson.scenarioId}`);
  return courseEngine.compileLesson(lesson, scenario);
}

function step(compiled: CompiledLesson, id: string): CompiledStep {
  const value = compiled.steps.find((candidate) => candidate.stepId === id);
  check(value !== undefined, `accuracy: missing ${compiled.lesson.id}/${id}`);
  return value;
}

function entity(
  world: WorldSnapshot,
  predicate: (candidate: WorldEntity) => boolean,
  label: string,
) {
  const matches = Object.values(world.entities).filter(predicate);
  check(matches.length === 1, `${label}: expected one entity, found ${matches.length}`);
  return matches[0]!;
}

function dataRecord(value: WorldEntity, label: string): Record<string, unknown> {
  check(value.data !== null && typeof value.data === 'object', `${label}: data must be an object`);
  return value.data as Record<string, unknown>;
}

function nestedRecord(value: unknown, label: string): Record<string, unknown> {
  check(value !== null && typeof value === 'object', `${label}: expected an object`);
  return value as Record<string, unknown>;
}

function routeData(route: unknown, label: string): Record<string, unknown> {
  return nestedRecord(route, label);
}

const golden = compileLesson('container-restart-vs-pod-replacement');
const goldenBaseline = step(golden, 'healthy-baseline');
const goldenExited = step(golden, 'container-exits');
const goldenRestarted = step(golden, 'container-restarted');
const goldenDeleted = step(golden, 'kubectl-delete-pod');
const goldenCreated = step(golden, 'controller-creates-replacement');
const goldenPending = step(golden, 'replacement-pending');
const goldenScheduled = step(golden, 'scheduler-binds-worker-c');
const goldenStarted = step(golden, 'kubelet-starts-container');
const goldenCompared = step(golden, 'compare-identities');

const oldPod = entity(
  goldenBaseline.world,
  (candidate) => candidate.kind === 'Pod' && candidate.name === 'api-7f8d9-a',
  'golden baseline Pod',
);
const baselineContainer = entity(
  goldenBaseline.world,
  (candidate) => candidate.kind === 'Container' && candidate.data.podId === oldPod.id,
  'golden baseline Container',
);
const baselineReplicaSet = entity(
  goldenBaseline.world,
  (candidate) => candidate.kind === 'ReplicaSet',
  'golden baseline ReplicaSet',
);
const exitedPod = goldenExited.world.entities[oldPod.id];
const exitedContainer = goldenExited.world.entities[baselineContainer.id];
const exitedReplicaSet = goldenExited.world.entities[baselineReplicaSet.id];
const restartedPod = goldenRestarted.world.entities[oldPod.id];
const restartedContainer = goldenRestarted.world.entities[baselineContainer.id];
const restartedReplicaSet = goldenRestarted.world.entities[baselineReplicaSet.id];
check(exitedPod !== undefined, 'Step 2: old Pod must remain addressable');
check(exitedContainer !== undefined, 'Step 2: Container status slot must remain addressable');
check(exitedReplicaSet !== undefined, 'Step 2: ReplicaSet must remain addressable');
check(restartedPod !== undefined, 'Step 3: old Pod must remain addressable');
check(restartedContainer !== undefined, 'Step 3: Container status slot must remain addressable');
check(restartedReplicaSet !== undefined, 'Step 3: ReplicaSet must remain addressable');

const baselinePodData = dataRecord(oldPod, 'baseline Pod');
const exitedPodData = dataRecord(exitedPod, 'exited Pod');
const restartedPodData = dataRecord(restartedPod, 'restarted Pod');
const exitedConditions = nestedRecord(exitedPodData.conditions, 'exited Pod conditions');
const restartedConditions = nestedRecord(restartedPodData.conditions, 'restarted Pod conditions');
const baselineContainerData = dataRecord(baselineContainer, 'baseline Container');
const exitedContainerData = dataRecord(exitedContainer, 'exited Container');
const restartedContainerData = dataRecord(restartedContainer, 'restarted Container');
const exitedContainerState = nestedRecord(exitedContainerData.state, 'exited Container state');
const restartedLastState = nestedRecord(
  restartedContainerData.lastState,
  'restarted Container lastState',
);
const exitedReplicaSetData = dataRecord(exitedReplicaSet, 'exited ReplicaSet');
const restartedReplicaSetData = dataRecord(restartedReplicaSet, 'restarted ReplicaSet');

function assertReplicaCounts(
  entityValue: WorldEntity,
  spec: number,
  observed: number,
  ready: number,
  label: string,
): void {
  const data = dataRecord(entityValue, label);
  check(data.specReplicas === spec, `${label}: SPEC must be ${spec}`);
  check(data.statusReplicas === observed, `${label}: OBSERVED must be ${observed}`);
  check(data.readyReplicas === ready, `${label}: READY must be ${ready}`);
}

const baselineConditions = nestedRecord(baselinePodData.conditions, 'baseline Pod conditions');
const baselineState = nestedRecord(baselineContainerData.state, 'baseline Container state');
check(baselinePodData.phase === 'Running', 'Step 1: Pod phase must be Running');
check(baselineConditions.podScheduled === true, 'Step 1: PodScheduled must be true');
check(baselineConditions.initialized === true, 'Step 1: Initialized must be true');
check(baselineConditions.containersReady === true, 'Step 1: ContainersReady must be true');
check(baselineConditions.ready === true, 'Step 1: Pod Ready must be true');
check(
  baselineContainerData.containerID === 'containerd://synthetic-api-a-old-01',
  'Step 1: baseline containerID mismatch',
);
check(baselineContainerData.restartCount === 0, 'Step 1: restartCount must be 0');
check(baselineContainerData.ready === true, 'Step 1: Container ready must be true');
check(baselineContainerData.started === true, 'Step 1: Container started must be true');
check(baselineState.kind === 'running', 'Step 1: Container state must be running');
assertReplicaCounts(baselineReplicaSet, 3, 3, 3, 'Step 1 ReplicaSet');

check(exitedPodData.phase === 'Running', 'Step 2: Pod phase must remain Running');
check(exitedConditions.containersReady === false, 'Step 2: ContainersReady must be false');
check(exitedConditions.ready === false, 'Step 2: Pod Ready must be false');
check(exitedContainerState.kind === 'terminated', 'Step 2: Container state must be terminated');
check(exitedContainerData.ready === false, 'Step 2: Container ready must be false');
check(exitedContainerData.started === false, 'Step 2: Container started must be false');
check(
  exitedContainerData.containerID === 'containerd://synthetic-api-a-old-01',
  'Step 2: containerID must remain ...-01',
);
check(exitedContainerData.restartCount === 0, 'Step 2: restartCount must remain 0');
check(exitedContainerState.reason === 'Error', 'Step 2: termination reason must be Error');
check(exitedContainerState.exitCode === 1, 'Step 2: termination exitCode must be 1');
check(exitedReplicaSetData.statusReplicas === 3, 'Step 2: ReplicaSet observed count must stay 3');
check(exitedReplicaSetData.readyReplicas === 2, 'Step 2: ReplicaSet ready count must become 2');
check(restartedPodData.uid === baselinePodData.uid, 'Step 3: Pod UID must stay unchanged');
check(restartedPodData.nodeName === baselinePodData.nodeName, 'Step 3: Node must stay unchanged');
check(restartedConditions.ready === true, 'Step 3: Pod Ready must return to true');
check(restartedConditions.containersReady === true, 'Step 3: ContainersReady must return to true');
check(
  restartedContainerData.containerID !== baselineContainerData.containerID,
  'Step 3: replacement runtime Container must have a new containerID',
);
check(restartedContainerData.restartCount === 1, 'Step 3: restartCount must become 1');
check(restartedLastState.kind === 'terminated', 'Step 3: lastState must record termination');
check(restartedLastState.reason === 'Error', 'Step 3: lastState reason must be Error');
check(restartedLastState.exitCode === 1, 'Step 3: lastState exitCode must be 1');
check(restartedContainerData.ready === true, 'Step 3: Container ready must return to true');
check(restartedContainerData.started === true, 'Step 3: Container started must return to true');
check(
  restartedReplicaSetData.readyReplicas === 3,
  'Step 3: ReplicaSet ready count must return to 3',
);

check(goldenDeleted.world.entities[oldPod.id] === undefined, 'Step 4: old Pod must be absent');
check(
  goldenDeleted.world.entities[baselineContainer.id] === undefined,
  'Step 4: old Container status slot must be absent',
);
assertReplicaCounts(
  goldenDeleted.world.entities[baselineReplicaSet.id]!,
  3,
  2,
  2,
  'Step 4 ReplicaSet',
);

const replacementPod = entity(
  goldenCreated.world,
  (candidate) => candidate.kind === 'Pod' && candidate.name === 'api-7f8d9-d',
  'Step 5 replacement Pod',
);
const replacementContainer = entity(
  goldenCreated.world,
  (candidate) => candidate.kind === 'Container' && candidate.data.podId === replacementPod.id,
  'Step 5 replacement Container',
);
const createdPodData = dataRecord(replacementPod, 'Step 5 replacement Pod');
const createdConditions = nestedRecord(createdPodData.conditions, 'Step 5 Pod conditions');
const createdContainerData = dataRecord(replacementContainer, 'Step 5 replacement Container');
const createdState = nestedRecord(createdContainerData.state, 'Step 5 Container state');
check(createdPodData.uid === 'synthetic-uid-new-d1', 'Step 5: replacement UID mismatch');
check(createdPodData.nodeName === undefined, 'Step 5: replacement Pod must be unscheduled');
check(createdPodData.phase === 'Pending', 'Step 5: Pod phase must be Pending');
check(createdConditions.podScheduled === false, 'Step 5: PodScheduled must be false');
check(createdConditions.containersReady === false, 'Step 5: ContainersReady must be false');
check(createdConditions.ready === false, 'Step 5: Pod Ready must be false');
check(createdState.kind === 'waiting', 'Step 5: Container state must be waiting');
check(createdContainerData.containerID === undefined, 'Step 5: containerID must be absent');
check(createdContainerData.restartCount === 0, 'Step 5: restartCount must be 0');
check(createdContainerData.ready === false, 'Step 5: Container ready must be false');
assertReplicaCounts(
  goldenCreated.world.entities[baselineReplicaSet.id]!,
  3,
  3,
  2,
  'Step 5 ReplicaSet',
);
check(
  goldenPending.worldDiff.addedEntities.length === 0 &&
    goldenPending.worldDiff.removedEntities.length === 0 &&
    goldenPending.worldDiff.updatedEntities.length === 0 &&
    goldenPending.worldDiff.addedRelations.length === 0 &&
    goldenPending.worldDiff.removedRelations.length === 0 &&
    goldenPending.worldDiff.updatedRelations.length === 0,
  'Step 6: Pending emphasis must not mutate facts',
);

const scheduledPodData = dataRecord(
  goldenScheduled.world.entities[replacementPod.id]!,
  'Step 7 replacement Pod',
);
const scheduledConditions = nestedRecord(scheduledPodData.conditions, 'Step 7 Pod conditions');
const scheduledContainerData = dataRecord(
  goldenScheduled.world.entities[replacementContainer.id]!,
  'Step 7 replacement Container',
);
check(scheduledPodData.nodeName === 'worker-c', 'Step 7: nodeName must be worker-c');
check(scheduledPodData.phase === 'Pending', 'Step 7: phase must remain Pending');
check(scheduledConditions.podScheduled === true, 'Step 7: PodScheduled must be true');
check(scheduledConditions.ready === false, 'Step 7: Pod Ready must remain false');
check(
  nestedRecord(scheduledContainerData.state, 'Step 7 Container state').kind === 'waiting',
  'Step 7: Container must remain waiting',
);
assertReplicaCounts(
  goldenScheduled.world.entities[baselineReplicaSet.id]!,
  3,
  3,
  2,
  'Step 7 ReplicaSet',
);

const startedPodData = dataRecord(
  goldenStarted.world.entities[replacementPod.id]!,
  'Step 8 replacement Pod',
);
const startedConditions = nestedRecord(startedPodData.conditions, 'Step 8 Pod conditions');
const startedContainerData = dataRecord(
  goldenStarted.world.entities[replacementContainer.id]!,
  'Step 8 replacement Container',
);
check(startedPodData.phase === 'Running', 'Step 8: Pod phase must be Running');
check(startedConditions.containersReady === true, 'Step 8: ContainersReady must be true');
check(startedConditions.ready === true, 'Step 8: Pod Ready must be true');
check(
  nestedRecord(startedContainerData.state, 'Step 8 Container state').kind === 'running',
  'Step 8: Container state must be running',
);
check(
  startedContainerData.containerID === 'containerd://synthetic-api-d-new-01',
  'Step 8: replacement containerID mismatch',
);
check(startedContainerData.restartCount === 0, 'Step 8: restartCount must remain 0');
check(startedContainerData.ready === true, 'Step 8: Container ready must be true');
assertReplicaCounts(
  goldenStarted.world.entities[baselineReplicaSet.id]!,
  3,
  3,
  3,
  'Step 8 ReplicaSet',
);
check(
  goldenCompared.worldDiff.addedEntities.length === 0 &&
    goldenCompared.worldDiff.removedEntities.length === 0 &&
    goldenCompared.worldDiff.updatedEntities.length === 0,
  'Step 9: comparison must not mutate facts',
);
const comparisonProperties = goldenCompared.view.comparison?.rows.map((row) => row.property.en);
check(
  JSON.stringify(comparisonProperties) ===
    JSON.stringify([
      'Pod name',
      'Pod UID',
      'Node',
      'Container ID',
      'Container restart count',
      'Pod object',
    ]),
  'Step 9: comparison must contain exactly six snapshot-derived identity properties',
);

check(
  golden.lesson.summary.en ===
    'Watch kubelet restart a runtime Container locally inside one Pod, then follow an intentional Pod deletion and API-mediated replacement.',
  'golden lesson: English summary must separate local restart from API-mediated replacement',
);
check(
  golden.lesson.summary.ja ===
    'kubelet が同じ Pod 内でランタイム Container をローカル再起動する流れと、その後に意図的な Pod 削除から API を介して置換される流れを追います。',
  'golden lesson: Japanese summary must separate local restart from API-mediated replacement',
);
check(
  golden.lesson.summary['zh-CN'] ===
    '先观察 kubelet 在同一 Pod 内本地重启运行时容器，再跟随一次主动 Pod 删除及其经由 API 完成的替换流程。',
  'golden lesson: Chinese summary must separate local restart from API-mediated replacement',
);
check(
  replacementContainer.summary.en ===
    'Container status slot waiting for kubelet to create a runtime Container.' &&
    replacementContainer.summary.ja ===
      'kubelet がランタイム Container を作成するのを待っている Container 状態スロットです。' &&
    replacementContainer.summary['zh-CN'] === '等待 kubelet 创建运行时容器的容器状态槽。',
  'Step 5: Pending child must be described as a Container status slot in all languages',
);
const replacementContainment = Object.values(goldenCreated.world.relations).find(
  (relation) => relation.from === replacementPod.id && relation.to === replacementContainer.id,
);
check(replacementContainment !== undefined, 'Step 5: replacement containment relation is required');
check(
  replacementContainment.title.en === 'contains Container status' &&
    replacementContainment.title.ja === 'Container 状態を含む' &&
    replacementContainment.title['zh-CN'] === '包含容器状态',
  'Step 5: containment relation must identify the Container status slot in all languages',
);

const restartRoute = goldenRestarted.view.activeRoutes[0];
check(restartRoute !== undefined, 'Step 3: local restart route is required');
check(restartRoute.semantic === 'node-runtime', 'Step 3: active route must use node-runtime');
const restartRouteEntities = restartRoute.hops.flatMap((hop) => [
  goldenRestarted.world.entities[hop.fromEntityId],
  goldenRestarted.world.entities[hop.toEntityId],
]);
check(
  restartRoute.hops[0]?.fromEntityId ===
    entity(
      goldenRestarted.world,
      (candidate) => candidate.kind === 'Kubelet' && candidate.data.nodeName === 'worker-a',
      'worker-a kubelet',
    ).id,
  'Step 3: active route must start at the worker-a kubelet',
);
check(
  restartRouteEntities.every(
    (candidate) =>
      candidate &&
      ![
        'KubeAPIServer',
        'ApiServer',
        'APIServer',
        'Scheduler',
        'ReplicaSet',
        'ControllerManager',
      ].includes(candidate.kind),
  ),
  'Step 3: local restart route must not include control-plane actors',
);

const service = compileLesson('service-routes-to-pods');
const requestAStep = step(service, 'request-ready-backend');
const endpointChangeStep = step(service, 'endpoint-becomes-not-ready');
const requestBStep = step(service, 'later-request-ready-backend');
check(
  endpointChangeStep.worldDiff.updatedEntities.some((update) =>
    update.changedPaths.includes('/status'),
  ),
  'Service Step 4: renderer status change must remain available in WorldDiff',
);
check(
  endpointChangeStep.evidence.every((row) => row.path !== '/status'),
  'Service Step 4: renderer-only /status must be excluded from factual Evidence',
);
check(
  endpointChangeStep.evidence.some((row) => row.path === '/data/conditions/containersReady') &&
    endpointChangeStep.evidence.some((row) => row.path === '/data/conditions/ready'),
  'Service Step 4: real ContainersReady and Pod Ready conditions must remain in Evidence',
);
const serviceEntity = entity(
  endpointChangeStep.world,
  (candidate) => candidate.kind === 'Service',
  'Service lesson Service',
);
const serviceData = dataRecord(serviceEntity, 'Service data');
check(
  serviceData.publishNotReadyAddresses === false,
  'Service lesson must explicitly use publishNotReadyAddresses=false',
);
const endpointSlice = entity(
  endpointChangeStep.world,
  (candidate) => candidate.kind === 'EndpointSlice',
  'Service lesson EndpointSlice',
);
const endpointSliceData = dataRecord(endpointSlice, 'EndpointSlice data');
check(Array.isArray(endpointSliceData.endpoints), 'EndpointSlice endpoints must be an array');
const apiAEndpoint = endpointSliceData.endpoints
  .map((candidate, index) => nestedRecord(candidate, `EndpointSlice endpoint ${index}`))
  .find((candidate) => String(candidate.targetRef).includes('api-a'));
check(apiAEndpoint !== undefined, 'EndpointSlice must retain the api-a endpoint');
const apiAConditions = nestedRecord(apiAEndpoint.conditions, 'api-a endpoint conditions');
check(apiAConditions.ready === false, 'api-a endpoint ready must be false');
check(apiAConditions.serving === false, 'api-a endpoint serving must be false');
check(apiAConditions.terminating === false, 'api-a endpoint terminating must be false');

const requestARoute = requestAStep.view.activeRoutes[0];
const requestBRoute = requestBStep.view.activeRoutes[0];
check(requestARoute !== undefined, 'Service lesson requires a Request A route');
check(requestBRoute !== undefined, 'Service lesson requires a Request B route');
const requestAData = routeData(requestARoute, 'Request A route');
const requestBData = routeData(requestBRoute, 'Request B route');
check(requestAData.requestId === 'request-a', 'Step 3 route must identify Request A');
check(requestBData.requestId === 'request-b', 'Step 5 route must identify Request B');
check(
  String(requestAData.requestId) !== String(requestBData.requestId),
  'Service requests must use distinct IDs',
);
const apiAPod = entity(
  requestAStep.world,
  (candidate) => candidate.kind === 'Pod' && candidate.name === 'api-a',
  'Service api-a Pod',
);
const apiCPod = entity(
  requestBStep.world,
  (candidate) => candidate.kind === 'Pod' && candidate.name === 'api-c',
  'Service api-c Pod',
);
check(
  requestARoute.hops.at(-1)?.toEntityId === apiAPod.id,
  'Request A must end at Ready backend api-a',
);
check(
  requestBRoute.hops.at(-1)?.toEntityId === apiCPod.id,
  'Request B must end at Ready backend api-c',
);
check(
  endpointChangeStep.view.activeRoutes.every((route) =>
    route.hops.every((hop) => hop.toEntityId !== apiAPod.id),
  ),
  'readiness-change step must not route ordinary traffic to api-a',
);

console.log(
  `Content accuracy passed: ${scannedFiles.length} current-public text files scanned, ${forbiddenPatterns.length} forbidden patterns guarded, ${checkedLocalLinks} local links verified; README, visualization, Pod lifecycle, and Service request invariants passed.`,
);
