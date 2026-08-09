import type { SceneDiagnostics } from '../renderer/SceneController';
import type { Position } from '../renderer/LayoutEngine';
import { useAppStore } from '../state/appStore';
import type { EntityId } from '../world/types';

let diagnosticsProvider: (() => SceneDiagnostics) | undefined;
let layoutPositionsProvider: (() => Readonly<Record<EntityId, Position>>) | undefined;

export interface SceneControllerLifecycleDiagnostics {
  readonly created: number;
  readonly destroyed: number;
  readonly active: number;
  readonly destroyedWithActiveListeners: number;
}

const controllerLifecycle = {
  created: 0,
  destroyed: 0,
  active: 0,
  destroyedWithActiveListeners: 0,
};

export function recordSceneControllerCreated(): (eventListenersAfterDestroy: number) => void {
  controllerLifecycle.created += 1;
  controllerLifecycle.active += 1;
  let destroyed = false;

  return (eventListenersAfterDestroy: number): void => {
    if (destroyed) return;
    destroyed = true;
    controllerLifecycle.destroyed += 1;
    controllerLifecycle.active -= 1;
    if (eventListenersAfterDestroy !== 0) {
      controllerLifecycle.destroyedWithActiveListeners += 1;
    }
  };
}

export function getSceneControllerLifecycle(): SceneControllerLifecycleDiagnostics {
  return { ...controllerLifecycle };
}

export function setDiagnosticsProvider(
  provider?: (() => SceneDiagnostics) | undefined,
  positionsProvider?: (() => Readonly<Record<EntityId, Position>>) | undefined,
): void {
  diagnosticsProvider = provider;
  layoutPositionsProvider = positionsProvider;
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
        completedLessonIds: state.completedLessonIds,
        progressSaveStatusByLesson: state.progressSaveStatusByLesson,
        view: state.view,
        selectedEntityId: state.selectedEntityId,
      };
    },
    getSceneDiagnostics: () => diagnosticsProvider?.(),
    getSceneLayoutPositions: () => layoutPositionsProvider?.(),
    getSceneControllerLifecycle,
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
      getSceneLayoutPositions: () => Readonly<Record<EntityId, Position>> | undefined;
      getSceneControllerLifecycle: () => SceneControllerLifecycleDiagnostics;
      selectEntity: (id?: string) => void;
      goToLessonStep: (lessonId: string, stepIndex: number) => void;
      reset: () => void;
    };
  }
}
