import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import type { Position } from '../../src/renderer/LayoutEngine';
import { waitForSceneIdle } from './helpers';

const evidenceDirectory = path.resolve('docs/review/evidence/batch03');
const diagnosticsFile = path.join(evidenceDirectory, 'batch03-traffic-diagnostics.json');

const IDS = Object.freeze({
  internalClient: 'api-object:namespaced:shop:Pod:traffic-client',
  service: 'api-object:namespaced:shop:Service:api',
  endpointSlice: 'api-object:namespaced:shop:EndpointSlice:api-slice',
  apiA: 'api-object:namespaced:shop:Pod:api-a',
  apiB: 'api-object:namespaced:shop:Pod:api-b',
  apiC: 'api-object:namespaced:shop:Pod:api-c',
  dnsClient: 'api-object:namespaced:shop:Pod:dns-client',
  kubeDns: 'api-object:namespaced:kube-system:Service:kube-dns',
  kubeDnsSlice: 'api-object:namespaced:kube-system:EndpointSlice:kube-dns-slice',
  coreDns: 'api-object:namespaced:kube-system:Pod:coredns-a',
  browser: 'external:internet:global:Browser:shopper',
  gatewayDataPlane: 'infrastructure:cluster:global:GatewayDataPlane:edge-gateway',
  webService: 'api-object:namespaced:shop:Service:web',
  webSlice: 'api-object:namespaced:shop:EndpointSlice:web-slice',
  webA: 'api-object:namespaced:shop:Pod:web-a',
  rolloutClient: 'api-object:namespaced:shop:Pod:rollout-client',
  rolloutV2: 'api-object:namespaced:shop:Pod:api-v2-a',
});

interface CaptureCase {
  readonly id: string;
  readonly file: string;
  readonly lessonId: string;
  readonly stepIndex: number;
  readonly title: string;
  readonly viewport: { readonly width: number; readonly height: number };
  readonly xOrder: readonly string[];
  readonly endpointSliceId: string;
  readonly corridorIds: readonly string[];
}

interface CaptureResult {
  readonly id: string;
  readonly file: string;
  readonly lessonId: string;
  readonly stepIndex: number;
  readonly viewport: CaptureCase['viewport'];
  readonly diagnostics: SceneDiagnostics;
  readonly positions: Readonly<Record<string, Position>>;
}

