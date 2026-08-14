from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text('utf-8')
    if old not in text:
        raise SystemExit(f'Missing expected fragment: {label} in {path}')
    path.write_text(text.replace(old, new, 1), 'utf-8')


# The mobile Explain CTA becomes icon-only visually, so preserve its accessible name.
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

# The authored restart view explicitly keeps worker-a whenever its kubelet is shown.
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
lesson.write_text(text[:start] + block.replace(old, new, 1) + text[end:], 'utf-8')

# Guided-scene density pruning must preserve the physical Node of any priority runtime actor.
replace_once(
    Path('src/renderer/scene-grammar/SceneVisibilityPolicy.ts'),
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
    'guided runtime-to-Node priority closure',
)

# Flow Stories apply a second visual focus pass after the lesson compiles. Keep the same physical
# runtime hierarchy there too, otherwise a route can retain kubelet while hiding worker-a.
replace_once(
    Path('src/course/FlowStoryEngine.ts'),
    '''  while (expanded) {
    expanded = false;
    for (const relation of Object.values(compiledStep.world.relations)) {
''',
    '''  while (expanded) {
    expanded = false;
    for (const entityId of [...relevant]) {
      const entity = compiledStep.world.entities[entityId];
      if (!entity || (entity.kind !== 'Kubelet' && entity.kind !== 'ContainerRuntime')) continue;
      const nodeName = typeof entity.data.nodeName === 'string' ? entity.data.nodeName : undefined;
      if (!nodeName) continue;
      const node = Object.values(compiledStep.world.entities).find(
        (candidate) => candidate.kind === 'Node' && candidate.name === nodeName,
      );
      if (node && !relevant.has(node.id)) {
        relevant.add(node.id);
        expanded = true;
      }
    }
    for (const relation of Object.values(compiledStep.world.relations)) {
''',
    'Flow Story runtime-to-Node structural closure',
)

# Desktop: the live product demo appears immediately and remains visible beside taller onboarding
# copy. Tablet/mobile intentionally return to ordinary document flow and stretch to full width.
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

# Unit regression: verify both the compiled lesson and the Flow Story keep the runtime parent at
# desktop/mobile density and satisfy the real layout contract.
test = Path('tests/course/responsiveSceneProjection.test.ts')
text = test.read_text('utf-8')
old = "import { lessonById, scenario, scenarioById } from '../../src/content/loader';\n"
new = "import { flowStoryById, lessonById, scenario, scenarioById, sources } from '../../src/content/loader';\n"
if old not in text:
    raise SystemExit('Missing responsive test loader import')
text = text.replace(old, new, 1)
old = "import { courseEngine } from '../../src/course/CourseEngine';\n"
new = "import { courseEngine } from '../../src/course/CourseEngine';\nimport { flowStoryEngine } from '../../src/course/FlowStoryEngine';\n"
if old not in text:
    raise SystemExit('Missing responsive test CourseEngine import')
text = text.replace(old, new, 1)
old = '''    const direct = courseEngine.compileDirect(lesson, lessonScenario, 0, {
      viewport: 'mobile',
    });
    expect(direct).toEqual(mobile.steps[0]);
'''
new = '''    const nodeId = 'infrastructure:cluster:global:Node:worker-a';
    const kubeletId = 'runtime-component:node:worker-a:Kubelet:kubelet';
    for (const compiledLesson of [implicitDesktop, mobile]) {
      const restarted = compiledLesson.steps.find((step) => step.stepId === 'container-restarted');
      if (!restarted) throw new Error('Container restart step is missing');
      expect(restarted.view.entityStates[nodeId]).toMatchObject({ visible: true });
      expect(restarted.view.entityStates[kubeletId]).toMatchObject({ visible: true });
      expect(() => calculateLayout({ world: restarted.world, view: restarted.view })).not.toThrow();
    }

    const story = flowStoryById.get('container-restart-vs-pod-replacement');
    if (!story) throw new Error('Container restart Flow Story is missing');
    for (const viewport of ['desktop', 'mobile'] as const) {
      const compiledStory = flowStoryEngine.compileStory(
        story,
        { lessons: lessonById, scenarios: scenarioById, sources },
        { viewport },
      );
      const restartBeat = compiledStory.beats.find((beat) => beat.beat.id === 'local-container-restart');
      if (!restartBeat) throw new Error('Local container restart beat is missing');
      expect(restartBeat.compiledStep.view.entityStates[nodeId]).toMatchObject({ visible: true });
      expect(restartBeat.compiledStep.view.entityStates[kubeletId]).toMatchObject({ visible: true });
      expect(() =>
        calculateLayout({
          world: restartBeat.compiledStep.world,
          view: restartBeat.compiledStep.view,
        }),
      ).not.toThrow();
    }

    const direct = courseEngine.compileDirect(lesson, lessonScenario, 0, {
      viewport: 'mobile',
    });
    expect(direct).toEqual(mobile.steps[0]);
'''
if old not in text:
    raise SystemExit('Missing responsive test direct-compile block')
test.write_text(text.replace(old, new, 1), 'utf-8')

# Browser QA avoids racing the valid autoplay timer. The normal test checks scenario switching and
# deep-link families; reduced-motion mode deterministically exercises the formerly crashing second
# restart beat. All viewports reject uncaught page errors and horizontal overflow.
Path('tests/e2e/homePlayground.spec.ts').write_text(
    '''import { expect, test, type Page } from '@playwright/test';

async function openCleanHome(page: Page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
  const showcase = page.locator('.home-showcase');
  await expect(showcase).toBeVisible();
  await expect(showcase.locator('.scene-viewport')).toHaveAttribute('data-renderer-state', 'ready');
  await expect(showcase.locator('canvas')).toBeVisible();
  await expect.poll(() => showcase.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(280);
  await page.waitForTimeout(250);
}

test('persistent homepage playground switches verified Kubernetes stories', async ({ page }, testInfo) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await openCleanHome(page);

  const showcase = page.locator('.home-showcase');
  const scenario = (name: string) => showcase.getByRole('button', { name, exact: true });
  const explain = showcase.getByRole('link', { name: 'Explain this' });

  await expect(scenario('Overview')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Manifest to running Pod', { exact: true })).toBeVisible();

  await scenario('Request').click({ force: true });
  await expect(scenario('Request')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Internal Service request', { exact: true })).toBeVisible();
  await expect(explain).toHaveAttribute('href', /^#\/stories\/internal-service-request\/\d+$/);

  await scenario('Kill container').click({ force: true });
  await expect(scenario('Kill container')).toHaveAttribute('aria-pressed', 'true');
  await expect(showcase.getByText('Container restart versus Pod replacement', { exact: true })).toBeVisible();
  await expect(explain).toHaveAttribute('href', /^#\/stories\/container-restart-vs-pod-replacement\/\d+$/);

  await scenario('Delete Pod').click({ force: true });
  await expect(scenario('Delete Pod')).toHaveAttribute('aria-pressed', 'true');
  await expect(explain).toHaveAttribute('href', /^#\/stories\/container-restart-vs-pod-replacement\/\d+$/);

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
  await showcase.getByRole('button', { name: 'Kill container', exact: true }).click({ force: true });
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

  await page.screenshot({ path: testInfo.outputPath('homepage-playground-reduced.png'), fullPage: false });
});
''',
    'utf-8',
)
