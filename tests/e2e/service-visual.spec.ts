import { expect, test } from '@playwright/test';
import { SERVICE_STEP_TITLES, gotoServiceStep, revealEvidence } from './helpers';

const desktopProjects = new Set(['desktop-chromium', 'desktop-1280-chromium']);
const desktopSteps = new Set([0, 3, 4, 5]);

for (let stepIndex = 0; stepIndex < SERVICE_STEP_TITLES.length; stepIndex += 1) {
  test(`Service visual step ${stepIndex}: ${SERVICE_STEP_TITLES[stepIndex]}`, async ({
    page,
  }, testInfo) => {
    const desktop = desktopProjects.has(testInfo.project.name) && desktopSteps.has(stepIndex);
    const mobile = testInfo.project.name === 'mobile-chromium' && [3, 5].includes(stepIndex);
    test.skip(!desktop && !mobile, 'Not a required Service visual-acceptance capture');

    await gotoServiceStep(page, stepIndex);
    if (mobile) await revealEvidence(page);

    if (stepIndex === 3) {
      const routeLabels = page.locator('.scene-route-label:not([hidden])');
      await expect(routeLabels.filter({ hasText: 'Request A enters Service' })).toHaveCount(1);
      if (testInfo.project.name !== 'mobile-chromium') {
        await expect(routeLabels).toContainText(['Request A enters Service', 'select Ready api-a']);
      }
      await expect(page.locator('#scene-accessible-summary')).toContainText(
        'source traffic-client at data-path, target api at data-path',
      );
      await expect(page.locator('#scene-accessible-summary')).toContainText(
        'source api at data-path, target api-a at data-path',
      );
    }

    if (stepIndex === 4) {
      const evidence = page.getByTestId('evidence-panel');
      await expect(evidence).toContainText('2/3 Ready');
      await expect(evidence).toContainText('api-a Endpoint conditions');
      await expect(evidence).toContainText('ready=false · serving=false · terminating=false');
      await expect(page.locator('.scene-callout:not([hidden])')).toContainText(
        'ready=false · serving=false · terminating=false',
      );
      await expect(page.locator('.scene-route-label:not([hidden])')).toHaveCount(0);
      await expect(page.locator('#scene-accessible-summary')).not.toContainText(
        'target api-c at data-path',
      );
    }

    if (stepIndex === 5) {
      const routeLabels = page.locator('.scene-route-label:not([hidden])');
      await expect(routeLabels.filter({ hasText: 'New request enters same Service' })).toHaveCount(
        1,
      );
      if (testInfo.project.name !== 'mobile-chromium') {
        await expect(routeLabels).toContainText([
          'New request enters same Service',
          'select Ready api-c',
        ]);
      }
      await expect(page.locator('#scene-accessible-summary')).toContainText(
        'target api-c at data-path',
      );
    }

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('Visual acceptance requires an explicit viewport');
    await expect(page).toHaveScreenshot(
      `service-step-${String(stepIndex).padStart(2, '0')}-${viewport.width}x${viewport.height}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        scale: 'css',
      },
    );
  });
}

test('Service identity stays stable while a later request selects another Ready endpoint', async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280-chromium',
    'One desktop project is sufficient for semantic acceptance',
  );

  await gotoServiceStep(page, 1);
  await expect(page.getByTestId('evidence-panel')).toContainText('198.51.100.42');
  await expect(page.getByTestId('evidence-panel')).toContainText('TCP 8080');
  await expect(page.getByTestId('teaching-takeaway')).toContainText(
    'The Service address is stable',
  );

  await gotoServiceStep(page, 2);
  await expect(page.getByTestId('evidence-panel')).toContainText('3/3 Ready');
  await expect(page.locator('.scene-callout:not([hidden])')).toContainText('3 endpoints · 3 Ready');

  await gotoServiceStep(page, 3);
  await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
    'Request A enters Service',
    'select Ready api-a',
  ]);

  await gotoServiceStep(page, 4);
  const readinessEvidence = page.getByTestId('evidence-panel');
  await expect(readinessEvidence).toContainText('2/3 Ready');
  await expect(readinessEvidence).toContainText('api-a Endpoint conditions');
  await expect(readinessEvidence).toContainText('ready=false · serving=false · terminating=false');
  await expect(page.locator('.scene-callout:not([hidden])')).toContainText(
    'ready=false · serving=false · terminating=false',
  );
  await expect(page.locator('.scene-route-label:not([hidden])')).toHaveCount(0);
  await expect(page.locator('#scene-accessible-summary')).not.toContainText(
    'target api-c at data-path',
  );

  await gotoServiceStep(page, 5);
  await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
    'New request enters same Service',
    'select Ready api-c',
  ]);
  await expect(page.locator('#scene-accessible-summary')).toContainText(
    'source api at data-path, target api-c at data-path',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText('198.51.100.42');
  await expect(page.getByTestId('evidence-panel')).toContainText('2/3 Ready');
  await expect(page.getByTestId('teaching-takeaway')).toContainText(
    'Readiness changes which backends are eligible for new traffic',
  );
});
