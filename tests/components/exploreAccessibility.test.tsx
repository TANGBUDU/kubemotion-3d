import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExplorePage } from '../../src/pages/ExplorePage';
import { useAppStore } from '../../src/state/appStore';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: () => <div data-testid="mock-scene-viewport" />,
}));

describe('Explore view tabs', () => {
  beforeEach(() => {
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
    const traffic = screen.getByRole('tab', { name: 'traffic' });
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
    expect(traffic).toHaveFocus();
    expect(traffic).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(traffic, { key: 'Home' });
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(overview, { key: 'ArrowLeft' });
    expect(traffic).toHaveFocus();
    expect(traffic).toHaveAttribute('aria-selected', 'true');
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
});
