import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page, type ViewportSize } from '@playwright/test';
import { format, resolveConfig } from 'prettier';
import { parse } from 'yaml';
import { scenarioV2AuthorSchema, lessonV2Schema } from '../src/content/schemas';
import { courseEngine } from '../src/course/CourseEngine';
import type {
  EntityViewState,
  LessonV2,
  RelationViewState,
  ViewProjection,
} from '../src/course/types';
import { VisualFactoryRegistry } from '../src/renderer/VisualFactoryRegistry';
import { createEffectiveScenePlan } from '../src/renderer/scene-grammar';
import { EndpointSliceVisualHandle } from '../src/renderer/visuals/EndpointSliceVisual';
import { validateWorldSnapshot } from '../src/world/validation';
import type { EntityId, RelationId, WorldEntity, WorldSnapshot } from '../src/world/types';

const baseUrl = process.env.KUBEMOTION_BASE_URL ?? 'http://127.0.0.1:4173';
const outputDirectory = path.resolve('docs/review/evidence/m4');
const serviceLessonId = 'service-routes-to-pods';
const serviceStep = 5;
const endpointSliceId = 'api-object:namespaced:shop:EndpointSlice:api-slice';
const normalView: EntityViewState = Object.freeze({
  visible: true,
  emphasis: 'normal',
  labelMode: 'short',
});

