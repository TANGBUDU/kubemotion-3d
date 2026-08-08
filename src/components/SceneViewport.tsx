import { useEffect, useId, useRef, useState } from 'react';
import type { AriaAttributes, AriaRole } from 'react';
import type { CompiledStep, PlaybackRequest } from '../course/types';
import type { Locale } from '../app/types';
import { SceneController, SceneRendererInitializationError } from '../renderer/SceneController';
import { recordSceneControllerCreated, setDiagnosticsProvider } from '../test-support/debugBridge';
import type { EntityId } from '../world/types';
import type { ViewportInsets } from '../renderer/camera/SafeViewport';
import '../styles/scene-renderer-fallback.css';

export interface SceneViewportProps {
  step: CompiledStep;
  playback: PlaybackRequest;
  selectedEntityId?: EntityId | undefined;
  locale: Locale;
  reducedMotion: boolean;
  cameraResetId?: number | undefined;
  safeInsets?: Partial<ViewportInsets> | undefined;
  onSelectEntity: (id?: EntityId | undefined) => void;
  role?: AriaRole | undefined;
  'aria-label'?: AriaAttributes['aria-label'] | undefined;
  'aria-labelledby'?: AriaAttributes['aria-labelledby'] | undefined;
  'aria-describedby'?: AriaAttributes['aria-describedby'] | undefined;
}

type RendererState = 'initializing' | 'ready' | 'failed';

const rendererFallbackCopy: Record<
  Locale,
  { readonly title: string; readonly description: string; readonly retry: string }
> = {
  en: {
    title: '3D scene unavailable',
    description: 'Your browser could not start WebGL. The rest of this page remains available.',
    retry: 'Retry 3D scene',
  },
  ja: {
    title: '3D シーンを利用できません',
    description:
      'ブラウザーで WebGL を開始できませんでした。このページの他のコンテンツは引き続き利用できます。',
    retry: '3D シーンを再試行',
  },
  'zh-CN': {
    title: '3D 场景暂不可用',
    description: '浏览器无法启动 WebGL。页面上的其余内容仍可继续查看。',
    retry: '重试 3D 场景',
  },
};

export function SceneViewport(props: SceneViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController>(null);
  const restoreFocusAfterRetryRef = useRef(false);
  const fallbackTitleId = useId();
  const fallbackDescriptionId = useId();
  const [rendererState, setRendererState] = useState<RendererState>('initializing');
  const [attempt, setAttempt] = useState(0);
  const safeTop = props.safeInsets?.top ?? 0;
  const safeRight = props.safeInsets?.right ?? 0;
  const safeBottom = props.safeInsets?.bottom ?? 0;
  const safeLeft = props.safeInsets?.left ?? 0;
  const fallbackCopy = rendererFallbackCopy[props.locale];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let active = true;
    const publishRendererState = (state: RendererState): void => {
      queueMicrotask(() => {
        if (active) setRendererState(state);
      });
    };
    let controller: SceneController;
    try {
      controller = new SceneController(host);
    } catch (error: unknown) {
      if (!(error instanceof SceneRendererInitializationError)) throw error;
      controllerRef.current = null;
      setDiagnosticsProvider(undefined);
      publishRendererState('failed');
      return () => {
        active = false;
      };
    }
    const recordDestroyed = recordSceneControllerCreated();
    controllerRef.current = controller;
    setDiagnosticsProvider(() => controller.getDiagnostics());
    publishRendererState('ready');
    return () => {
      active = false;
      setDiagnosticsProvider(undefined);
      controller.destroy();
      recordDestroyed(controller.getDiagnostics().eventListeners);
      controllerRef.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (rendererState === 'failed') {
      fallbackRef.current?.focus();
      return;
    }
    if (rendererState === 'ready' && restoreFocusAfterRetryRef.current) {
      restoreFocusAfterRetryRef.current = false;
      viewportRef.current?.focus();
    }
  }, [rendererState]);

  useEffect(() => {
    controllerRef.current?.setLocale(props.locale);
  }, [attempt, props.locale]);
  useEffect(() => {
    controllerRef.current?.setSafeInsets({
      top: safeTop,
      right: safeRight,
      bottom: safeBottom,
      left: safeLeft,
    });
  }, [attempt, safeBottom, safeLeft, safeRight, safeTop]);
  useEffect(() => {
    controllerRef.current?.setOnSelect(props.onSelectEntity);
  }, [attempt, props.onSelectEntity]);
  useEffect(() => {
    controllerRef.current?.applyStep(props.step);
  }, [attempt, props.step]);
  useEffect(() => {
    controllerRef.current?.playTransition(props.playback, props.reducedMotion);
  }, [attempt, props.playback, props.reducedMotion]);
  useEffect(() => {
    controllerRef.current?.setSelection(props.selectedEntityId);
  }, [attempt, props.selectedEntityId]);
  useEffect(() => {
    if (props.cameraResetId === undefined || props.cameraResetId === 0) return;
    controllerRef.current?.resetCamera();
  }, [attempt, props.cameraResetId]);

  const retry = (): void => {
    restoreFocusAfterRetryRef.current = true;
    setRendererState('initializing');
    setAttempt((current) => current + 1);
  };

  const exposeSceneSemantics = rendererState !== 'failed';

  return (
    <div
      ref={viewportRef}
      className="scene-viewport"
      role={exposeSceneSemantics ? props.role : undefined}
      aria-label={exposeSceneSemantics ? props['aria-label'] : undefined}
      aria-labelledby={exposeSceneSemantics ? props['aria-labelledby'] : undefined}
      aria-describedby={exposeSceneSemantics ? props['aria-describedby'] : undefined}
      tabIndex={-1}
      data-testid="scene-viewport"
      data-renderer-state={rendererState}
    >
      <div className="scene-render-host" ref={hostRef} data-testid="scene-render-host" />
      {rendererState === 'failed' && (
        <div
          ref={fallbackRef}
          className="scene-renderer-fallback"
          role="alert"
          tabIndex={-1}
          aria-labelledby={fallbackTitleId}
          aria-describedby={fallbackDescriptionId}
          data-testid="scene-renderer-fallback"
        >
          <div className="scene-renderer-fallback__panel">
            <strong id={fallbackTitleId}>{fallbackCopy.title}</strong>
            <p id={fallbackDescriptionId}>{fallbackCopy.description}</p>
            <button type="button" onClick={retry}>
              {fallbackCopy.retry}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
