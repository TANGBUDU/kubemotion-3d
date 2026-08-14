from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text('utf-8')
    if old not in text:
        raise SystemExit(f'Missing expected fragment: {label} in {path}')
    path.write_text(text.replace(old, new, 1), 'utf-8')


# Keep the mobile icon-only Explain CTA accessible.
replace_once(
    Path('src/components/HomeShowcase.tsx'),
    '''            <Link
              className="showcase-learn-link"
              to={`/stories/${preset.storyId}/${compiledBeatIndex}`}
''',
    '''            <Link
              className="showcase-learn-link"
              aria-label={copy.explain}
              title={copy.explain}
              to={`/stories/${preset.storyId}/${compiledBeatIndex}`}
''',
    'mobile Explain CTA',
)

replace_once(
    Path('src/components/HomeShowcase.tsx'),
    '''      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      data-preset={presetId}
''',
    '''      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      data-preset={presetId}
      data-beat-index={beatIndex}
''',
    'showcase beat state',
)

# A visible kubelet needs its Node to be part of the authored teaching view.
lesson = Path('content/courses/kubernetes-foundations/lessons/container-restart-vs-pod-replacement.yaml')
text = lesson.read_text('utf-8')
start = text.index('  - id: container-restarted\n')
end = text.index('  - id: kubectl-delete-pod\n', start)
block = text[start:end]
old = '''        - selector: { byIds: [runtime-component:node:worker-a:Kubelet:kubelet] }
          visible: true
          emphasis: normal
          labelMode: full
'''
new = '''        - selector: { byIds: [infrastructure:cluster:global:Node:worker-a] }
          visible: true
          emphasis: normal
          labelMode: full
        - selector: { byIds: [runtime-component:node:worker-a:Kubelet:kubelet] }
          visible: true
          emphasis: normal
          labelMode: full
'''
if old not in block:
    raise SystemExit('Missing container-restarted kubelet rule')
block = block.replace(old, new, 1)
lesson.write_text(text[:start] + block + text[end:], 'utf-8')

# Density pruning must keep the physical Node that owns any priority node-local runtime actor.
# Without this closure a focused/route-participating kubelet can survive the budget while its Node
# is removed, which later violates StrictControlFlowLayout's parent contract.
policy = Path('src/renderer/scene-grammar/SceneVisibilityPolicy.ts')
replace_once(
    policy,
    '''  while (changed) {
    changed = false;
    for (const relation of Object.values(world.relations)) {
''',
    '''  while (changed) {
    changed = false;
    for (const entityId of [...priority]) {
      const entity = world.entities[entityId];
      if (!entity || (entity.kind !== 'Kubelet' && entity.kind !== 'ContainerRuntime')) continue;
      const nodeName = typeof entity.data.nodeName === 'string' ? entity.data.nodeName : undefined;
      if (!nodeName) continue;
      const node = Object.values(world.entities).find(
        (candidate) => candidate.kind === 'Node' && candidate.name === nodeName,
      );
      if (node && !priority.has(node.id)) {
        priority.add(node.id);
        changed = true;
      }
    }
    for (const relation of Object.values(world.relations)) {
''',
    'runtime-to-Node priority closure',
)

# Put the live product demo at the top of the desktop hero and let it stay in view while the taller
# onboarding copy scrolls. Tablet/mobile deliberately revert to normal document flow.
replace_once(
    Path('src/styles/award/02-hero.css'),
    '''  gap: clamp(34px, 4.5vw, 82px);
  align-items: center;
  max-width: 1720px;
''',
    '''  gap: clamp(34px, 4.5vw, 82px);
  align-items: start;
  max-width: 1720px;
''',
    'desktop hero alignment',
)

replace_once(
    Path('src/styles/award/03-showcase.css'),
    '''.home-showcase {
  position: relative;
  z-index: 2;
  min-width: 0;
  perspective: 1600px;
}
''',
    '''.home-showcase {
  position: sticky;
  z-index: 2;
  top: calc(var(--header-height) + 22px);
  align-self: start;
  min-width: 0;
  perspective: 1600px;
}
''',
    'desktop sticky showcase',
)

replace_once(
    Path('src/styles/award/05-responsive.css'),
    '''  .home-showcase {
    order: -1;
  }
''',
    '''  .home-showcase {
    position: relative;
    top: auto;
    order: -1;
    align-self: stretch;
    width: 100%;
  }
''',
    'tablet/mobile showcase reset',
)

# Regression test the exact contract that previously failed in the real browser on the second
# container-restart beat, for both desktop and mobile density budgets.
responsive_test = Path('tests/course/responsiveSceneProjection.test.ts')
replace_once(
    responsive_test,
    '''    const direct = courseEngine.compileDirect(lesson, lessonScenario, 0, {
      viewport: 'mobile',
    });
''',
    '''    const nodeId = 'infrastructure:cluster:global:Node:worker-a';
    const kubeletId = 'runtime-component:node:worker-a:Kubelet:kubelet';
    for (const compiledLesson of [implicitDesktop, mobile]) {
      const restarted = compiledLesson.steps.find((step) => step.stepId === 'container-restarted');
      if (!restarted) throw new Error('Container restart step is missing');
      expect(restarted.view.entityStates[nodeId]).toMatchObject({ visible: true });
      expect(restarted.view.entityStates[kubeletId]).toMatchObject({ visible: true });
      expect(() => calculateLayout({ world: restarted.world, view: restarted.view })).not.toThrow();
    }

    const direct = courseEngine.compileDirect(lesson, lessonScenario, 0, {
      viewport: 'mobile',
    });
''',
    'runtime-parent responsive regression',
)

# Browser QA is intentionally independent of animation timing. User-selected scenarios autoplay,
# so selecting beat 01 first takes manual control before exercising beat 02.
e2e = Path('tests/e2e/homePlayground.spec.ts')
e2e.write_text(
    '''import { expect, test, type Page } from '@playwright/test';

async function openCleanHome(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });
  await page.goto('/');
  await expect(page.locator('.home-showcase')).toBeVisible();
  await expect(page.locator('.home-showcase canvas')).toBeVisible();
}

test('persistent homepage playground switches verified Kubernetes stories', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
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
  await showcase.locator('.showcase-timeline button').first().click();
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase).toHaveAttribute('data-beat-index', '0');
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(showcase.getByRole('link', { name: 'Explain this' })).toHaveAttribute(
    'href',
    '#/stories/container-restart-vs-pod-replacement/2',
  );
  await showcase.locator('.showcase-timeline button').nth(1).click();
  await expect(showcase).toHaveAttribute('data-beat-index', '1');
  await expect(
    showcase.getByText('kubelet restarts the Container in the same Pod', { exact: true }),
  ).toBeVisible();
  expect(pageErrors).toEqual([]);

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
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground.png'), fullPage: false });
});

test('homepage playground stays usable with reduced motion', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  await showcase.getByRole('button', { name: 'Kill container', exact: true }).click();
  await expect(showcase.getByRole('button', { name: 'Advance sequence' })).toBeVisible();
  await expect(showcase).toHaveAttribute('data-beat-index', '0');

  await showcase.getByRole('button', { name: 'Advance sequence' }).click();
  await expect(showcase).toHaveAttribute('data-beat-index', '1');
  await expect(
    showcase.getByText('kubelet restarts the Container in the same Pod', { exact: true }),
  ).toBeVisible();

  const hasPageOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(hasPageOverflow).toBe(false);
  expect(pageErrors).toEqual([]);

  await page.screenshot({ path: testInfo.outputPath('homepage-playground-reduced.png'), fullPage: false });
});
''',
    'utf-8',
)