interface Rectangle {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface SceneDiagnostics {
  readonly entityHandles: number;
  readonly activeAnimations: number;
  readonly retainedExitHandles: number;
  readonly routeHandles: number;
  readonly arrowheads: number;
  readonly [key: string]: number;
}

type CaptureGate = 'desktop-m4' | 'known-m5-risk';
type CaptureRoute =
  | { readonly kind: 'explore'; readonly view: ViewProjection['view'] }
  | { readonly kind: 'lesson'; readonly lessonId: string; readonly step: number };

interface Capture {
  readonly id: string;
  readonly file: string;
  readonly viewport: ViewportSize;
  readonly gate: CaptureGate;
  readonly route: CaptureRoute;
  readonly expectedWorld: WorldSnapshot;
  readonly expectedProjection: ViewProjection;
  readonly requiredKinds?: Readonly<Record<string, number>>;
  readonly forbiddenKinds?: readonly string[];
  readonly requireTrafficRoute?: boolean;
}

const readYaml = async (relativePath: string): Promise<unknown> =>
  parse(await readFile(path.resolve(relativePath), 'utf8'), { merge: true });

const loadScenario = async (relativePath: string): Promise<WorldSnapshot> => {
  const authored = scenarioV2AuthorSchema.parse(await readYaml(relativePath));
  return validateWorldSnapshot({
    schemaVersion: 2,
    scenarioId: authored.scenarioId,
    revision: authored.revision,
    entities: Object.fromEntries(authored.entities.map((entity) => [entity.id, entity])),
    relations: Object.fromEntries(authored.relations.map((relation) => [relation.id, relation])),
  });
};

const loadLesson = async (relativePath: string): Promise<LessonV2> =>
  lessonV2Schema.parse(await readYaml(relativePath)) as unknown as LessonV2;

const goldenWorld = await loadScenario('content/scenarios/container-restart-golden.yaml');
const serviceWorld = await loadScenario('content/scenarios/service-routes-to-pods.yaml');
const serviceLesson = await loadLesson(
  'content/courses/kubernetes-foundations/lessons/service-routes-to-pods.yaml',
);
const compiledService = courseEngine.compileLesson(serviceLesson, serviceWorld);
const trafficStep = compiledService.steps[serviceStep]!;
if (trafficStep === undefined) throw new Error(`Missing ${serviceLessonId} step ${serviceStep}`);

const exploreProjection = (world: WorldSnapshot, view: ViewProjection['view']): ViewProjection => {
  const entityStates = Object.fromEntries(
    Object.values(world.entities).map((entity) => [
      entity.id,
      {
        visible: true,
        emphasis: 'normal',
        labelMode: 'short',
      } satisfies EntityViewState,
    ]),
  ) as Record<EntityId, EntityViewState>;
  const relationStates = Object.fromEntries(
    Object.values(world.relations).map((relation) => [
      relation.id,
      { visible: true, emphasis: 'normal' } satisfies RelationViewState,
    ]),
  ) as Record<RelationId, RelationViewState>;
  return createEffectiveScenePlan(
    world,
    {
      view,
      entityStates,
      relationStates,
      callouts: [],
      activeRoutes: [],
      cameraPresetId: view,
    },
    { viewport: 'desktop', applyGrammarDefaults: true },
  ).projection;
};

const logicalProjection = exploreProjection(goldenWorld, 'logical');
const placementProjection = exploreProjection(goldenWorld, 'placement');
const controlFlowProjection = exploreProjection(goldenWorld, 'control-flow');

const captures: readonly Capture[] = [
  {
    id: 'logical-objects-desktop-wide',
    file: 'm4-logical-objects-1440x900.png',
    viewport: { width: 1440, height: 900 },
    gate: 'desktop-m4',
    route: { kind: 'explore', view: 'logical' },
    expectedWorld: goldenWorld,
    expectedProjection: logicalProjection,
    requiredKinds: { Namespace: 1, Deployment: 1, ReplicaSet: 1, Pod: 3 },
    forbiddenKinds: ['Node', 'Kubelet', 'ContainerRuntime', 'Container'],
  },
  {
    id: 'logical-objects-desktop-compact',
    file: 'm4-logical-objects-1280x720.png',
    viewport: { width: 1280, height: 720 },
    gate: 'desktop-m4',
    route: { kind: 'explore', view: 'logical' },
    expectedWorld: goldenWorld,
    expectedProjection: logicalProjection,
    requiredKinds: { Namespace: 1, Deployment: 1, ReplicaSet: 1, Pod: 3 },
    forbiddenKinds: ['Node', 'Kubelet', 'ContainerRuntime', 'Container'],
  },
  {
    id: 'placement-separation-desktop-compact',
    file: 'm4-logical-vs-placement-1280x720.png',
    viewport: { width: 1280, height: 720 },
    gate: 'desktop-m4',
    route: { kind: 'explore', view: 'placement' },
    expectedWorld: goldenWorld,
    expectedProjection: placementProjection,
    requiredKinds: { Node: 3, Pod: 3 },
    forbiddenKinds: ['Namespace', 'Deployment', 'ReplicaSet'],
  },
  {
    id: 'traffic-models-desktop-wide',
    file: 'm4-traffic-models-1440x900.png',
    viewport: { width: 1440, height: 900 },
    gate: 'desktop-m4',
    route: { kind: 'lesson', lessonId: serviceLessonId, step: serviceStep },
    expectedWorld: trafficStep.world,
    expectedProjection: trafficStep.view,
    requiredKinds: { Service: 1, EndpointSlice: 1, Pod: 4 },
    forbiddenKinds: ['Deployment', 'ReplicaSet', 'Namespace'],
    requireTrafficRoute: true,
  },
  {
    id: 'external-control-actor-desktop-compact',
    file: 'm4-external-control-actor-1280x720.png',
    viewport: { width: 1280, height: 720 },
    gate: 'desktop-m4',
    route: { kind: 'explore', view: 'control-flow' },
    expectedWorld: goldenWorld,
    expectedProjection: controlFlowProjection,
    requiredKinds: { Kubectl: 1, KubeAPIServer: 1 },
  },
  {
    id: 'logical-objects-mobile-risk-record',
    file: 'm4-logical-objects-390x844.png',
    viewport: { width: 390, height: 844 },
    gate: 'known-m5-risk',
    route: { kind: 'explore', view: 'logical' },
    expectedWorld: goldenWorld,
    expectedProjection: logicalProjection,
    requiredKinds: { Namespace: 1, Deployment: 1, ReplicaSet: 1, Pod: 3 },
    forbiddenKinds: ['Node', 'Kubelet', 'ContainerRuntime', 'Container'],
  },
];

function overlapRatio(left: Rectangle, right: Rectangle): number {
  const width = Math.max(
    0,
    Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x),
  );
  const height = Math.max(
    0,
    Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y),
  );
  const smallerArea = Math.min(left.width * left.height, right.width * right.height);
  return smallerArea <= 0 ? 0 : (width * height) / smallerArea;
}

const visibleEntities = (
  world: WorldSnapshot,
  projection: ViewProjection,
): readonly WorldEntity[] =>
  Object.values(world.entities).filter(
    (entity) =>
      projection.entityStates[entity.id]?.visible === true &&
      projection.entityStates[entity.id]?.emphasis !== 'hidden',
  );

const kindCounts = (entities: readonly WorldEntity[]): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const entity of entities) counts[entity.kind] = (counts[entity.kind] ?? 0) + 1;
  return Object.freeze(counts);
};

