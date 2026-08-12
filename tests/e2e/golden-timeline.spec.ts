import { expect, test } from '@playwright/test';
import { GOLDEN_LESSON, STEP_TITLES, gotoGoldenStep, waitForSceneIdle } from './helpers';

interface RouteAnimationProbe {
  done: boolean;
  timedOut: boolean;
  sawFlowToken: boolean;
  samples: number;
  maximumEndpointDrift: number;
  maximumOffRouteTokens: number;
  maximumTokenDistance: number;
  maximumReplanFailures: number;
}

test('all ten steps expose the correct causal and factual timeline', async ({ page }) => {
  await gotoGoldenStep(page, 0);
  await expect(
    page.locator('.lesson-header').getByRole('link', { name: 'Back to home' }),
  ).toHaveAttribute('href', '#/');
  await expect(page.getByTestId('teaching-plain-language')).toBeVisible();
  await expect(page.getByTestId('teaching-focus-hint')).toBeVisible();
  // Control Flow owns its zones now instead of borrowing the Overview islands, and a step with no
  // unscheduled Pod no longer emits an empty transit tray.
  await expect(page.locator('.scene-layout-label')).toContainText([
    'Control plane',
    'Worker Nodes',
    'Workload state',
  ]);

  await gotoGoldenStep(page, 1);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0');
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 2);
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Container state changed from running to terminated',
  );
  await expect(page.getByTestId('teaching-what-changed')).toContainText('Pod became NotReady');
  await expect(page.getByTestId('teaching-why-it-happened')).toContainText(
    'no action deleted or replaced the Pod API object',
  );

  await gotoGoldenStep(page, 3);
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0→1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container ID');
  await expect(page.getByTestId('evidence-panel')).toContainText(
    'Last termination reasonAbsent→Error',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 4);
  await expect(page.getByTestId('evidence-panel')).toContainText('removed');
  await expect(page.getByTestId('evidence-panel')).toContainText(
    'ReplicaSet SPEC / OBSERVED / READY',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText(/3\/3\/3.*3\/2\/2/);
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 2.*READY 2/);

  await gotoGoldenStep(page, 5);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container statewaiting');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pending, unscheduled, NotReady Pod',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 2/);

  await gotoGoldenStep(page, 6);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending');

  await gotoGoldenStep(page, 7);
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled→worker-c');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container statewaiting');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pending Pod gained nodeName worker-c',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 2/);
  const schedulingDiagnostics = await page.evaluate(() =>
    window.__KUBEMOTION_TEST__?.getSceneDiagnostics(),
  );
  expect(schedulingDiagnostics).toMatchObject({
    routeHandles: 2,
    routeObstacleIntersections: 0,
    routeEndpointDriftCount: 0,
    activeRouteWidthsBelowMinimum: 0,
    visibleRoutesWithoutArrowheads: 0,
    routesOutsideSafeRect: 0,
    arrowheadsOutsideSafeRect: 0,
    routeMarkersOutsideSafeRect: 0,
  });
  if ((page.viewportSize()?.width ?? 0) <= 390) {
    await expect(page.locator('.scene-route-label:not([hidden])')).toContainText('worker-c');
  }

  await gotoGoldenStep(page, 8);
  await expect(page.getByTestId('evidence-panel')).toContainText('waiting→running');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pod became Running and ready',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 9);
  const comparison = page.getByTestId('comparison-panel');
  await expect(comparison).toContainText('Container restart');
  await expect(comparison).toContainText('Pod replacement');
  await expect(comparison).toContainText('synthetic-uid-old-a1');
  await expect(comparison).toContainText('synthetic-uid-new-d1');
  await expect(comparison.locator('dt')).toHaveCount(12);
  await expect(comparison.locator('.replacement-runtime')).toHaveCount(1);
});

test('normal-motion scheduling keeps every token on the live replanned route', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280-chromium',
    'One desktop project owns the frame-by-frame route gate',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto(`/#/learn/${GOLDEN_LESSON}/7`);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(STEP_TITLES[7]);
  // Direct navigation can finish its initial transition before page.goto resolves. Replay only
  // after the scene settles so this gate samples the complete routed animation deterministically.
  await waitForSceneIdle(page);
  // Arm the sampler inside the page before Replay. A cross-process Playwright poll can miss the
  // sub-second token lifetime when all browser projects are saturated, while this requestAnimationFrame
  // probe is already queued ahead of the renderer's next animation frame.
  await page.evaluate(() => {
    const routeWindow = window as typeof window & {
      __KUBEMOTION_ROUTE_PROBE__?: RouteAnimationProbe;
    };
    const probe: RouteAnimationProbe = {
      done: false,
      timedOut: false,
      sawFlowToken: false,
      samples: 0,
      maximumEndpointDrift: 0,
      maximumOffRouteTokens: 0,
      maximumTokenDistance: 0,
      maximumReplanFailures: 0,
    };
    routeWindow.__KUBEMOTION_ROUTE_PROBE__ = probe;
    const deadline = performance.now() + 10_000;
    const sample = (): void => {
      const diagnostics = routeWindow.__KUBEMOTION_TEST__?.getSceneDiagnostics();
      probe.samples += 1;
      if (diagnostics) {
        probe.sawFlowToken ||= diagnostics.flowTokens > 0;
        probe.maximumEndpointDrift = Math.max(
          probe.maximumEndpointDrift,
          diagnostics.routeEndpointDriftCount,
        );
        probe.maximumOffRouteTokens = Math.max(
          probe.maximumOffRouteTokens,
          diagnostics.flowTokensOffRoute,
        );
        probe.maximumTokenDistance = Math.max(
          probe.maximumTokenDistance,
          diagnostics.maximumFlowTokenRouteDistance,
        );
        probe.maximumReplanFailures = Math.max(
          probe.maximumReplanFailures,
          diagnostics.routeReplanFailures,
        );
        if (probe.sawFlowToken && diagnostics.activeAnimations === 0) {
          probe.done = true;
          return;
        }
      }
      if (performance.now() >= deadline) {
        probe.timedOut = true;
        probe.done = true;
        return;
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator('.lesson-header-actions button').first().click();
  await page.waitForFunction(
    () =>
      (window as typeof window & { __KUBEMOTION_ROUTE_PROBE__?: RouteAnimationProbe })
        .__KUBEMOTION_ROUTE_PROBE__?.done,
    undefined,
    { timeout: 15_000 },
  );
  const probe = await page.evaluate(
    () =>
      (window as typeof window & { __KUBEMOTION_ROUTE_PROBE__?: RouteAnimationProbe })
        .__KUBEMOTION_ROUTE_PROBE__,
  );
  if (!probe) throw new Error('The in-page route animation probe was not installed');
  expect(probe).toMatchObject({
    done: true,
    timedOut: false,
    sawFlowToken: true,
    maximumEndpointDrift: 0,
    maximumOffRouteTokens: 0,
    maximumReplanFailures: 0,
  });
  expect(probe.maximumTokenDistance).toBeLessThanOrEqual(0.02);
  await waitForSceneIdle(page);
  expect(
    await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()),
  ).toMatchObject({
    routeHandles: 2,
    flowTokens: 0,
    routeEndpointDriftCount: 0,
    routeObstacleIntersections: 0,
    routeReplanFailures: 0,
  });
});
