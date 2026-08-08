import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LearnPage } from '../../src/pages/LearnPage';
import { useAppStore } from '../../src/state/appStore';

const progressKey = 'kubemotion:v1:progress';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: () => <div data-testid="scene-viewport" />,
}));

function renderCourse(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Home destination</p>} />
        <Route path="/explore" element={<p>Explore destination</p>} />
        <Route path="/learn" element={<LearnPage />} />
        <Route path="/learn/:lessonId" element={<LearnPage />} />
        <Route path="/learn/:lessonId/:stepIndex" element={<LearnPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function seedProgress(progress: {
  lessonId?: string;
  stepIndex: number;
  completedLessonIds: string[];
}) {
  localStorage.setItem(progressKey, JSON.stringify(progress));
  useAppStore.setState(progress);
}

describe('course entry and completion flow', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      locale: 'en',
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      selectedEntityId: undefined,
    });
  });

  it('starts the first available lesson from the manifest order', async () => {
    renderCourse('/learn');
    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'Identify the traffic objects',
    );
  });

  it('resumes valid progress while an explicit deep link remains authoritative', async () => {
    seedProgress({
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 3,
      completedLessonIds: [],
    });
    const resumeView = renderCourse('/learn');
    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'kubelet restarts the Container in the same Pod',
    );

    resumeView.unmount();
    renderCourse('/learn/service-routes-to-pods/4');
    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'api-a remains listed but becomes NotReady',
    );
    await waitFor(() => {
      expect(useAppStore.getState()).toMatchObject({
        lessonId: 'service-routes-to-pods',
        stepIndex: 4,
      });
    });
  });

  it.each([
    '/learn/container-restart-vs-pod-replacement',
    '/learn/container-restart-vs-pod-replacement/999',
  ])('normalizes a valid lesson deep link %s to that lesson step zero', async (path) => {
    renderCourse(path);

    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'What you are looking at',
    );
    await waitFor(() => {
      expect(useAppStore.getState()).toMatchObject({
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 0,
      });
    });
  });

  it('sends bare Learn to the Pod lesson after Service completion', async () => {
    seedProgress({
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: ['service-routes-to-pods'],
    });

    renderCourse('/learn');

    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'What you are looking at',
    );
    await waitFor(() => {
      expect(useAppStore.getState()).toMatchObject({
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 0,
      });
    });
  });

  it('sends bare Learn to Explore after every available lesson is complete', async () => {
    seedProgress({
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
    });

    renderCourse('/learn');

    expect(await screen.findByText('Explore destination')).toBeVisible();
  });

  it('completes the Service lesson and offers the next verified lesson', async () => {
    renderCourse('/learn/service-routes-to-pods/5');
    const completion = await screen.findByTestId('lesson-completion-card');

    expect(within(completion).getByText('Final step ready')).toBeVisible();
    expect(useAppStore.getState().completedLessonIds).toEqual([]);
    expect(
      within(completion).queryByRole('link', { name: /Next lesson:/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(within(completion).getByRole('button', { name: 'Complete lesson' }));

    expect(await within(completion).findByText('Lesson complete')).toBeVisible();
    expect(
      within(completion).getByRole('link', {
        name: /Next lesson: Container restart is not Pod replacement/i,
      }),
    ).toHaveAttribute('href', '/learn/container-restart-vs-pod-replacement/0');
    await waitFor(() =>
      expect(useAppStore.getState().completedLessonIds).toEqual(['service-routes-to-pods']),
    );

    fireEvent.click(within(completion).getByRole('button', { name: 'Restart lesson' }));
    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent(
      'Identify the traffic objects',
    );
  });

  it('hides the camera reset action when the final step is a comparison panel', async () => {
    renderCourse('/learn/container-restart-vs-pod-replacement/9');
    await screen.findByTestId('lesson-completion-card');
    const lessonHeader = document.querySelector('.lesson-header');

    expect(lessonHeader).not.toBeNull();
    expect(
      within(lessonHeader as HTMLElement).queryByRole('button', { name: 'Reset camera' }),
    ).not.toBeInTheDocument();
  });

  it('offers the first unfinished lesson after an out-of-order localized completion', async () => {
    useAppStore.setState({ locale: 'zh-CN' });
    renderCourse('/learn/container-restart-vs-pod-replacement/9');
    const completion = await screen.findByTestId('lesson-completion-card');

    expect(within(completion).getByText('已到最后一步')).toBeVisible();
    fireEvent.click(within(completion).getByRole('button', { name: '完成课程' }));

    expect(await within(completion).findByText('课程已完成')).toBeVisible();
    expect(
      within(completion).getByRole('link', { name: /下一课：Service 如何将流量路由到 Ready Pod/ }),
    ).toHaveAttribute('href', '/learn/service-routes-to-pods/0');
    expect(within(completion).getByRole('link', { name: '返回首页' })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('button', { name: '重新开始课程' })).toHaveLength(2);

    const lessonHeader = document.querySelector('.lesson-header');
    expect(lessonHeader).not.toBeNull();
    fireEvent.click(
      within(lessonHeader as HTMLElement).getByRole('button', { name: '重新开始课程' }),
    );
    expect(await screen.findByTestId('teaching-step-heading')).toHaveTextContent('先认识这个场景');
  });

  it('does not offer an already-completed lesson as the next lesson', async () => {
    seedProgress({
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 0,
      completedLessonIds: ['container-restart-vs-pod-replacement'],
    });

    renderCourse('/learn/service-routes-to-pods/5');
    const completion = await screen.findByTestId('lesson-completion-card');

    fireEvent.click(within(completion).getByRole('button', { name: 'Complete lesson' }));

    expect(
      within(completion).queryByRole('link', { name: /Next lesson: Container restart/i }),
    ).not.toBeInTheDocument();
    expect(
      await within(completion).findByRole('link', { name: 'Explore the verified world' }),
    ).toHaveAttribute('href', '/explore');
    await waitFor(() =>
      expect(useAppStore.getState().completedLessonIds).toEqual([
        'container-restart-vs-pod-replacement',
        'service-routes-to-pods',
      ]),
    );
  });
});
