import { expect, test } from '@playwright/test';
import { SERVICE_STEP_TITLES, gotoServiceStep } from './helpers';

const desktopProjects = new Set(['desktop-chromium', 'desktop-1280-chromium']);
const desktopSteps = new Set([0, 3, 4, 5]);

for (let stepIndex = 0; stepIndex < SERVICE_STEP_TITLES.length; stepIndex += 1) {
  test(`Service visual step ${stepIndex}: ${SERVICE_STEP_TITLES[stepIndex]}`, async ({
    page,
  }, testInfo) => {
    const desktop = desktopProjects.has(testInfo.project.name) && desktopSteps.has(stepIndex);
    const mobile = testInfo.project.name === 'mobile-chromium' && stepIndex === 3;
    test.skip(!desktop && !mobile, 'Not a required Service visual-acceptance capture');

    await gotoServiceStep(page, stepIndex);

    if (stepIndex === 3) {
      await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
        'enter Service',
        ...(desktop ? ['route to Ready api-a'] : []),
      ]);
      await expect(page.locator('#scene-accessible-summary')).toContainText(
        'source traffic-client at data-path, target api at data-path',
      );
      await expect(page.locator('#scene-accessible-summary')).toContainText(
        'source api at data-path, target api-a at data-path',
      );
    }

    if (stepIndex === 4) {
      await expect(page.getByTestId('evidence-panel')).toContainText('2/3 Ready');
      await expect(page.locator('.scene-callout:not([hidden])')).toContainText('ready=false');
      await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
        'enter same Service',
        'reroute to Ready api-c',
      ]);
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

test('Service identity stays stable while EndpointSlice readiness reroutes traffic', async ({
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
    'enter Service',
    'route to Ready api-a',
  ]);

  await gotoServiceStep(page, 4);
  await expect(page.getByTestId('evidence-panel')).toContainText('2/3 Ready');
  await expect(page.locator('.scene-callout:not([hidden])')).toContainText('ready=false');
  await expect(page.locator('.scene-route-label:not([hidden])')).toContainText([
    'enter same Service',
    'reroute to Ready api-c',
  ]);
  await expect(page.locator('#scene-accessible-summary')).toContainText(
    'source api at data-path, target api-c at data-path',
  );

  await gotoServiceStep(page, 5);
  await expect(page.getByTestId('evidence-panel')).toContainText('198.51.100.42');
  await expect(page.getByTestId('evidence-panel')).toContainText('2/3 Ready');
  await expect(page.getByTestId('teaching-takeaway')).toContainText(
    'Client → stable Service → selected Ready Pod',
  );
});
