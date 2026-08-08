import { expect, test, type Page } from '@playwright/test';
import { waitForSceneIdle } from './helpers';

const DESKTOP_PROJECT = 'desktop-1280-chromium';
const HPA_ID = 'api-object:namespaced:shop:HorizontalPodAutoscaler:api';
const NEW_HPA_POD_ID = 'api-object:namespaced:shop:Pod:api-c';

const expectedStoryLinks = [
  ['manifest-to-running-pod', '#/learn/manifest-to-running-pod/0'],
  ['internal-service-request', '#/learn/service-routes-to-pods/0'],
  ['dns-and-service-discovery', '#/learn/dns-and-service-discovery/0'],
  ['container-restart-vs-pod-replacement', '#/learn/container-restart-vs-pod-replacement/0'],
  ['readiness-failure-and-traffic-shift', '#/learn/service-routes-to-pods/3'],
  ['rolling-update-traffic-shift', '#/learn/probes-and-rolling-update/1'],
  ['external-browser-request', '#/learn/full-external-request/0'],
  ['hpa-scale-out', '#/learn/hpa/0'],
] as const;

async function gotoLessonStep(
  page: Page,
  lessonId: string,
  stepIndex: number,
  heading: string,
): Promise<void> {
  await page.goto(`/#/learn/${lessonId}/${stepIndex}`);
  await expect(page.getByTestId('teaching-step-heading')).toContainText(heading);
  await waitForSceneIdle(page);
}

async function visibleRouteSummary(page: Page): Promise<string> {
  const summary = await page.locator('#scene-accessible-summary').textContent();
  return summary?.split('Visible ').at(-1) ?? '';
}

