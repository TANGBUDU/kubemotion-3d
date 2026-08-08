import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Locale } from '../../src/app/types';
import type { ProgressSaveStatus } from '../../src/state/appStore';
import { LessonCompletionCard } from '../../src/ui/lesson/LessonCompletionCard';
import { ProgressSaveAlerts } from '../../src/ui/lesson/ProgressSaveAlerts';

function renderCard(locale: Locale, saveStatus: ProgressSaveStatus) {
  const onRetry = vi.fn();
  render(
    <MemoryRouter>
      <LessonCompletionCard
        locale={locale}
        lessonTitle="Service lesson"
        completed={saveStatus !== 'idle'}
        saveStatus={saveStatus}
        nextLesson={{ id: 'next-lesson', title: 'Next lesson' }}
        onComplete={vi.fn()}
        onRetry={onRetry}
        onRestart={vi.fn()}
      />
    </MemoryRouter>,
  );
  return { onRetry };
}

describe('LessonCompletionCard persistence feedback', () => {
  it('announces pending work without claiming success or exposing Next early', () => {
    renderCard('en', 'saving');

    expect(screen.getByRole('status')).toHaveTextContent('Saving Service lesson');
    expect(screen.getByRole('button', { name: 'Saving progress…' })).toBeDisabled();
    expect(screen.queryByText('Lesson complete')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Next lesson:/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it.each([
    ['en', 'Progress was not saved', 'Retry save', 'may be lost if you reload'],
    ['ja', '進捗を保存できませんでした', '保存を再試行', '再読み込み後に失われる可能性'],
    ['zh-CN', '进度未能保存', '重试保存', '重新加载后可能丢失'],
  ] as const)(
    'exposes a nonblocking localized retry for %s',
    (locale, failure, retry, reloadWarning) => {
      const { onRetry } = renderCard(locale, 'failed');

      expect(screen.getByRole('alert')).toHaveTextContent(reloadWarning);
      expect(screen.getByText(failure)).toBeVisible();
      fireEvent.click(screen.getByRole('button', { name: retry }));
      expect(onRetry).toHaveBeenCalledOnce();
      expect(screen.getByRole('link')).toBeVisible();
    },
  );

  it('announces a saved completion before exposing its next action', () => {
    renderCard('en', 'saved');

    expect(screen.getByRole('status')).toHaveTextContent('has been saved in this browser');
    expect(screen.getByText('Progress saved')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Next lesson: Next lesson' })).toHaveAttribute(
      'href',
      '/learn/next-lesson/0',
    );
  });

  it('keeps an off-route failed lesson visible and retryable', () => {
    const onRetry = vi.fn();
    render(
      <ProgressSaveAlerts
        locale="en"
        failures={[{ id: 'service-routes-to-pods', title: 'Service lesson' }]}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Service lesson was not saved and may be lost if you reload.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry saving Service lesson' }));
    expect(onRetry).toHaveBeenCalledWith('service-routes-to-pods');
  });
});
