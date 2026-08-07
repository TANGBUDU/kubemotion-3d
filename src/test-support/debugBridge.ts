import type { SceneDiagnostics } from '../renderer/SceneController';
import type { EntityId } from '../domain/types';
import { useAppStore } from '../state/appStore';

let diagnosticsProvider: (() => SceneDiagnostics) | undefined;

export function setDiagnosticsProvider(provider?: (() => SceneDiagnostics) | undefined): void {
  diagnosticsProvider = provider;
}

export function installDebugBridge(): void {
  if (!(
    import.meta.env.DEV ||
    location.hostname === '127.0.0.1' ||
    location.hostname === 'localhost'
  ))
    return;
  window.__KUBEMOTION_TEST__ = {
    getAppState: () => {
      const state = useAppStore.getState();
      return {
        locale: state.locale,
        mode: state.mode,
        lessonId: state.lessonId,
        stepIndex: state.stepIndex,
        view: state.view,
        selectedEntityId: state.selectedEntityId,
      };
    },
    getSceneDiagnostics: () => diagnosticsProvider?.(),
    selectEntity: (id?: string) => useAppStore.getState().selectEntity(id as EntityId | undefined),
    goToLessonStep: (lessonId: string, stepIndex: number) => {
      location.hash = `#/learn/${lessonId}/${stepIndex}`;
    },
    reset: () => useAppStore.getState().resetExperience(),
  };
}

declare global {
  interface Window {
    __KUBEMOTION_TEST__?: {
      getAppState: () => Record<string, unknown>;
      getSceneDiagnostics: () => SceneDiagnostics | undefined;
      selectEntity: (id?: string) => void;
      goToLessonStep: (lessonId: string, stepIndex: number) => void;
      reset: () => void;
    };
  }
}