const roles = (root: {
  traverse(callback: (object: { userData: Record<string, unknown> }) => void): void;
}): string[] => {
  const result: string[] = [];
  root.traverse((object) => {
    if (typeof object.userData.role === 'string') result.push(object.userData.role);
  });
  return result;
};

const externalActor = (kind: 'Browser' | 'Developer'): WorldEntity => ({
  id: `external:external:global:${kind}:m4-audit`,
  category: 'external',
  kind,
  name: kind === 'Browser' ? 'shop-user' : 'platform-engineer',
  status: 'healthy',
  data:
    kind === 'Browser'
      ? { url: 'https://shop.example.test', requestTarget: 'api' }
      : { command: 'kubectl apply -f app.yaml', apiTarget: 'kube-apiserver' },
  title: { en: kind, ja: kind, 'zh-CN': kind },
  summary: { en: kind, ja: kind, 'zh-CN': kind },
  sourceIds: ['m4-audit'],
  visual: { archetype: 'external', size: 'md' },
});

interface ModelRequirement {
  readonly id: string;
  readonly entity: WorldEntity;
  readonly visualKind: string;
  readonly roles: readonly string[];
}

const requiredEntity = (world: WorldSnapshot, kind: string): WorldEntity => {
  const entity = Object.values(world.entities).find((candidate) => candidate.kind === kind);
  if (!entity) throw new Error(`M4 model audit cannot find ${kind}`);
  return entity;
};

const modelRequirements: readonly ModelRequirement[] = [
  {
    id: 'namespace',
    entity: requiredEntity(goldenWorld, 'Namespace'),
    visualKind: 'namespace-logical-workspace',
    roles: ['namespace-workspace-surface', 'namespace-boundary-rail', 'namespace-title-dock'],
  },
  {
    id: 'deployment',
    entity: requiredEntity(goldenWorld, 'Deployment'),
    visualKind: 'deployment-blueprint',
    roles: [
      'deployment-blueprint-board',
      'deployment-strategy-badge',
      'deployment-version-badge',
      'deployment-rollout-arrow',
    ],
  },
  {
    id: 'replicaset',
    entity: requiredEntity(goldenWorld, 'ReplicaSet'),
    visualKind: 'replicaset-reconcile-card',
    roles: [
      'replicaset-control-card',
      'replicaset-counter-deck',
      'replicaset-counter',
      'replicaset-pod-marker',
    ],
  },
  {
    id: 'service',
    entity: requiredEntity(serviceWorld, 'Service'),
    visualKind: 'service-routing-hub',
    roles: ['service-hub', 'service-stable-ring', 'service-portal', 'service-status-rail'],
  },
  {
    id: 'endpoint-slice',
    entity: trafficStep.world.entities[endpointSliceId]!,
    visualKind: 'endpoint-slice-inventory-card',
    roles: [
      'endpoint-slice-table',
      'endpoint-slice-header',
      'endpoint-row',
      'endpoint-ready-marker',
      'endpoint-target-pod-chip',
    ],
  },
  {
    id: 'kubectl',
    entity: requiredEntity(goldenWorld, 'Kubectl'),
    visualKind: 'kubectl-command-entry',
    roles: ['kubectl-console', 'kubectl-command-screen', 'kubectl-prompt-chevron'],
  },
  {
    id: 'browser',
    entity: externalActor('Browser'),
    visualKind: 'external-client-browser-terminal',
    roles: [
      'external-client-browser-frame',
      'external-client-browser-screen',
      'external-client-address-rail',
      'external-client-request-port',
    ],
  },
  {
    id: 'developer',
    entity: externalActor('Developer'),
    visualKind: 'developer-cli-station',
    roles: ['developer-terminal', 'developer-cli-screen', 'developer-prompt', 'developer-api-port'],
  },
];

