import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExploreUnavailableView } from '../../src/components/ExploreUnavailableView';
import { ExplorePage } from '../../src/pages/ExplorePage';
import { LayoutContractError } from '../../src/renderer/layouts/LayoutContractError';
import { useAppStore } from '../../src/state/appStore';

const desktopMatchMedia = window.matchMedia;

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: ({
    cameraMode,
    cameraResetId,
    step,
  }: {
    cameraMode?: string;
    cameraResetId?: number;
    step: { view: { entityStates: Record<string, { visible: boolean; labelMode: string }> } };
  }) => (
    <div
      data-testid="mock-scene-viewport"
      data-camera-mode={cameraMode}
      data-camera-reset-id={cameraResetId}
      data-visible-labels={
        Object.values(step.view.entityStates).filter(
          (state) => state.visible && state.labelMode !== 'none',
        ).length
      }
    />
  ),
}));

describe('Explore view tabs', () => {
  beforeEach(() => {
    window.matchMedia = desktopMatchMedia;
    useAppStore.setState({
      locale: 'en',
      view: 'overview',
      selectedEntityId: undefined,
      filters: { query: '', kind: '', namespace: '', status: '' },
    });
  });

  it('uses one tab stop with wrapping Arrow, Home, and End navigation', () => {
    const windowKeydown = vi.fn();
    window.addEventListener('keydown', windowKeydown);
    render(<ExplorePage />);

    const overview = screen.getByRole('tab', { name: 'overview' });
    const logical = screen.getByRole('tab', { name: 'logical' });
    const storage = screen.getByRole('tab', { name: 'storage' });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('aria-controls', 'explore-scene-panel');
    expect(overview).toHaveAttribute('tabindex', '0');
    expect(logical).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'explore-view-tab-overview',
    );
    expect(screen.getByRole('tabpanel')).toHaveAttribute('tabindex', '0');

    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(logical).toHaveFocus();
    expect(logical).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('tabindex', '-1');
    expect(useAppStore.getState().view).toBe('logical');

    fireEvent.keyDown(logical, { key: 'End' });
    expect(storage).toHaveFocus();
    expect(storage).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(storage, { key: 'Home' });
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(storage).toHaveFocus();
    expect(storage).toHaveAttribute('aria-selected', 'true');
    expect(windowKeydown).not.toHaveBeenCalled();
    window.removeEventListener('keydown', windowKeydown);
  });

  it('offers a keyboard-accessible object picker that opens the inspector', () => {
    render(<ExplorePage />);
    const entityId = 'api-object:namespaced:shop:Pod:api-a-old';

    fireEvent.change(screen.getByRole('combobox', { name: 'Inspect an object' }), {
      target: { value: entityId },
    });

    expect(useAppStore.getState().selectedEntityId).toBe(entityId);
    expect(screen.getByRole('button', { name: 'Close inspector' })).toHaveFocus();
    expect(screen.getByRole('dialog', { name: /api-7f8d9-a/ })).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'logical' }));
    expect(useAppStore.getState().selectedEntityId).toBe(entityId);
    expect(screen.getByRole('dialog', { name: /api-7f8d9-a/ })).toBeVisible();
    expect(screen.getByRole('tabpanel')).toHaveAttribute(
      'aria-labelledby',
      'explore-view-tab-logical',
    );
  });

  it('offers explicit orthographic, perspective, and reset camera controls', () => {
    render(<ExplorePage />);

    const controls = screen.getByRole('group', { name: 'Camera projection' });
    const orthographic = within(controls).getByRole('button', { name: 'Orthographic' });
    const perspective = within(controls).getByRole('button', { name: 'Perspective' });
    expect(orthographic).toHaveAttribute('aria-pressed', 'true');
    expect(perspective).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('mock-scene-viewport')).toHaveAttribute(
      'data-camera-mode',
      'orthographic',
    );

    fireEvent.click(perspective);
    expect(perspective).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mock-scene-viewport')).toHaveAttribute(
      'data-camera-mode',
      'perspective',
    );
    fireEvent.click(within(controls).getByRole('button', { name: 'Reset camera' }));
    expect(screen.getByTestId('mock-scene-viewport')).toHaveAttribute('data-camera-reset-id', '1');
  });

  it('compiles Explore through the mobile grammar at the runtime breakpoint', () => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query === '(max-width: 720px)',
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;

    render(<ExplorePage />);
    expect(screen.getByTestId('mock-scene-viewport')).toHaveAttribute('data-visible-labels', '3');
  });

  it('keeps an unavailable Traffic view neutral and exposes its structured layout context', () => {
    render(<ExplorePage />);
    fireEvent.click(screen.getByRole('tab', { name: 'traffic' }));

    const unavailable = screen.getByTestId('explore-unavailable-view');
    expect(unavailable).toHaveTextContent(
      'This view is unavailable for the current snapshot or filters.',
    );
    expect(unavailable).toHaveTextContent(
      'The selected objects do not provide the topology required by this view.',
    );
    expect(unavailable).toHaveTextContent('Reset filters or open the related guided lesson.');
    expect(unavailable).toHaveAttribute('data-view', 'traffic');
    expect(unavailable).toHaveAttribute(
      'data-layout-issues',
      expect.stringContaining('missing-role'),
    );
    expect(
      screen.getByRole('link', { name: 'Open the Service and EndpointSlice lesson.' }),
    ).toHaveAttribute('href', '#/learn/service-routes-to-pods/0');
  });
});

describe('Explore unavailable translations', () => {
  const error = new LayoutContractError({
    view: 'control-flow',
    scenarioId: 'filtered-snapshot',
    issues: [{ code: 'missing-role', role: 'api-server' }],
  });

  it.each([
    [
      'ja' as const,
      '現在のスナップショットまたはフィルターでは、このビューを表示できません。',
      '選択中のオブジェクトだけでは、このビューに必要なトポロジーが揃っていません。',
    ],
    [
      'zh-CN' as const,
      '当前快照或筛选条件无法组成这个视图。',
      '当前可见对象不具备该视图所需的完整拓扑。',
    ],
  ])('uses neutral snapshot-or-filter copy in %s', (locale, title, detail) => {
    render(<ExploreUnavailableView error={error} locale={locale} />);

    const unavailable = screen.getByTestId('explore-unavailable-view');
    expect(unavailable).toHaveTextContent(title);
    expect(unavailable).toHaveTextContent(detail);
    expect(unavailable).toHaveAttribute('data-scenario-id', 'filtered-snapshot');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
