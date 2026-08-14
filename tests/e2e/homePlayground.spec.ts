import { expect, test, type Page } from '@playwright/test';

async function openCleanHome(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  const showcase = page.locator('.home-showcase');
  await expect(showcase).toBeVisible();
  await expect(showcase.locator('.scene-viewport')).toHaveAttribute('data-renderer-state', 'ready');
  await expect(showcase.locator('canvas')).toBeVisible();
  await expect
    .poll(() => showcase.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(280);
  await page.waitForTimeout(250);
}

test('persistent homepage playground switches verified Kubernetes stories', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  const scenario = (name: string) => showcase.getByRole('button', { name, exact: true });
  const explain = showcase.getByRole('link', { name: 'Explain this' });

  await expect(scenario('Overview')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Manifest to running Pod', { exact: true })).toBeVisible();

  await showcase.locator('.showcase-timeline button').first().click({ force: true });
  await expect(showcase).toHaveAttribute('data-beat-index', '0');
  await expect
    .poll(async () =>
      page.evaluate(
        () => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()?.activeAnimations ?? -1,
      ),
    )
    .toBe(0);
  await expect
    .poll(async () =>
      page.evaluate(() => window.__KUBEMOTION_TEST__?.getSceneDiagnostics()?.flowTokens ?? 0),
    )
    .toBeGreaterThan(0);

  const viewportBox = await showcase.locator('.home-showcase__viewport').boundingBox();
  const readoutBox = await showcase.locator('.showcase-readout').boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(readoutBox).not.toBeNull();
  if (viewportBox && readoutBox) {
    expect(readoutBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height - 1);
  }

  const frame = showcase.locator('.home-showcase__frame');
  const frameBox = await frame.boundingBox();
  if (frameBox && testInfo.project.name.includes('desktop')) {
    await page.mouse.move(frameBox.x + frameBox.width * 0.72, frameBox.y + frameBox.height * 0.34);
    await expect
      .poll(() =>
        frame.evaluate((element) => element.style.getPropertyValue('--showcase-pointer-active')),
      )
      .toBe('1');
  }

  await scenario('Request').click({ force: true });
  await expect(scenario('Request')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Internal Service request', { exact: true })).toBeVisible();
  await expect(explain).toHaveAttribute('href', /^#\/stories\/internal-service-request\/\d+$/);

  await scenario('Kill container').click({ force: true });
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(
    showcase.getByText('Container restart versus Pod replacement', { exact: true }),
  ).toBeVisible();
  await expect(explain).toHaveAttribute(
    'href',
    /^#\/stories\/container-restart-vs-pod-replacement\/\d+$/,
  );

  await scenario('Delete Pod').click({ force: true });
  await expect(scenario('Delete Pod')).toHaveAttribute('aria-pressed', 'true');
  await expect(explain).toHaveAttribute(
    'href',
    /^#\/stories\/container-restart-vs-pod-replacement\/\d+$/,
  );

  await scenario('Scale +').click({ force: true });
  await expect(scenario('Scale +')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('HPA scale-out', { exact: true })).toBeVisible();
  await expect(explain).toHaveAttribute('href', /^#\/stories\/hpa-scale-out\/\d+$/);

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasPageOverflow).toBe(false);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground.png'), fullPage: false });
});

test('homepage playground stays usable with reduced motion', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  await showcase
    .getByRole('button', { name: 'Kill container', exact: true })
    .click({ force: true });
  await expect(showcase).toHaveAttribute('data-beat-index', '0');
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();

  await showcase.getByRole('button', { name: 'Advance sequence' }).click({ force: true });
  await expect(showcase).toHaveAttribute('data-beat-index', '1');
  await expect(
    showcase.getByText('kubelet restarts the Container in the same Pod', { exact: true }),
  ).toBeVisible();
  await expect(showcase.locator('.scene-viewport')).toHaveAttribute('data-renderer-state', 'ready');

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasPageOverflow).toBe(false);
  expect(pageErrors).toEqual([]);

  await page.screenshot({
    path: testInfo.outputPath('homepage-playground-reduced.png'),
    fullPage: false,
  });
});
