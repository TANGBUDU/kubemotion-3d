import { expect, test } from '@playwright/test';
import { STEP_TITLES, gotoGoldenStep, revealEvidence } from './helpers';

const desktopProjects = new Set(['desktop-chromium', 'desktop-1280-chromium']);
const mobileSteps = new Set([0, 3, 6, 8, 9]);

for (let stepIndex = 0; stepIndex < STEP_TITLES.length; stepIndex += 1) {
  test(`golden visual step ${stepIndex}: ${STEP_TITLES[stepIndex]}`, async ({ page }, testInfo) => {
    const desktop = desktopProjects.has(testInfo.project.name);
    const mobile = testInfo.project.name === 'mobile-chromium' && mobileSteps.has(stepIndex);
    test.skip(!desktop && !mobile, 'Not a required visual-acceptance capture');

    await gotoGoldenStep(page, stepIndex);
    if (mobile && [2, 3, 6, 8].includes(stepIndex)) await revealEvidence(page);
    if (stepIndex === 9) {
      await expect(page.locator('[data-testid="comparison-panel"] dt:visible')).toHaveCount(12);
    }
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('Visual acceptance requires an explicit viewport');
    await expect(page).toHaveScreenshot(
      `golden-step-${String(stepIndex).padStart(2, '0')}-${viewport.width}x${viewport.height}.png`,
      {
        animations: 'disabled',
        caret: 'hide',
        fullPage: true,
        scale: 'css',
      },
    );
  });
}

test('persistent active route remains legible with reduced motion', async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'desktop-1280-chromium',
    'One explicit reduced-motion route capture is sufficient',
  );
  await gotoGoldenStep(page, 8);
  await expect(page.locator('.scene-route-label:not([hidden])')).not.toHaveCount(0);
  await expect(page).toHaveScreenshot('golden-reduced-motion-route-1280x720.png', {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
    scale: 'css',
  });
});