const desktop = { width: 1280, height: 720 } as const;
const captures: readonly CaptureCase[] = [
  {
    id: 'request-a',
    file: 'batch03-request-a.png',
    lessonId: 'service-routes-to-pods',
    stepIndex: 3,
    title: 'Request A reaches Ready endpoint api-a',
    viewport: desktop,
    xOrder: [IDS.internalClient, IDS.service, IDS.apiA],
    endpointSliceId: IDS.endpointSlice,
    corridorIds: [IDS.internalClient, IDS.service, IDS.apiA, IDS.apiB, IDS.apiC],
  },
  {
    id: 'not-ready',
    file: 'batch03-not-ready.png',
    lessonId: 'service-routes-to-pods',
    stepIndex: 4,
    title: 'api-a remains listed but becomes NotReady',
    viewport: desktop,
    xOrder: [IDS.internalClient, IDS.service, IDS.apiC],
    endpointSliceId: IDS.endpointSlice,
    corridorIds: [IDS.internalClient, IDS.service, IDS.apiA, IDS.apiB, IDS.apiC],
  },
  {
    id: 'request-b',
    file: 'batch03-request-b.png',
    lessonId: 'service-routes-to-pods',
    stepIndex: 5,
    title: 'A later request selects another Ready endpoint',
    viewport: desktop,
    xOrder: [IDS.internalClient, IDS.service, IDS.apiC],
    endpointSliceId: IDS.endpointSlice,
    corridorIds: [IDS.internalClient, IDS.service, IDS.apiA, IDS.apiB, IDS.apiC],
  },
  {
    id: 'dns-query',
    file: 'batch03-dns-query.png',
    lessonId: 'dns-and-service-discovery',
    stepIndex: 1,
    title: 'Query cluster DNS and receive the answer',
    viewport: desktop,
    xOrder: [IDS.dnsClient, IDS.kubeDns, IDS.coreDns],
    endpointSliceId: IDS.kubeDnsSlice,
    corridorIds: [IDS.dnsClient, IDS.kubeDns, IDS.coreDns],
  },
  {
    id: 'external-request',
    file: 'batch03-external-request.png',
    lessonId: 'full-external-request',
    stepIndex: 4,
    title: 'Send the separate HTTPS request',
    viewport: desktop,
    xOrder: [IDS.browser, IDS.gatewayDataPlane, IDS.webService, IDS.webA],
    endpointSliceId: IDS.webSlice,
    corridorIds: [IDS.browser, IDS.gatewayDataPlane, IDS.webService, IDS.webA],
  },
  {
    id: 'rollout-shift',
    file: 'batch03-rollout-shift.png',
    lessonId: 'probes-and-rolling-update',
    stepIndex: 4,
    title: 'Ready v2 enters the backend set',
    viewport: desktop,
    xOrder: [IDS.rolloutClient, IDS.service, IDS.rolloutV2],
    endpointSliceId: IDS.endpointSlice,
    corridorIds: [IDS.rolloutClient, IDS.service, IDS.rolloutV2],
  },
  {
    id: 'request-a-mobile',
    file: 'batch03-request-a-mobile.png',
    lessonId: 'service-routes-to-pods',
    stepIndex: 3,
    title: 'Request A reaches Ready endpoint api-a',
    viewport: { width: 390, height: 844 },
    xOrder: [IDS.internalClient, IDS.service, IDS.apiA],
    endpointSliceId: IDS.endpointSlice,
    corridorIds: [IDS.internalClient, IDS.service, IDS.apiA],
  },
] as const;

const positionFor = (
  positions: Readonly<Record<string, Position>>,
  entityId: string,
  captureId: string,
): Position => {
  const position = positions[entityId];
  expect(position, `${captureId}: missing position for ${entityId}`).toBeDefined();
  if (!position) throw new Error(`${captureId}: missing position for ${entityId}`);
  return position;
};

const expectMonotonicX = (
  positions: Readonly<Record<string, Position>>,
  orderedIds: readonly string[],
  captureId: string,
): void => {
  for (let index = 1; index < orderedIds.length; index += 1) {
    const previousId = orderedIds[index - 1];
    const currentId = orderedIds[index];
    if (!previousId || !currentId) continue;
    expect(
      positionFor(positions, previousId, captureId)[0],
      `${captureId}: ${previousId} must remain left of ${currentId}`,
    ).toBeLessThan(positionFor(positions, currentId, captureId)[0]);
  }
};