function runModelAudit() {
  const registry = new VisualFactoryRegistry();
  const audits = modelRequirements.map((requirement) => {
    const factory = registry.resolve(requirement.entity);
    if (!factory) throw new Error(`${requirement.id}: specialized factory is missing`);
    const handle = registry.create(requirement.entity, normalView, { allowGeneric: false });
    const actualRoles = roles(handle.root);
    const visualKind = handle.root.userData.visualKind;
    const missingRoles = requirement.roles.filter((role) => !actualRoles.includes(role));
    const generic = handle.root.userData.genericVisual === true;
    const podRoles = actualRoles.filter(
      (role) => role === 'pod-shell' || role === 'pod-container-slot' || role === 'container-slot',
    );
    if (visualKind !== requirement.visualKind) {
      throw new Error(
        `${requirement.id}: visualKind=${String(visualKind)} (expected ${requirement.visualKind})`,
      );
    }
    if (missingRoles.length > 0) {
      throw new Error(`${requirement.id}: missing roles ${missingRoles.join(', ')}`);
    }
    if (generic) throw new Error(`${requirement.id}: generic fallback is forbidden`);
    if ((requirement.id === 'browser' || requirement.id === 'developer') && podRoles.length > 0) {
      throw new Error(`${requirement.id}: external actor exposes Pod roles ${podRoles.join(', ')}`);
    }
    const audit = {
      id: requirement.id,
      entityKind: requirement.entity.kind,
      factoryId: factory.id,
      visualKind,
      requiredRoles: requirement.roles,
      roleSignature: [...new Set(actualRoles)].sort(),
      generic,
      podRoles,
    };
    handle.dispose();
    return audit;
  });
  const uniqueVisualKinds = new Set(audits.map((audit) => audit.visualKind));
  const uniqueRoleSignatures = new Set(audits.map((audit) => audit.roleSignature.join('|')));
  if (uniqueVisualKinds.size !== audits.length) {
    throw new Error('M4 model audit: visualKind values are not unique');
  }
  if (uniqueRoleSignatures.size !== audits.length) {
    throw new Error('M4 model audit: role signatures are not unique');
  }
  return {
    status: 'pass',
    modelCount: audits.length,
    genericVisualHandles: audits.filter((audit) => audit.generic).length,
    uniqueVisualKinds: uniqueVisualKinds.size,
    uniqueRoleSignatures: uniqueRoleSignatures.size,
    models: audits,
  };
}

function runEndpointAndRouteAudit() {
  const route = trafficStep.view.activeRoutes[0];
  if (!route) throw new Error('M4 traffic audit requires an active route');
  const routeParticipants = route.hops.flatMap((hop) => [hop.fromEntityId, hop.toEntityId]);
  if (routeParticipants.includes(endpointSliceId)) {
    throw new Error('Traffic request incorrectly traverses the EndpointSlice API object');
  }
  const selectedTarget = route.hops.at(-1)?.toEntityId;
  if (!selectedTarget) throw new Error('Traffic route has no selected backend');

  const sliceEntity = trafficStep.world.entities[endpointSliceId];
  if (!sliceEntity) throw new Error('Traffic step is missing EndpointSlice');
  const authoredEndpoints = sliceEntity.data.endpoints;
  if (!Array.isArray(authoredEndpoints)) throw new Error('EndpointSlice endpoints are missing');
  const registry = new VisualFactoryRegistry();
  const handle = registry.create(sliceEntity, trafficStep.view.entityStates[endpointSliceId]!, {
    allowGeneric: false,
  });
  if (!(handle instanceof EndpointSliceVisualHandle)) {
    throw new Error('EndpointSlice did not resolve to EndpointSliceVisualHandle');
  }
  const initialRowUuids = handle.endpointSlots.map((slot) => slot.uuid);
  if (initialRowUuids.length !== authoredEndpoints.length) {
    throw new Error(
      `EndpointSlice exposes ${initialRowUuids.length} rows for ${authoredEndpoints.length} endpoints`,
    );
  }
  const extraEndpoints = [
    {
      address: '192.0.2.21',
      targetRef: 'api-object:namespaced:shop:Pod:api-d',
      conditions: { ready: true, serving: true, terminating: false },
    },
    {
      address: '192.0.2.22',
      targetRef: 'api-object:namespaced:shop:Pod:api-e',
      conditions: { ready: false, serving: false, terminating: true },
    },
  ];
  handle.update(
    {
      ...sliceEntity,
      data: { ...sliceEntity.data, endpoints: [...authoredEndpoints, ...extraEndpoints] },
    },
    trafficStep.view.entityStates[endpointSliceId]!,
  );
  const expandedRows = handle.endpointSlots.length;
  const preservedInitialRows = initialRowUuids.every(
    (uuid, index) => handle.endpointSlots[index]?.uuid === uuid,
  );
  handle.setSelectedEndpoint(selectedTarget);
  const selectedRows = handle.endpointSlots.filter((slot) => slot.userData.selected === true);
  if (expandedRows !== authoredEndpoints.length + extraEndpoints.length || !preservedInitialRows) {
    throw new Error('EndpointSlice rows do not grow dynamically in place');
  }
  if (selectedRows.length !== 1 || selectedRows[0]?.userData.targetRef !== selectedTarget) {
    throw new Error('EndpointSlice selected row does not match the traffic route backend');
  }
  const result = {
    status: 'pass',
    routeId: route.id,
    requestId: route.requestId,
    routeParticipants,
    endpointSliceIsRouteHop: false,
    selectedTarget,
    initialRows: authoredEndpoints.length,
    expandedRows,
    preservedInitialRows,
    selectedRows: selectedRows.length,
  };
  handle.dispose();
  return result;
}

