import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppHeader } from '../../src/components/AppHeader';
import { useAppStore } from '../../src/state/appStore';

function renderHeader() {
  return render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>,
  );
}

describe('AppHeader locale and progress reset', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    useAppStore.setState({
      locale: 'en',
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: ['service-routes-to-pods'],
    });
    vi.restoreAllMocks();
  });

  it('keeps the document language and controls synchronized with the selected locale', async () => {
    renderHeader();

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'ja' },
    });

    await waitFor(() => expect(document.documentElement.lang).toBe('ja'));
    expect(screen.getByRole('navigation', { name: 'メインナビゲーション' })).toBeVisible();
    expect(screen.getByText('動きを抑える')).toBeVisible();
    expect(screen.getByRole('button', { name: '学習進捗をリセット' })).toBeEnabled();
  });

  it('requires confirmation, preserves progress on cancel, and announces a successful reset', () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderHeader();
    const reset = screen.getByRole('button', { name: 'Reset learning progress' });

    fireEvent.click(reset);
    expect(confirm).toHaveBeenCalledWith(
      'Reset all lesson progress and completion history stored in this browser?',
    );
    expect(useAppStore.getState().completedLessonIds).toEqual(['service-routes-to-pods']);

    fireEvent.click(reset);
    expect(useAppStore.getState()).toMatchObject({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Learning progress reset.');
  });
});
