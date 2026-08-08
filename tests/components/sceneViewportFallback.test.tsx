import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompiledStep, PlaybackRequest } from '../../src/course/types';
import type { SceneDiagnostics } from '../../src/renderer/SceneController';
import { SceneViewport } from '../../src/components/SceneViewport';

const controllerMock = vi.hoisted(() => ({
  construct: vi.fn<(host: HTMLElement) => object>(),
  InitializationError: class SceneRendererInitializationError extends Error {},
}));

vi.mock('../../src/renderer/SceneController', () => ({
  SceneController: function MockSceneController(host: HTMLElement) {
    return controllerMock.construct(host);
  },
  SceneRendererInitializationError: controllerMock.InitializationError,
}));

const step = {} as CompiledStep;
const playback = {
  stepKey: 'renderer-fallback-test',
  playbackId: 1,
  transition: { cues: [] },
} as PlaybackRequest;

const props = {
  step,
  playback,
  locale: 'en' as const,
  reducedMotion: false,
  onSelectEntity: vi.fn(),
};

const createController = (host: HTMLElement) => {
  const canvas = document.createElement('canvas');
  host.append(canvas);
  const controller = {
    getDiagnostics: vi.fn(() => ({ eventListeners: 0 }) as SceneDiagnostics),
    destroy: vi.fn(() => canvas.remove()),
    setLocale: vi.fn(),
    setSafeInsets: vi.fn(),
    setCameraMode: vi.fn(),
    setReducedMotion: vi.fn(),
    setOnSelect: vi.fn(),
    applyStep: vi.fn(),
    playTransition: vi.fn(),
    setSelection: vi.fn(),
    resetCamera: vi.fn(),
  };
  return controller;
};

describe('SceneViewport WebGL initialization fallback', () => {
  beforeEach(() => {
    controllerMock.construct.mockReset();
    props.onSelectEntity.mockReset();
  });

  it('contains construction failure and localizes the accessible fallback', async () => {
    controllerMock.construct.mockImplementation(() => {
      throw new controllerMock.InitializationError('WebGL context unavailable');
    });
    const { rerender } = render(
      <>
        <p id="scene-summary">A deterministic Kubernetes scene.</p>
        <SceneViewport
          {...props}
          locale="zh-CN"
          role="img"
          aria-label="Kubernetes 3D scene"
          aria-describedby="scene-summary"
        />
      </>,
    );

    const fallback = await screen.findByRole('alert');
    expect(fallback).toHaveAccessibleName('3D 场景暂不可用');
    expect(fallback).toHaveTextContent('页面上的其余内容仍可继续查看');
    expect(within(fallback).getByRole('button', { name: '重试 3D 场景' })).toBeEnabled();
    await waitFor(() => expect(fallback).toHaveFocus());
    const viewport = screen.getByTestId('scene-viewport');
    expect(viewport).toHaveAttribute('data-renderer-state', 'failed');
    expect(viewport).not.toHaveAttribute('role');
    expect(viewport).not.toHaveAttribute('aria-label');
    expect(viewport).not.toHaveAttribute('aria-describedby');

    rerender(
      <>
        <p id="scene-summary">A deterministic Kubernetes scene.</p>
        <SceneViewport
          {...props}
          locale="ja"
          role="img"
          aria-label="Kubernetes 3D scene"
          aria-describedby="scene-summary"
        />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveAccessibleName('3D シーンを利用できません');
    expect(screen.getByRole('button', { name: '3D シーンを再試行' })).toBeEnabled();
  });

  it('recreates and synchronizes the controller only after an explicit retry', async () => {
    const recoveredController = createController(document.createElement('div'));
    controllerMock.construct
      .mockImplementationOnce(() => {
        throw new controllerMock.InitializationError('WebGL context unavailable');
      })
      .mockImplementationOnce((host) => {
        const canvas = document.createElement('canvas');
        host.append(canvas);
        return { ...recoveredController, destroy: vi.fn(() => canvas.remove()) };
      });

    const { unmount } = render(
      <>
        <p id="scene-summary">A deterministic Kubernetes scene.</p>
        <SceneViewport
          {...props}
          role="img"
          aria-label="Interactive Kubernetes 3D scene"
          aria-describedby="scene-summary"
        />
      </>,
    );
    const retry = await screen.findByRole('button', { name: 'Retry 3D scene' });
    await waitFor(() => expect(screen.getByTestId('scene-renderer-fallback')).toHaveFocus());
    expect(controllerMock.construct).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    await waitFor(() =>
      expect(screen.getByTestId('scene-viewport')).toHaveAttribute('data-renderer-state', 'ready'),
    );
    expect(controllerMock.construct).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const viewport = screen.getByTestId('scene-viewport');
    expect(viewport).toHaveAttribute('role', 'img');
    expect(viewport).toHaveAccessibleName('Interactive Kubernetes 3D scene');
    expect(viewport).toHaveAttribute('aria-describedby', 'scene-summary');
    expect(viewport).toHaveFocus();
    expect(screen.getByTestId('scene-render-host').querySelector('canvas')).not.toBeNull();
    expect(recoveredController.applyStep).toHaveBeenCalledWith(step);
    expect(recoveredController.playTransition).toHaveBeenCalledWith(playback, false);
    expect(recoveredController.setLocale).toHaveBeenCalledWith('en');
    expect(recoveredController.setCameraMode).toHaveBeenCalledWith('orthographic');
    expect(recoveredController.setReducedMotion).toHaveBeenCalledWith(false);
    expect(recoveredController.setReducedMotion.mock.invocationCallOrder[0]).toBeLessThan(
      recoveredController.applyStep.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );

    unmount();
  });

  it('does not convert unexpected controller failures into the WebGL fallback', () => {
    controllerMock.construct.mockImplementation(() => {
      throw new TypeError('unexpected renderer construction defect');
    });

    expect(() => render(<SceneViewport {...props} />)).toThrow(
      'unexpected renderer construction defect',
    );
    expect(screen.queryByTestId('scene-renderer-fallback')).not.toBeInTheDocument();
  });

  it('measures visible DOM overlays as host-relative safe viewport exclusions', async () => {
    const controller = createController(document.createElement('div'));
    controllerMock.construct.mockImplementation((host) => {
      const canvas = document.createElement('canvas');
      host.append(canvas);
      return { ...controller, destroy: vi.fn(() => canvas.remove()) };
    });
    const domRect = (left: number, top: number, width: number, height: number): DOMRect =>
      ({
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
        toJSON: () => ({}),
      }) as DOMRect;
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: HTMLElement) {
        if (this.classList.contains('scene-render-host')) return domRect(0, 0, 1_000, 600);
        if (this.classList.contains('test-inspector')) return domRect(700, 0, 300, 600);
        return domRect(0, 0, 0, 0);
      });

    try {
      render(
        <>
          <aside className="test-inspector">Inspector</aside>
          <SceneViewport
            {...props}
            safeInsets={{ top: 12, right: 12, bottom: 12, left: 12 }}
            safeExclusionSelectors={['.test-inspector']}
          />
        </>,
      );

      await waitFor(() =>
        expect(controller.setSafeInsets).toHaveBeenCalledWith(
          { top: 12, right: 12, bottom: 12, left: 12 },
          [{ x: 700, y: 0, width: 300, height: 600 }],
        ),
      );
    } finally {
      rectSpy.mockRestore();
    }
  });
});
