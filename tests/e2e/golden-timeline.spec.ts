import { expect, test } from '@playwright/test';
import { gotoGoldenStep } from './helpers';

test('all seven steps expose the correct factual identity timeline', async ({ page }) => {
  await gotoGoldenStep(page, 0);
  await expect(page.getByTestId('world-inspector')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('world-inspector')).toContainText('worker-a');
  await expect(page.getByTestId('world-inspector')).toContainText('Restarts0');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 1);
  await expect(page.getByTestId('world-inspector')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('world-inspector')).toContainText('terminated');

  await gotoGoldenStep(page, 2);
  await expect(page.getByTestId('world-inspector')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('world-inspector')).toContainText('Restarts1');
  await expect(page.getByTestId('world-inspector')).toContainText('Generation2');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 3);
  await expect(page.getByTestId('world-inspector')).toHaveCount(0);
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 2.*Ready 2/);

  await gotoGoldenStep(page, 4);
  await expect(page.getByTestId('world-inspector')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('world-inspector')).toContainText('Unscheduled');
  await expect(page.getByTestId('world-inspector')).toContainText('Pending');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 2/);

  await gotoGoldenStep(page, 5);
  await expect(page.getByTestId('world-inspector')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('world-inspector')).toContainText('worker-c');
  await expect(page.getByTestId('world-inspector')).toContainText('Running');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 6);
  await expect(page.getByTestId('comparison-panel')).toContainText(
    'api-object:namespaced:shop:Pod:api-a-old removed; new api-object:namespaced:shop:Pod:api-d-new',
  );
  await expect(page.getByTestId('comparison-panel')).toContainText(
    'unchanged synthetic-uid-old-a1',
  );
  await expect(page.getByTestId('comparison-panel')).toContainText('new synthetic-uid-new-d1');
});