function auditExpectedScene(capture: Capture) {
  const visible = visibleEntities(capture.expectedWorld, capture.expectedProjection);
  const counts = kindCounts(visible);
  const failures: string[] = [];
  for (const [kind, expected] of Object.entries(capture.requiredKinds ?? {})) {
    if ((counts[kind] ?? 0) !== expected) {
      failures.push(`${kind}=${counts[kind] ?? 0} (expected ${expected})`);
    }
  }
  for (const kind of capture.forbiddenKinds ?? []) {
    if ((counts[kind] ?? 0) !== 0) failures.push(`${kind}=${counts[kind]} (expected 0)`);
  }
  const registry = new VisualFactoryRegistry();
  let genericVisualHandles = 0;
  const visualKinds: string[] = [];
  for (const entity of visible) {
    const state = capture.expectedProjection.entityStates[entity.id];
    if (!state) throw new Error(`${capture.id}: missing state for ${entity.id}`);
    const handle = registry.create(entity, state, { allowGeneric: false });
    if (handle.root.userData.genericVisual === true) genericVisualHandles += 1;
    visualKinds.push(String(handle.root.userData.visualKind));
    handle.dispose();
  }
  if (genericVisualHandles !== 0) failures.push(`genericVisualHandles=${genericVisualHandles}`);
  if (failures.length > 0) {
    throw new Error(`${capture.id}: expected-scene gate failed: ${failures.join('; ')}`);
  }
  return {
    visibleEntityCount: visible.length,
    visibleKinds: counts,
    genericVisualHandles,
    visualKinds: [...new Set(visualKinds)].sort(),
  };
}

