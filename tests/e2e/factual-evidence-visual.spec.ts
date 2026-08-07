import { expect, test } from '@playwright/test';
import { gotoGoldenStep, gotoServiceStep, revealEvidence } from './helpers';

const tightScreenshot = {
  animations: 'disabled' as const,
  caret: 'hide' as const,
  scale: 'css' as const,
  threshold: 0.15,
  maxDiffPixelRatio: 0.01,
};

test.describe('focused factual evidence', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name !== 'desktop-1280-chromium',
      'One deterministic desktop viewport owns the tight factual crops',
    );
  });

  test('Container exit evidence locks Pod and ReplicaSet readiness', async ({ page }) => {
    await gotoGoldenStep(page, 2);
    const evidence = page.getByTestId('evidence-panel');
    await expect(evidence).toContainText('Container state');
    await expect(evidence).toContainText('Pod Ready');
    await expect(evidence).toContainText('ReplicaSet SPEC / OBSERVED / READY');
    await expect(evidence).toHaveScreenshot(
      'evidence-golden-step-02-1280x720.png',
      tightScreenshot,
    );
  });

  test('local restart evidence locks runtime identity replacement', async ({ page }) => {
    await gotoGoldenStep(page, 3);
    const evidence = page.getByTestId('evidence-panel');
    await expect(evidence).toContainText('Container ID');
    await expect(evidence).toContainText('Restart count');
    await expect(evidence).toContainText('Pod Ready');
    await expect(evidence).toHaveScreenshot(
      'evidence-golden-step-03-1280x720.png',
      tightScreenshot,
    );
  });

  test('EndpointSlice evidence locks non-serving readiness', async ({ page }) => {
    await gotoServiceStep(page, 4);
    const evidence = page.getByTestId('evidence-panel');
    await expect(evidence).toContainText('Endpoint readiness');
    await expect(evidence).toContainText('api-a Endpoint conditions');
    await expect(evidence).toContainText('ready=false');
    await expect(evidence).toContainText('serving=false');
    await expect(evidence).toContainText('terminating=false');
    await expect(evidence).toContainText('ContainersReady');
    await expect(evidence).toContainText('Pod Ready');
    await expect(evidence).not.toContainText('Pod status');
    await expect(page.locator('.scene-callout:not([hidden])')).toContainText('ready=false');
    await expect(page.locator('.scene-callout:not([hidden])')).toContainText('serving=false');
    await expect(page.locator('#scene-accessible-summary')).toContainText(
      'api-a endpoint ready=false, serving=false, terminating=false',
    );
    await expect(page.locator('#scene-accessible-summary')).toContainText(
      'Pod api-a: phase Running; ContainersReady false; Ready false.',
    );
    await expect(page.locator('#scene-accessible-summary')).not.toContainText('Pod status');
    await expect(evidence).toHaveScreenshot(
      'evidence-service-step-04-1280x720.png',
      tightScreenshot,
    );
  });

  test('later-request evidence is distinct from the completed request', async ({ page }) => {
    await gotoServiceStep(page, 5);
    const evidence = page.getByTestId('evidence-panel');
    await expect(page.getByTestId('teaching-step-heading')).toContainText('later request');
    await expect(
      page.locator('.scene-route-label:not([hidden])').filter({ hasText: 'New request' }),
    ).toHaveCount(1);
    await expect(evidence).toHaveScreenshot(
      'evidence-service-step-05-1280x720.png',
      tightScreenshot,
    );
  });

  test('comparison panel locks corrected identities and counters', async ({ page }) => {
    await gotoGoldenStep(page, 9);
    const comparison = page.getByTestId('comparison-panel');
    await expect(comparison).toContainText('Container ID');
    await expect(comparison).toContainText('Container restart count');
    await expect(comparison.locator('.restart-card dt')).toHaveText([
      'Pod name',
      'Pod UID',
      'Node',
      'Container ID',
      'Container restart count',
      'Pod object',
    ]);
    await expect(comparison.locator('.replacement-card dt')).toHaveText([
      'Pod name',
      'Pod UID',
      'Node',
      'Container ID',
      'Container restart count',
      'Pod object',
    ]);
    await expect(comparison.locator('.replacement-runtime')).toHaveCount(1);
    await expect(comparison).toHaveScreenshot(
      'comparison-golden-step-09-1280x720.png',
      tightScreenshot,
    );
  });
});

test.describe('reduced-motion factual routes', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('local node runtime route stays visible', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1280-chromium',
      'One explicit reduced-motion capture is sufficient',
    );
    await gotoGoldenStep(page, 3);
    await expect(page.locator('.scene-route-label:not([hidden])')).toContainText('restart locally');
    await expect(page).toHaveScreenshot(
      'golden-step-03-local-restart-reduced-motion-1280x720.png',
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        scale: 'css',
      },
    );
  });

  test('later Service request route stays visible', async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'desktop-1280-chromium',
      'One explicit reduced-motion capture is sufficient',
    );
    await gotoServiceStep(page, 5);
    await expect(
      page.locator('.scene-route-label:not([hidden])').filter({ hasText: 'New request' }),
    ).toHaveCount(1);
    await expect(page).toHaveScreenshot('service-step-05-request-b-reduced-motion-1280x720.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
  });
});

test.describe('additional mobile factual captures', () => {
  test.beforeEach(({ page }, testInfo) => {
    void page;
    test.skip(
      testInfo.project.name !== 'mobile-chromium',
      'These captures extend the required mobile factual-state set',
    );
  });

  test('Container exit shows the NotReady Pod state', async ({ page }) => {
    await gotoGoldenStep(page, 2);
    await revealEvidence(page);
    const teaching = page.getByRole('complementary', { name: 'Teaching explanation' });
    await expect(teaching).toBeVisible();
    await expect(teaching).toContainText('Pod became NotReady');
    await expect(teaching).toContainText('READY fell to 2');
    await expect(page).toHaveScreenshot('golden-step-02-390x844.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
  });

  test('later Service request remains traceable', async ({ page }) => {
    await gotoServiceStep(page, 5);
    await revealEvidence(page);
    await expect(page.getByTestId('teaching-step-heading')).toContainText('later request');
    await expect(page).toHaveScreenshot('service-step-05-390x844.png', {
      animations: 'disabled',
      caret: 'hide',
      fullPage: true,
      scale: 'css',
    });
  });
});
