import { expect, test } from '@playwright/test';
import { gotoGoldenStep } from './helpers';

test('all ten steps expose the correct causal and factual timeline', async ({ page }) => {
  await gotoGoldenStep(page, 0);
  await expect(page.locator('.scene-layout-label')).toContainText([
    'CONTROL PLANE ISLAND',
    'UNSCHEDULED / TRANSIT',
    'WORKER NODES ISLAND',
  ]);

  await gotoGoldenStep(page, 1);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0');
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 2);
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Container state changed from running to terminated',
  );
  await expect(page.getByTestId('teaching-what-changed')).toContainText('Pod became NotReady');
  await expect(page.getByTestId('teaching-why-it-happened')).toContainText(
    'no action deleted or replaced the Pod API object',
  );

  await gotoGoldenStep(page, 3);
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0→1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container ID');
  await expect(page.getByTestId('evidence-panel')).toContainText(
    'Last termination reasonAbsent→Error',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 4);
  await expect(page.getByTestId('evidence-panel')).toContainText('removed');
  await expect(page.getByTestId('evidence-panel')).toContainText(
    'ReplicaSet SPEC / OBSERVED / READY',
  );
  await expect(page.getByTestId('evidence-panel')).toContainText(/3\/3\/3.*3\/2\/2/);
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 2.*READY 2/);

  await gotoGoldenStep(page, 5);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container statewaiting');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pending, unscheduled, NotReady Pod',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 2/);

  await gotoGoldenStep(page, 6);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending');

  await gotoGoldenStep(page, 7);
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled→worker-c');
  await expect(page.getByTestId('evidence-panel')).toContainText('Container statewaiting');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pending Pod gained nodeName worker-c',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 2/);

  await gotoGoldenStep(page, 8);
  await expect(page.getByTestId('evidence-panel')).toContainText('waiting→running');
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'Pod became Running and ready',
  );
  await expect(page.getByTestId('replica-counts')).toHaveText(/SPEC 3.*OBSERVED 3.*READY 3/);

  await gotoGoldenStep(page, 9);
  const comparison = page.getByTestId('comparison-panel');
  await expect(comparison).toContainText('Container restart');
  await expect(comparison).toContainText('Pod replacement');
  await expect(comparison).toContainText('synthetic-uid-old-a1');
  await expect(comparison).toContainText('synthetic-uid-new-d1');
  await expect(comparison.locator('dt')).toHaveCount(12);
  await expect(comparison.locator('.replacement-runtime')).toHaveCount(1);
});
