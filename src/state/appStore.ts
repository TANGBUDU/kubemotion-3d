import { create } from 'zustand';
import type { Locale } from '../app/types';
import type { ViewMode } from '../course/types';
import type { EntityId, EntityStatus } from '../world/types';
import { loadPreferences, loadProgress, savePreferences, saveProgress } from './persistence';

export interface ExploreFilters {
  query: string;
  kind: string;
  namespace: string;
  status: EntityStatus | '';
}
export interface AppState {
  locale: Locale;
  mode: 'home' | 'learn' | 'explore' | 'about';
  scenarioId: string;
  lessonId?: string | undefined;
  stepIndex: number;
  view: ViewMode;
  selectedEntityId?: EntityId | undefined;
  hoveredEntityId?: EntityId | undefined;
  courseNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  reducedMotion: boolean;
  filters: ExploreFilters;
  transitionGeneration: number;
  setLocale: (locale: Locale) => void;
  enterLesson: (lessonId: string, stepIndex?: number) => void;
  setLessonStep: (stepIndex: number) => void;
  enterExplore: () => void;
  setView: (view: ViewMode) => void;
  selectEntity: (id?: EntityId) => void;
  hoverEntity: (id?: EntityId) => void;
  setFilters: (patch: Partial<ExploreFilters>) => void;
  clearTransientState: () => void;
  resetExperience: () => void;
  setReducedMotion: (value: boolean) => void;
  setCourseNavCollapsed: (value: boolean) => void;
  setInspectorCollapsed: (value: boolean) => void;
}

const preferences = loadPreferences();
const progress = loadProgress();
const emptyFilters: ExploreFilters = { query: '', kind: '', namespace: '', status: '' };

export const useAppStore = create<AppState>((set, get) => ({
  locale: preferences.locale,
  mode: 'home',
  scenarioId: 'container-restart-golden',
  lessonId: progress.lessonId,
  stepIndex: progress.stepIndex,
  view: 'overview',
  courseNavCollapsed: preferences.courseNavCollapsed,
  inspectorCollapsed: preferences.inspectorCollapsed,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  filters: emptyFilters,
  transitionGeneration: 0,
  setLocale: (locale) => {
    set({ locale });
    savePreferences({
      locale,
      courseNavCollapsed: get().courseNavCollapsed,
      inspectorCollapsed: get().inspectorCollapsed,
    });
  },
  enterLesson: (lessonId, stepIndex = 0) => {
    set((state) => ({
      mode: 'learn',
      lessonId,
      stepIndex,
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      filters: emptyFilters,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    saveProgress({ completedLessonIds: [], lessonId, stepIndex });
  },
  setLessonStep: (stepIndex) => {
    set((state) => ({ stepIndex, transitionGeneration: state.transitionGeneration + 1 }));
    saveProgress({
      completedLessonIds: [],
      ...(get().lessonId ? { lessonId: get().lessonId } : {}),
      stepIndex,
    });
  },
  enterExplore: () =>
    set((state) => ({
      mode: 'explore',
      lessonId: undefined,
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      transitionGeneration: state.transitionGeneration + 1,
    })),
  setView: (view) =>
    set((state) => ({ view, transitionGeneration: state.transitionGeneration + 1 })),
  selectEntity: (selectedEntityId) => set({ selectedEntityId }),
  hoverEntity: (hoveredEntityId) => set({ hoveredEntityId }),
  setFilters: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
  clearTransientState: () => set({ selectedEntityId: undefined, hoveredEntityId: undefined }),
  resetExperience: () =>
    set((state) => ({
      lessonId: undefined,
      stepIndex: 0,
      view: 'overview',
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      filters: emptyFilters,
      transitionGeneration: state.transitionGeneration + 1,
    })),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCourseNavCollapsed: (courseNavCollapsed) => {
    set({ courseNavCollapsed });
    savePreferences({
      locale: get().locale,
      courseNavCollapsed,
      inspectorCollapsed: get().inspectorCollapsed,
    });
  },
  setInspectorCollapsed: (inspectorCollapsed) => {
    set({ inspectorCollapsed });
    savePreferences({
      locale: get().locale,
      courseNavCollapsed: get().courseNavCollapsed,
      inspectorCollapsed,
    });
  },
}));
