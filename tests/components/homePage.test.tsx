import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomePage } from '../../src/pages/HomePage';
import { useAppStore } from '../../src/state/appStore';

vi.mock('../../src/components/SceneViewport', () => ({
  SceneViewport: () => <div data-testid="scene-preview" />,
}));

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<p>Explore</p>} />
        <Route path="/learn/:lessonId/:stepIndex" element={<p>Lesson</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomePage orientation', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      locale: 'en',
      orientationSeen: false,
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
    });
  });

  it('orients a first-time learner before offering one lesson action', () => {
    renderHome();

    expect(screen.getByTestId('orientation-card')).toBeVisible();
    expect(screen.getByText('Control Plane decides.')).toBeVisible();
    expect(screen.getByText('Worker Nodes run Pods.')).toBeVisible();
    expect(screen.getByText('A Pod contains one or more Containers.')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Start lesson' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/service-routes-to-pods/0',
    );
    expect(screen.queryByRole('link', { name: /explore/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'View orientation again' }),
    ).not.toBeInTheDocument();
  });

  it('remembers orientation when the learner starts the lesson', () => {
    renderHome();
    fireEvent.click(screen.getByRole('link', { name: 'Start lesson' }));

    expect(screen.getByText('Lesson')).toBeVisible();
    expect(useAppStore.getState().orientationSeen).toBe(true);
    expect(JSON.parse(localStorage.getItem('kubemotion:v1:preferences') ?? '{}')).toMatchObject({
      orientationSeen: true,
    });
  });

  it('lets returning learners reopen and skip the orientation with focus restored', async () => {
    useAppStore.setState({ orientationSeen: true });
    renderHome();

    const reopen = screen.getByRole('button', { name: 'View orientation again' });
    expect(screen.queryByTestId('orientation-card')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Start lesson' })).toHaveLength(1);

    fireEvent.click(reopen);
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: /Three ideas/i })).toHaveFocus(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Continue without review' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'View orientation again' })).toHaveFocus(),
    );
  });

  it('continues a valid saved lesson position and safely ignores invalid progress', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 3,
    });
    const view = renderHome();

    expect(screen.getByRole('link', { name: 'Continue learning' })).toHaveAttribute(
      'href',
      '/learn/container-restart-vs-pod-replacement/3',
    );

    view.unmount();
    useAppStore.setState({ lessonId: 'planned-or-missing', stepIndex: 99 });
    renderHome();
    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/service-routes-to-pods/0',
    );
  });

  it('starts the Pod lesson after the Service lesson is complete', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: ['service-routes-to-pods'],
    });

    renderHome();

    expect(screen.getByRole('link', { name: 'Start lesson' })).toHaveAttribute(
      'href',
      '/learn/container-restart-vs-pod-replacement/0',
    );
  });

  it('changes the Home primary action to Explore after every available lesson is complete', () => {
    useAppStore.setState({
      orientationSeen: true,
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
    });

    renderHome();

    expect(screen.getByRole('link', { name: 'Explore completed lessons' })).toHaveAttribute(
      'href',
      '/explore',
    );
    expect(screen.queryByRole('link', { name: 'Continue learning' })).not.toBeInTheDocument();
  });

  it('localizes the three orientation concepts', () => {
    useAppStore.setState({ locale: 'zh-CN' });
    renderHome();

    expect(screen.getByText('控制平面负责决策。')).toBeVisible();
    expect(screen.getByText('工作节点运行 Pod。')).toBeVisible();
    expect(screen.getByText('一个 Pod 包含一个或多个容器。')).toBeVisible();
    expect(screen.getByRole('link', { name: '开始课程' })).toBeVisible();
  });
});
