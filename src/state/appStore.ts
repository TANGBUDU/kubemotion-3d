import { create } from 'zustand';
import type { Locale } from '../app/types';
import type { CourseManifest, LessonV2, ViewMode } from '../course/types';
import type { EntityId, EntityStatus } from '../world/types';
import {
  type Progress,
  loadPreferences,
  loadProgress,
  progressFromStorageValue,
  progressStorageKey,
  savePreferences,
  saveProgress,
} from './persistence';

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
  completedLessonIds: string[];
  view: ViewMode;
  selectedEntityId?: EntityId | undefined;
  hoveredEntityId?: EntityId | undefined;
  courseNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  orientationSeen: boolean;
  reducedMotion: boolean;
  filters: ExploreFilters;
  transitionGeneration: number;
  setLocale: (locale: Locale) => void;
  enterLesson: (lessonId: string, stepIndex?: number) => void;
  setLessonStep: (stepIndex: number) => void;
  completeLesson: (lessonId: string) => void;
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
  setOrientationSeen: (value: boolean) => void;
}

export interface LessonEntry {
  readonly lessonId: string;
  readonly stepIndex: number;
}

export interface LessonProgressCursor {
  readonly lessonId?: string | undefined;
  readonly stepIndex: number;
  readonly completedLessonIds?: readonly string[] | undefined;
}

export function orderedAvailableLessons(
  manifest: CourseManifest,
  lessonsById: ReadonlyMap<string, LessonV2>,
): readonly LessonV2[] {
  const availableIds = new Set(
    manifest.lessons.filter((lesson) => lesson.status === 'available').map((lesson) => lesson.id),
  );
  return manifest.lessonOrder.flatMap((lessonId) => {
    const lesson = lessonsById.get(lessonId);
    return lesson && availableIds.has(lessonId) ? [lesson] : [];
  });
}

export function resolveLessonEntry(
  lessons: readonly LessonV2[],
  progress: LessonProgressCursor,
): LessonEntry | undefined {
  const completedLessonIds = new Set(progress.completedLessonIds ?? []);
  const fallback = lessons.find((lesson) => !completedLessonIds.has(lesson.id));
  if (!fallback) return undefined;
  const savedLesson = progress.lessonId
    ? lessons.find(
        (lesson) => lesson.id === progress.lessonId && !completedLessonIds.has(lesson.id),
      )
    : undefined;
  if (!savedLesson) {
    return { lessonId: fallback.id, stepIndex: 0 };
  }
  if (
    !Number.isInteger(progress.stepIndex) ||
    progress.stepIndex < 0 ||
    progress.stepIndex >= savedLesson.steps.length
  ) {
    return { lessonId: savedLesson.id, stepIndex: 0 };
  }
  return { lessonId: savedLesson.id, stepIndex: progress.stepIndex };
}

const preferences = loadPreferences();
const progress = loadProgress();
const emptyFilters: ExploreFilters = { query: '', kind: '', namespace: '', status: '' };

function persistProgressMutation(mutate: (current: Progress) => Progress): void {
  const write = () => saveProgress(mutate(loadProgress()));
  if (typeof navigator !== 'undefined' && navigator.locks) {
    void navigator.locks.request(progressStorageKey, write).catch(() => undefined);
    return;
  }
  write();
}

export const useAppStore = create<AppState>((set, get) => ({
  locale: preferences.locale,
  mode: 'home',
  scenarioId: 'container-restart-golden',
  lessonId: progress.lessonId,
  stepIndex: progress.stepIndex,
  completedLessonIds: progress.completedLessonIds,
  view: 'overview',
  courseNavCollapsed: preferences.courseNavCollapsed,
  inspectorCollapsed: preferences.inspectorCollapsed,
  orientationSeen: preferences.orientationSeen,
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  filters: emptyFilters,
  transitionGeneration: 0,
  setLocale: (locale) => {
    set({ locale });
    savePreferences({
      locale,
      courseNavCollapsed: get().courseNavCollapsed,
      inspectorCollapsed: get().inspectorCollapsed,
      orientationSeen: get().orientationSeen,
    });
  },
  enterLesson: (lessonId, stepIndex = 0) => {
    const completedLessonIds = loadProgress().completedLessonIds;
    set((state) => ({
      mode: 'learn',
      lessonId,
      stepIndex,
      completedLessonIds,
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      filters: emptyFilters,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    persistProgressMutation((current) => ({
      completedLessonIds: current.completedLessonIds,
      lessonId,
      stepIndex,
    }));
  },
  setLessonStep: (stepIndex) => {
    const completedLessonIds = loadProgress().completedLessonIds;
    set((state) => ({
      stepIndex,
      completedLessonIds,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    const lessonId = get().lessonId;
    persistProgressMutation((current) => ({
      completedLessonIds: current.completedLessonIds,
      ...(lessonId ? { lessonId } : {}),
      stepIndex,
    }));
  },
  completeLesson: (lessonId) => {
    const persistedLessonIds = loadProgress().completedLessonIds;
    const completedLessonIds = [...new Set([...persistedLessonIds, lessonId])];
    set({ completedLessonIds });
    const currentLessonId = get().lessonId;
    const currentStepIndex = get().stepIndex;
    persistProgressMutation((current) => ({
      completedLessonIds: [...new Set([...current.completedLessonIds, lessonId])],
      ...(currentLessonId ? { lessonId: currentLessonId } : {}),
      stepIndex: currentStepIndex,
    }));
  },
  enterExplore: () =>
    set((state) => ({
      mode: 'explore',
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
  resetExperience: () => {
    set((state) => ({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
      view: 'overview',
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      filters: emptyFilters,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    persistProgressMutation(() => ({ completedLessonIds: [], stepIndex: 0 }));
  },
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setCourseNavCollapsed: (courseNavCollapsed) => {
    set({ courseNavCollapsed });
    savePreferences({
      locale: get().locale,
      courseNavCollapsed,
      inspectorCollapsed: get().inspectorCollapsed,
      orientationSeen: get().orientationSeen,
    });
  },
  setInspectorCollapsed: (inspectorCollapsed) => {
    set({ inspectorCollapsed });
    savePreferences({
      locale: get().locale,
      courseNavCollapsed: get().courseNavCollapsed,
      inspectorCollapsed,
      orientationSeen: get().orientationSeen,
    });
  },
  setOrientationSeen: (orientationSeen) => {
    set({ orientationSeen });
    savePreferences({
      locale: get().locale,
      courseNavCollapsed: get().courseNavCollapsed,
      inspectorCollapsed: get().inspectorCollapsed,
      orientationSeen,
    });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== progressStorageKey) return;
    if (event.storageArea && event.storageArea !== window.localStorage) return;
    if (window.localStorage.getItem(progressStorageKey) !== event.newValue) return;
    const externalProgress = progressFromStorageValue(event.key === null ? null : event.newValue);
    const isExternalReset =
      externalProgress.completedLessonIds.length === 0 &&
      !externalProgress.lessonId &&
      externalProgress.stepIndex === 0;
    if (isExternalReset) {
      useAppStore.setState((state) => ({
        lessonId: undefined,
        stepIndex: 0,
        completedLessonIds: [],
        view: 'overview',
        selectedEntityId: undefined,
        hoveredEntityId: undefined,
        filters: emptyFilters,
        transitionGeneration: state.transitionGeneration + 1,
      }));
      return;
    }
    useAppStore.setState({ completedLessonIds: externalProgress.completedLessonIds });
  });
}