test.describe('M9 verified Flow Stories', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name !== DESKTOP_PROJECT,
      'One deterministic desktop viewport owns the M9 semantic acceptance gate',
    );
  });

  test('Home exposes exactly eight first-class stories with causal-beat deep links', async ({
    page,
  }) => {
    await page.goto('/#/');

    const cards = page.locator('[data-flow-story-id]');
    await expect(cards).toHaveCount(8);
    await expect(page.getByRole('link', { name: 'Open story' })).toHaveCount(8);

    const storyLinks = await cards.evaluateAll((articles) =>
      articles.map((article) => [
        (article as HTMLElement).dataset.flowStoryId,
        article.querySelector('a')?.getAttribute('href'),
      ]),
    );
    expect(storyLinks).toEqual(expectedStoryLinks.map(([id, href]) => [id, href]));
  });

  test('external request separates public DNS from the persistent HTTPS data path', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await gotoLessonStep(page, 'full-external-request', 1, 'Resolve the public name first');
    await expect(
      page.locator('.scene-route-label:not([hidden])').filter({ hasText: 'Resolve shop.example' }),
    ).toHaveCount(1);
    const dnsRoute = await visibleRouteSummary(page);
    expect(dnsRoute).toContain('source shopper-browser at network-out, target public-dns');
    expect(dnsRoute).not.toMatch(/public-gateway|shop-route|edge-gateway|web-slice|web-a/);
    expect(
      await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()),
    ).toMatchObject({
      routeHandles: 1,
      activeAnimations: 0,
      visibleRoutesWithoutArrowheads: 0,
    });

    await gotoLessonStep(page, 'full-external-request', 2, 'Configuration programs the entry');
    await expect(page.locator('.scene-route-label:not([hidden])')).toHaveCount(0);
    await expect(page.getByTestId('teaching-takeaway')).toContainText(
      'Gateway and HTTPRoute explain configuration',
    );

    await gotoLessonStep(page, 'full-external-request', 4, 'Send the separate HTTPS request');
    await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
      'Resolved listener address',
      'Programmed backend Service',
      'Selected Ready web-a',
    ]);

    const httpsRoute = await visibleRouteSummary(page);
    expect(httpsRoute).toContain(
      'source shopper-browser at network-out, target edge-gateway at network-in',
    );
    expect(httpsRoute).toContain('source edge-gateway at network-out, target web at network-in');
    expect(httpsRoute).toContain('source web at network-out, target web-a at network-in');
    expect(httpsRoute).not.toMatch(/public-gateway|shop-route|web-slice|public-dns/);
    expect(
      await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()),
    ).toMatchObject({
      routeHandles: 1,
      activeAnimations: 0,
      routeObstacleIntersections: 0,
      activeRouteWidthsBelowMinimum: 0,
      visibleRoutesWithoutArrowheads: 0,
    });
  });

  test('HPA turns 78 over 60 into desired three, then controllers create one Ready Pod', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await gotoLessonStep(page, 'hpa', 0, 'CPU rises above the target');
    await expect(page.getByTestId('teaching-what-changed')).toContainText('changed from 45 to 78');
    await expect(page.locator('.scene-route-label:not([hidden])')).toContainText(
      'observed 78 / target 60',
    );

    await gotoLessonStep(page, 'hpa', 1, 'HPA writes a new desired count');
    const hpaLabel = page.locator(`.scene-label[data-entity-id="${HPA_ID}"]:not([hidden])`);
    await expect(hpaLabel).toContainText('78/60%');
    await expect(hpaLabel).toContainText('replicas 2→3');
    await expect(page.getByTestId('teaching-what-changed')).toContainText(
      'desiredReplicas changed from 2 to 3',
    );
    await expect(page.getByTestId('teaching-takeaway')).toContainText(
      'HPA changes desired replicas',
    );
    expect(Math.ceil((2 * 78) / 60)).toBe(3);

    await gotoLessonStep(page, 'hpa', 2, 'Workload controllers create a Pending Pod');
    await expect(page.locator(`.scene-label[data-entity-id="${NEW_HPA_POD_ID}"]`)).toHaveCount(1);
    await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 2/);
    await expect(page.locator('#scene-accessible-summary')).toContainText('api-c');
    await expect(page.locator('#scene-accessible-summary')).toContainText('Pending');
    await expect(page.getByTestId('teaching-takeaway')).toContainText(
      'Pod creation is controller reconciliation',
    );

    await gotoLessonStep(page, 'hpa', 5, 'The new Pod becomes Ready');
    await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);
    await expect(page.locator('#scene-accessible-summary')).toContainText(
      'Pod api-c: phase Running; ContainersReady true; Ready true.',
    );
    await expect(page.getByTestId('teaching-takeaway')).toContainText(
      'readiness and endpoint membership are distinct facts',
    );

    await gotoLessonStep(page, 'hpa', 7, 'Capacity expands, one request chooses one backend');
    const finalRoute = await visibleRouteSummary(page);
    expect(finalRoute).toContain('source load-client at network-out, target api at network-in');
    expect(finalRoute).toContain('source api at network-out, target api-c at network-in');
    expect(finalRoute).not.toContain('api-slice');
  });

  test('reduced motion keeps the complete application route statically readable', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoLessonStep(page, 'full-external-request', 5, 'Return the application response');

    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(
      true,
    );
    await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
      'Resolved listener address',
      'Programmed backend Service',
      'Selected Ready web-a',
    ]);
    const route = await visibleRouteSummary(page);
    expect(route).toContain('shopper-browser');
    expect(route).toContain('edge-gateway');
    expect(route).toContain('target web at network-in');
    expect(route).toContain('target web-a at network-in');
    expect(route).not.toMatch(/public-gateway|shop-route|web-slice|public-dns/);

    expect(
      await page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()),
    ).toMatchObject({
      routeHandles: 1,
      activeAnimations: 0,
      flowTokens: 0,
      routeObstacleIntersections: 0,
      activeRouteWidthsBelowMinimum: 0,
      visibleRoutesWithoutArrowheads: 0,
    });
  });
});
