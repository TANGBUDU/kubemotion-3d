import { useEffect, useId, useRef, useState } from 'react';
import type { AriaAttributes, AriaRole } from 'react';
import type { CompiledStep, PlaybackRequest } from '../course/types';
import type { Locale } from '../app/types';
import { SceneController, SceneRendererInitializationError } from '../renderer/SceneController';
import { recordSceneControllerCreated, setDiagnosticsProvider } from '../test-support/debugBridge';
import type { EntityId } from '../world/types';
import type { ViewportInsets, ViewportRect } from '../renderer/camera/SafeViewport';
import type { SceneCameraMode } from '../renderer/SceneController';
import { BeginnerProblemStage, beginnerProblemStageKindForStep } from './BeginnerProblemStage';
import '../styles/scene-renderer-fallback.css';

export interface SceneViewportProps {
  step: CompiledStep;
  playback: PlaybackRequest;
  selectedEntityId?: EntityId | undefined;
  locale: Locale;
  reducedMotion: boolean;
  cameraResetId?: number | undefined;
  cameraMode?: SceneCameraMode | undefined;
  allowPerspective?: boolean | undefined;
  safeInsets?: Partial<ViewportInsets> | undefined;
  safeExclusionSelectors?: readonly string[] | undefined;
  safeViewportRevision?: string | number | undefined;
  onViewportClassChange?: ((viewport: 'mobile' | 'desktop') => void) | undefined;
  onSelectEntity: (id?: EntityId | undefined) => void;
  role?: AriaRole | undefined;
  'aria-label'?: AriaAttributes['aria-label'] | undefined;
  'aria-labelledby'?: AriaAttributes['aria-labelledby'] | undefined;
  'aria-describedby'?: AriaAttributes['aria-describedby'] | undefined;
}

type RendererState = 'initializing' | 'ready' | 'failed';

const relativeIntersection = (host: DOMRect, exclusion: DOMRect): ViewportRect | undefined => {
  const left = Math.max(host.left, exclusion.left);
  const top = Math.max(host.top, exclusion.top);
  const right = Math.min(host.right, exclusion.right);
  const bottom = Math.min(host.bottom, exclusion.bottom);
  if (right <= left || bottom <= top) return undefined;
  return {
    x: left - host.left,
    y: top - host.top,
    width: right - left,
    height: bottom - top,
  };
};

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
  const conceptKind = beginnerProblemStageKindForStep(props.step);
  if (conceptKind) {
    return (
      <BeginnerProblemStage
        kind={conceptKind}
        locale={props.locale}
        ariaLabel={props['aria-label']}
        onViewportClassChange={props.onViewportClassChange}
      />
    );
  }
  return <ThreeSceneViewport {...props} />;
}

function ThreeSceneViewport(props: SceneViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController>(null);
  const allowPerspectiveRef = useRef(props.allowPerspective ?? false);
  const initialCameraModeRef = useRef<SceneCameraMode>(props.cameraMode ?? 'orthographic');
  const restoreFocusAfterRetryRef = useRef(false);
  const fallbackTitleId = useId();
  const fallbackDescriptionId = useId();
  const [rendererState, setRendererState] = useState<RendererState>('initializing');
  const [attempt, setAttempt] = useState(0);
  const safeTop = props.safeInsets?.top ?? 0;
  const safeRight = props.safeInsets?.right ?? 0;
  const safeBottom = props.safeInsets?.bottom ?? 0;
  const safeLeft = props.safeInsets?.left ?? 0;
  const cameraMode = props.cameraMode ?? 'orthographic';
  const exclusionSelectorsKey = props.safeExclusionSelectors?.join('\u001f') ?? '';
  const onViewportClassChange = props.onViewportClassChange;
  const safeViewportRevision = props.safeViewportRevision;
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
      controller = new SceneController(host, {
        allowPerspective: allowPerspectiveRef.current,
        cameraMode: initialCameraModeRef.current,
      });
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
    setDiagnosticsProvider(
      () => controller.getDiagnostics(),
      () => controller.getLayoutPositions(),
    );
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
    const host = hostRef.current;
    const controller = controllerRef.current;
    if (!host || !controller || rendererState !== 'ready') return;
    const selectors = exclusionSelectorsKey ? exclusionSelectorsKey.split('\u001f') : [];
    const candidates = [
      ...new Set(
        selectors.flatMap((selector) => [...document.querySelectorAll<HTMLElement>(selector)]),
      ),
    ];
    let animationFrame: number | undefined;
    let lastSignature = '';
    const measure = () => {
      animationFrame = undefined;
      const hostRect = host.getBoundingClientRect();
      onViewportClassChange?.(hostRect.width <= 720 ? 'mobile' : 'desktop');
      const exclusions = candidates.flatMap((element) => {
        if (element.hidden) return [];
        const rect = relativeIntersection(hostRect, element.getBoundingClientRect());
        return rect ? [rect] : [];
      });
      const signature = JSON.stringify(exclusions);
      if (signature === lastSignature) return;
      lastSignature = signature;
      controller.setSafeInsets(
        { top: safeTop, right: safeRight, bottom: safeBottom, left: safeLeft },
        exclusions,
      );
    };
    const scheduleMeasure = () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(measure);
    };
    const resizeObserver =
      typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(scheduleMeasure);
    resizeObserver?.observe(host);
    for (const element of candidates) resizeObserver?.observe(element);
    const mutationObserver =
      typeof MutationObserver === 'undefined' ? undefined : new MutationObserver(scheduleMeasure);
    for (const element of candidates) {
      mutationObserver?.observe(element, {
        attributes: true,
        attributeFilter: ['class', 'hidden', 'style'],
      });
    }
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    measure();
    return () => {
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
    };
  }, [
    attempt,
    exclusionSelectorsKey,
    safeViewportRevision,
    onViewportClassChange,
    rendererState,
    safeBottom,
    safeLeft,
    safeRight,
    safeTop,
  ]);
  useEffect(() => {
    controllerRef.current?.setCameraMode(cameraMode);
  }, [attempt, cameraMode]);
  useEffect(() => {
    controllerRef.current?.setReducedMotion(props.reducedMotion);
  }, [attempt, props.reducedMotion]);
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
      data-camera-mode={cameraMode}
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
