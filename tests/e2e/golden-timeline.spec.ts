import { expect, test } from '@playwright/test';
import { gotoGoldenStep } from './helpers';

test('all ten steps expose the correct causal and factual timeline', async ({ page }) => {
  await gotoGoldenStep(page, 0);
  await expect(page.locator('.scene-layout-label')).toContainText([
    'CONTROL PLANE',
    'WORKLOAD STATE / UNSCHEDULED QUEUE',
    'WORKER NODES',
  ]);

  await gotoGoldenStep(page, 1);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 2);
  await expect(page.getByTestId('teaching-what-changed')).toContainText(
    'running to terminated inside the unchanged Pod shell',
  );
  await expect(page.getByTestId('teaching-why-it-happened')).toContainText(
    'no action deleted or replaced the Pod API object',
  );

  await gotoGoldenStep(page, 3);
  await expect(page.getByTestId('evidence-panel')).toContainText('Restart count0→1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Generation1→2');
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('evidence-panel')).toContainText('worker-a');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 4);
  await expect(page.getByTestId('evidence-panel')).toContainText('removed');
  await expect(page.getByTestId('evidence-panel')).toContainText('D3 · C3 · R3→D3 · C2 · R2');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 2.*Ready 2/);

  await gotoGoldenStep(page, 5);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending');
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 2/);

  await gotoGoldenStep(page, 6);
  await expect(page.getByTestId('evidence-panel')).toContainText('synthetic-uid-new-d1');
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending');

  await gotoGoldenStep(page, 7);
  await expect(page.getByTestId('evidence-panel')).toContainText('Unscheduled→worker-c');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 2/);

  await gotoGoldenStep(page, 8);
  await expect(page.getByTestId('evidence-panel')).toContainText('waiting→running');
  await expect(page.getByTestId('evidence-panel')).toContainText('Pending→Running');
  await expect(page.getByTestId('replica-counts')).toHaveText(/Desired 3.*Current 3.*Ready 3/);

  await gotoGoldenStep(page, 9);
  await expect(page.getByTestId('comparison-panel')).toContainText('Container restart');
  await expect(page.getByTestId('comparison-panel')).toContainText('Pod replacement');
  await expect(page.getByTestId('comparison-panel')).toContainText('synthetic-uid-old-a1');
  await expect(page.getByTestId('comparison-panel')).toContainText('synthetic-uid-new-d1');
});