async function captureCase(page: Page, capture: CaptureCase): Promise<CaptureResult> {
  await page.setViewportSize(capture.viewport);
  await page.goto(`/#/learn/${capture.lessonId}/${capture.stepIndex}`);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(capture.title);
  await waitForSceneIdle(page);

  const diagnostics = await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics());
  const positions = await page.evaluate(() =>
    window.__KUBEMOTION_TEST__?.getSceneLayoutPositions(),
  );
  if (!diagnostics) throw new Error(`Scene diagnostics were unavailable for ${capture.id}`);
  if (!positions) throw new Error(`Scene layout positions were unavailable for ${capture.id}`);

  expect(diagnostics.routeHandles, capture.id).toBeGreaterThanOrEqual(1);
  expect(diagnostics.visibleRoutesWithoutArrowheads, capture.id).toBe(0);
  expect(diagnostics.activeRouteWidthsBelowMinimum, capture.id).toBe(0);
  expect(diagnostics.routeObstacleIntersections, capture.id).toBe(0);
  expect(diagnostics.routeEndpointDriftCount, capture.id).toBe(0);
  expect(diagnostics.strongXRouteReversals, capture.id).toBe(0);
  expect(diagnostics.routesOutsideSafeRect, capture.id).toBe(0);
  expect(diagnostics.arrowheadsOutsideSafeRect, capture.id).toBe(0);
  expect(diagnostics.sceneBoundsOutsideContentRect, capture.id).toBe(0);

  expectMonotonicX(positions, capture.xOrder, capture.id);
  const supportZ = positionFor(positions, capture.endpointSliceId, capture.id)[2];
  const corridorFrontZ = Math.max(
    ...capture.corridorIds.map((id) => positionFor(positions, id, capture.id)[2]),
  );
  expect(
    supportZ,
    `${capture.id}: EndpointSlice must remain below the request corridor`,
  ).toBeGreaterThan(corridorFrontZ);
  expect(
    await page.locator('.scene-layout-label:not([hidden])').count(),
    capture.id,
  ).toBeLessThanOrEqual(4);
  expect(
    await page.locator('.scene-route-label:not([hidden])').count(),
    capture.id,
  ).toBeLessThanOrEqual(3);

  await page.screenshot({
    path: path.join(evidenceDirectory, capture.file),
    animations: 'disabled',
    caret: 'hide',
    fullPage: false,
    scale: 'css',
  });

  return {
    id: capture.id,
    file: capture.file,
    lessonId: capture.lessonId,
    stepIndex: capture.stepIndex,
    viewport: capture.viewport,
    diagnostics,
    positions,
  };
}

test('Batch 03 traffic stories keep a stable, directional, static composition', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280-chromium',
    'One deterministic desktop project owns Batch 03 and sets its mobile viewport directly.',
  );
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mkdir(evidenceDirectory, { recursive: true });
  await Promise.all([
    ...captures.map((capture) => rm(path.join(evidenceDirectory, capture.file), { force: true })),
    rm(diagnosticsFile, { force: true }),
  ]);

  // The v2 Pod must stay visible in its stable rollout slot before readiness admits it to the
  // EndpointSlice. This is a semantic preflight only; the handoff remains exactly seven images.
  await page.setViewportSize(desktop);
  await page.goto('/#/learn/probes-and-rolling-update/3');
  await expect(page.getByTestId('teaching-step-heading')).toContainText(
    'NotReady stays out of ordinary traffic',
  );
  await waitForSceneIdle(page);
  expect(
    await page.evaluate(
      (entityId) => Boolean(window.__KUBEMOTION_TEST__?.getSceneLayoutPositions()?.[entityId]),
      IDS.rolloutV2,
    ),
  ).toBe(true);
  expect(
    (await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()))?.routeHandles,
  ).toBe(0);

  const results: CaptureResult[] = [];
  for (const capture of captures) results.push(await captureCase(page, capture));

  const stableIds = [
    IDS.internalClient,
    IDS.service,
    IDS.endpointSlice,
    IDS.apiA,
    IDS.apiB,
    IDS.apiC,
  ] as const;
  const serviceResults = results.filter((result) =>
    ['request-a', 'not-ready', 'request-b'].includes(result.id),
  );
  expect(serviceResults).toHaveLength(3);
  const baselinePositions = serviceResults[0]?.positions;
  if (!baselinePositions) throw new Error('Request A positions were unavailable');
  for (const result of serviceResults.slice(1)) {
    for (const id of stableIds) {
      expect(positionFor(result.positions, id, result.id), `${result.id}: ${id} moved`).toEqual(
        positionFor(baselinePositions, id, 'request-a'),
      );
    }
  }

  await writeFile(
    diagnosticsFile,
    `${JSON.stringify(
      {
        baseline: '558eb401f5b179378f183f3eccd88a84c0aad73f',
        branch: 'rebuild/world-state-engine',
        captures: results,
      },
      undefined,
      2,
    )}\n`,
    'utf8',
  );
});
