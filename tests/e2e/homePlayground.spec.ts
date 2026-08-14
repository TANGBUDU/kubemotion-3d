import { expect, test } from '@playwright/test';

async function openCleanHome(page: Parameters<typeof test>[0]['page']) {
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
  await expect(showcase.getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Manifest to running Pod', { exact: true })).toBeVisible();

  await showcase.getByRole('button', { name: 'Request' }).click();
  await expect(showcase.getByRole('button', { name: 'Request' })).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Internal Service request', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/internal-service-request/0',
  );

  await showcase.getByRole('button', { name: 'Kill container' }).click();
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/2',
  );

  await showcase.getByRole('button', { name: 'Delete Pod' }).click();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/4',
  );

  await showcase.getByRole('button', { name: 'Scale +' }).click();
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
  await showcase.getByRole('button', { name: 'Kill container' }).click();
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();
  await showcase.getByRole('button', { name: 'Advance sequence' }).click();
  await expect(showcase.getByRole('button', { name: 'Replay sequence' })).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('homepage-playground-reduced.png'), fullPage: false });
});
