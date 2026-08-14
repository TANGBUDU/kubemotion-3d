import { expect, test, type Page } from '@playwright/test';

async function openCleanHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  await expect(page.locator('.home-showcase')).toBeVisible();
  await expect(page.locator('.home-showcase canvas')).toBeVisible();
}

test('persistent homepage playground switches verified Kubernetes stories', async ({ page }, testInfo) => {
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  const scenario = (name: string) => showcase.getByRole('button', { name, exact: true });

  await expect(scenario('Overview')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Manifest to running Pod', { exact: true })).toBeVisible();

  await scenario('Request').click();
  await expect(scenario('Request')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Internal Service request', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/internal-service-request/0',
  );

  await scenario('Kill container').click();
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/2',
  );

  await scenario('Delete Pod').click();
  await expect(scenario('Delete Pod')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/4',
  );

  await scenario('Scale +').click();
  await expect(scenario('Scale +')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('HPA scale-out', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/hpa-scale-out/0',
  );

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasPageOverflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground.png'), fullPage: false });
});

test('homepage playground stays usable with reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  await showcase.getByRole('button', { name: 'Kill container', exact: true }).click();
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();
  await expect(showcase.locator('.showcase-timeline button[aria-current="step"] span')).toHaveText('01');

  await showcase.getByRole('button', { name: 'Advance sequence' }).click();
  await expect(showcase.locator('.showcase-timeline button[aria-current="step"] span')).toHaveText('02');

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasPageOverflow).toBe(false);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground-reduced.png'), fullPage: false });
});