async function waitForSettledScene(page: Page): Promise<void> {
  await page.getByTestId('scene-viewport').waitFor({ state: 'visible' });
  await page.locator('canvas').waitFor({ state: 'visible' });
  await page.waitForFunction(
    () => {
      const diagnostics = (
        globalThis as unknown as {
          __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
        }
      ).__KUBEMOTION_TEST__?.getSceneDiagnostics();
      return (
        diagnostics !== undefined &&
        diagnostics.entityHandles > 0 &&
        diagnostics.activeAnimations === 0 &&
        diagnostics.retainedExitHandles === 0
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(240);
}

async function inspectPage(page: Page) {
  const labelLocator = page.locator('.scene-viewport .scene-label:visible');
  const labelBoxes = (
    await Promise.all(
      Array.from({ length: await labelLocator.count() }, (_, index) =>
        labelLocator.nth(index).boundingBox(),
      ),
    )
  ).filter((box): box is Rectangle => box !== null);
  let maximumLabelOverlap = 0;
  for (let left = 0; left < labelBoxes.length; left += 1) {
    for (let right = left + 1; right < labelBoxes.length; right += 1) {
      maximumLabelOverlap = Math.max(
        maximumLabelOverlap,
        overlapRatio(labelBoxes[left] as Rectangle, labelBoxes[right] as Rectangle),
      );
    }
  }
  const stage = await page.getByTestId('scene-viewport').boundingBox();
  const labelsOutsideStage = stage
    ? labelBoxes.filter(
        (box) =>
          box.x < stage.x ||
          box.y < stage.y ||
          box.x + box.width > stage.x + stage.width ||
          box.y + box.height > stage.y + stage.height,
      ).length
    : labelBoxes.length;
  const diagnostics = await page.evaluate(() =>
    (
      globalThis as unknown as {
        __KUBEMOTION_TEST__?: { getSceneDiagnostics: () => SceneDiagnostics | undefined };
      }
    ).__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  if (!diagnostics) throw new Error('Scene diagnostics are unavailable');
  return {
    labels: labelBoxes.length,
    entityLabels: await page.locator('.scene-label[data-entity-id]:visible').count(),
    layoutLabels: await page.locator('.scene-layout-label:visible').count(),
    routeLabels: await page.locator('.scene-route-label:visible').count(),
    maximumLabelOverlap,
    labelsOutsideStage,
    diagnostics,
  };
}

async function openCapture(page: Page, capture: Capture): Promise<void> {
  if (capture.route.kind === 'lesson') {
    await page.goto(`${baseUrl}/#/learn/${capture.route.lessonId}/${capture.route.step}`);
    await waitForSettledScene(page);
    return;
  }
  await page.goto(`${baseUrl}/#/explore`);
  await waitForSettledScene(page);
  if (capture.route.view !== 'overview') {
    await page.locator(`#explore-view-tab-${capture.route.view}`).click();
    await waitForSettledScene(page);
  }
}

function assertRenderedGate(
  capture: Capture,
  expectedScene: ReturnType<typeof auditExpectedScene>,
  inspection: Awaited<ReturnType<typeof inspectPage>>,
): void {
  const failures: string[] = [];
  if (inspection.diagnostics.entityHandles !== expectedScene.visibleEntityCount) {
    failures.push(
      `entityHandles=${inspection.diagnostics.entityHandles} (expected ${expectedScene.visibleEntityCount})`,
    );
  }
  if (inspection.maximumLabelOverlap !== 0) {
    failures.push(`maximumLabelOverlap=${inspection.maximumLabelOverlap} (expected 0)`);
  }
  if (inspection.labelsOutsideStage !== 0) {
    failures.push(`labelsOutsideStage=${inspection.labelsOutsideStage} (expected 0)`);
  }
  if (capture.requireTrafficRoute) {
    if (inspection.diagnostics.routeHandles < 1) {
      failures.push(`routeHandles=${inspection.diagnostics.routeHandles} (expected >=1)`);
    }
    if (inspection.diagnostics.arrowheads < 1) {
      failures.push(`arrowheads=${inspection.diagnostics.arrowheads} (expected >=1)`);
    }
  }
  if (failures.length > 0) {
    throw new Error(`${capture.id}: rendered M4 gate failed: ${failures.join('; ')}`);
  }
}

await mkdir(outputDirectory, { recursive: true });
const modelAudit = runModelAudit();
const endpointAndRouteAudit = runEndpointAndRouteAudit();
const browser = await chromium.launch({
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const results: Array<Record<string, unknown>> = [];

try {
  for (const capture of captures) {
    const expectedScene = auditExpectedScene(capture);
    const context = await browser.newContext({
      viewport: capture.viewport,
      colorScheme: 'dark',
      locale: 'en-US',
      reducedMotion: 'reduce',
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    await openCapture(page, capture);
    const inspection = await inspectPage(page);
    assertRenderedGate(capture, expectedScene, inspection);
    await page.screenshot({
      path: path.join(outputDirectory, capture.file),
      animations: 'disabled',
      caret: 'hide',
      fullPage: false,
      scale: 'css',
    });
    results.push({
      id: capture.id,
      file: capture.file,
      viewport: capture.viewport,
      gate: capture.gate,
      route: capture.route,
      status: capture.gate === 'known-m5-risk' ? 'recorded' : 'pass',
      expectedScene,
      inspection,
      acceptance: {
        genericVisualHandles: 0,
        maximumLabelOverlap: 0,
        labelsOutsideStage: 0,
        note:
          capture.gate === 'known-m5-risk'
            ? 'Responsive composition remains a recorded M5 risk; M4 model semantics still pass.'
            : 'Automated M4 rendered-scene gate passed.',
      },
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const manifest = {
  generatedAt: new Date().toISOString(),
  milestone: 4,
  baseUrl,
  status: 'pass',
  gates: {
    genericVisualHandles: 0,
    maximumLabelOverlap: 0,
    labelsOutsideStage: 0,
    logicalVisibleKinds: { Namespace: 1, Deployment: 1, ReplicaSet: 1, Pod: 3 },
    logicalVisibleNodes: 0,
    placementHiddenKinds: ['Namespace', 'Deployment', 'ReplicaSet'],
    endpointRowsDynamic: true,
    trafficRequestTraversesEndpointSlice: false,
    visualKindsUnique: true,
    roleSignaturesUnique: true,
  },
  modelAudit,
  endpointAndRouteAudit,
  mobilePolicy:
    'The 390x844 capture records the known M5 responsive-layout risk and does not fail M4.',
  captures: results,
};

const manifestPath = path.join(outputDirectory, 'm4-logical-models-manifest.json');
const prettierConfig = (await resolveConfig(manifestPath)) ?? {};
await writeFile(
  manifestPath,
  await format(JSON.stringify(manifest), { ...prettierConfig, filepath: manifestPath }),
  'utf8',
);

console.log(`Captured and checked ${results.length} M4 logical-model views in ${outputDirectory}.`);
