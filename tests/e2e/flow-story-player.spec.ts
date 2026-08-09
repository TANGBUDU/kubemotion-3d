import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const reviewDir = 'docs/review/evidence/story-player';

test('flow stories have a dedicated catalog and beat-only player', async ({ page }) => {
  await mkdir(reviewDir, { recursive: true });
  await page.goto('/#/stories');

  const cards = page.locator('.flow-story-card');
  await expect(cards).toHaveCount(8);
  await page.screenshot({ path: `${reviewDir}/story-catalog-desktop.png`, fullPage: true });

  await cards
    .first()
    .getByRole('link', { name: /Open story|Story を開く|打开故事/i })
    .click();

  await expect(page).toHaveURL(/#\/stories\/manifest-to-running-pod\/0$/);
  await expect(page.getByTestId('flow-story-player')).toBeVisible();
  await expect(page.getByTestId('story-beat-heading')).toBeVisible();
  await page.screenshot({ path: `${reviewDir}/story-player-desktop.png`, fullPage: true });

  const timeline = page.locator('.flow-story-beat-timeline button');
  await expect(timeline).toHaveCount(8);
  await expect(timeline.first()).toHaveAttribute('aria-current', 'step');

  await page.getByRole('button', { name: /Next|次へ|下一步/i }).click();
  await expect(page).toHaveURL(/#\/stories\/manifest-to-running-pod\/1$/);
  await expect(timeline.nth(1)).toHaveAttribute('aria-current', 'step');

  const fullLesson = page.getByRole('link', {
    name: /Open full lesson|完全なレッスンを開く|打开完整课程/i,
  });
  await expect(fullLesson).toHaveAttribute('href', /#\/learn\/manifest-to-running-pod\//);

  await page.getByRole('button', { name: /Replay beat|Beat を再生|重播本阶段/i }).click();
  await expect(page.getByTestId('flow-story-player')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/stories/manifest-to-running-pod/0');
  await expect(page.getByTestId('flow-story-player')).toBeVisible();
  await page.screenshot({ path: `${reviewDir}/story-player-mobile.png`, fullPage: true });
});
