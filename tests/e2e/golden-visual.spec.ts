import { expect, test } from '@playwright/test';
import { STEP_TITLES, gotoGoldenStep } from './helpers';

for (let stepIndex = 0; stepIndex < STEP_TITLES.length; stepIndex += 1) {
  test(`visual baseline step ${stepIndex + 1}: ${STEP_TITLES[stepIndex]}`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium', 'Seven-step desktop visual gate');
    await gotoGoldenStep(page, stepIndex);
    await expect(page).toHaveScreenshot(
      `golden-step-${String(stepIndex + 1).padStart(2, '0')}.png`,
      { animations: 'disabled', caret: 'hide', fullPage: true },
    );
  });
}
