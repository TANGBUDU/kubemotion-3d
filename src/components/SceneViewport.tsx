import { useEffect, useRef } from 'react';
import type { CompiledStep, PlaybackRequest } from '../course/types';
import type { Locale } from '../app/types';
import { SceneController } from '../renderer/SceneController';
import { setDiagnosticsProvider } from '../test-support/debugBridge';
import type { EntityId } from '../world/types';
import type { ViewportInsets } from '../renderer/camera/SafeViewport';

export interface SceneViewportProps {
  step: CompiledStep;
  playback: PlaybackRequest;
  selectedEntityId?: EntityId | undefined;
  locale: Locale;
  reducedMotion: boolean;
  cameraResetId?: number | undefined;
  safeInsets?: Partial<ViewportInsets> | undefined;
  onSelectEntity: (id?: EntityId | undefined) => void;
}

export function SceneViewport(props: SceneViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController>(null);
  const safeTop = props.safeInsets?.top ?? 0;
  const safeRight = props.safeInsets?.right ?? 0;
  const safeBottom = props.safeInsets?.bottom ?? 0;
  const safeLeft = props.safeInsets?.left ?? 0;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const controller = new SceneController(host);
    controllerRef.current = controller;
    setDiagnosticsProvider(() => controller.getDiagnostics());
    return () => {
      setDiagnosticsProvider(undefined);
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setLocale(props.locale);
  }, [props.locale]);
  useEffect(() => {
    controllerRef.current?.setSafeInsets({
      top: safeTop,
      right: safeRight,
      bottom: safeBottom,
      left: safeLeft,
    });
  }, [safeBottom, safeLeft, safeRight, safeTop]);
  useEffect(() => {
    controllerRef.current?.setOnSelect(props.onSelectEntity);
  }, [props.onSelectEntity]);
  useEffect(() => {
    controllerRef.current?.applyStep(props.step);
  }, [props.step]);
  useEffect(() => {
    controllerRef.current?.playTransition(props.playback, props.reducedMotion);
  }, [props.playback, props.reducedMotion]);
  useEffect(() => {
    controllerRef.current?.setSelection(props.selectedEntityId);
  }, [props.selectedEntityId]);
  useEffect(() => {
    if (props.cameraResetId === undefined || props.cameraResetId === 0) return;
    controllerRef.current?.resetCamera();
  }, [props.cameraResetId]);

  return <div className="scene-viewport" ref={hostRef} data-testid="scene-viewport" />;
}
