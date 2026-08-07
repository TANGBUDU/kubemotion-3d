import { useEffect, useRef } from 'react';
import type { ClusterGraph, EntityId, Locale } from '../domain/types';
import type { SceneProjection, TransitionCue } from '../course/types';
import { SceneController } from '../renderer/SceneController';
import { setDiagnosticsProvider } from '../test-support/debugBridge';

export interface SceneViewportProps {
  graph: ClusterGraph;
  projection: SceneProjection;
  transition: readonly TransitionCue[];
  selectedEntityId?: EntityId | undefined;
  locale: Locale;
  reducedMotion: boolean;
  onSelectEntity: (id?: EntityId) => void;
}

export function SceneViewport(props: SceneViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SceneController>(null);

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
    controllerRef.current?.setGraph(props.graph);
  }, [props.graph]);
  useEffect(() => {
    controllerRef.current?.setLocale(props.locale);
  }, [props.locale]);
  useEffect(() => {
    controllerRef.current?.setOnSelect(props.onSelectEntity);
  }, [props.onSelectEntity]);
  useEffect(() => {
    controllerRef.current?.applyProjection(props.projection);
  }, [props.projection]);
  useEffect(() => {
    controllerRef.current?.playTransition(props.transition, props.reducedMotion);
  }, [props.transition, props.reducedMotion]);
  useEffect(() => {
    controllerRef.current?.setSelection(props.selectedEntityId);
  }, [props.selectedEntityId]);

  return <div className="scene-viewport" ref={hostRef} data-testid="scene-viewport" />;
}
