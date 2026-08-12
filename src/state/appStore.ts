import { create } from 'zustand';
import type { Locale } from '../app/types';
import type { CourseManifest, LessonV2, ViewMode } from '../course/types';
import type { EntityId, EntityStatus, LocalizedText } from '../world/types';
import {
  type Progress,
  loadPreferences,
  loadProgress,
  progressFromStorageValue,
  progressStorageKey,
  readProgress,
  savePreferences,
  saveProgress,
} from './persistence';

export interface ExploreFilters {
  query: string;
  kind: string;
  namespace: string;
  status: EntityStatus | '';
}
export type ProgressSaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export interface ProgressSaveMetadata {
  readonly title: LocalizedText;
  readonly completionStepIndex: number;
}

export interface AppState {
  locale: Locale;
  mode: 'home' | 'learn' | 'explore' | 'about';
  scenarioId: string;
  lessonId?: string | undefined;
  stepIndex: number;
  completedLessonIds: string[];
  progressSaveStatusByLesson: Readonly<Record<string, ProgressSaveStatus>>;
  progressSaveMetadataByLesson: Readonly<Record<string, ProgressSaveMetadata>>;
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
  completeLesson: (lessonId: string, metadata?: ProgressSaveMetadata) => void;
  retryProgressSave: (lessonId: string) => void;
  enterExplore: () => void;
  setView: (view: ViewMode) => void;
  selectEntity: (id?: EntityId) => void;
  hoverEntity: (id?: EntityId) => void;
  setFilters: (patch: Partial<ExploreFilters>) => void;
  clearTransientState: () => void;
  resetExperience: () => Promise<ProgressCommitResult>;
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

type ProgressMutation = (current: Progress) => Progress;

export type ProgressCommitResult =
  | { readonly status: 'saved'; readonly progress: Progress }
  | { readonly status: 'failed'; readonly error: unknown };

interface RetryableProgressMutation {
  readonly generation: number;
  readonly lessonId: string;
  readonly mutate: ProgressMutation;
  readonly pendingLessonIds: readonly string[];
}

interface PersistProgressOptions {
  readonly feedbackLessonId?: string | undefined;
  readonly pendingLessonIds?: readonly string[] | undefined;
}

let progressGeneration = 0;
let progressOperationId = 0;
const activeFeedbackOperationIds = new Map<string, number>();
const retryableProgressMutations = new Map<string, RetryableProgressMutation>();
const pendingCompletionLessonIds = new Set<string>();

function uniqueCompletedLessonIds(...groups: readonly (readonly string[])[]): string[] {
  return [...new Set(groups.flat())];
}

export function reconcileCompletedLessonIds(
  persistedLessonIds: readonly string[],
  pendingLessonIds: readonly string[],
): string[] {
  return uniqueCompletedLessonIds(persistedLessonIds, pendingLessonIds);
}

function applySavedProgress(progress: Progress): void {
  const persistedLessonIds = new Set(progress.completedLessonIds);
  const confirmedPendingIds = [...pendingCompletionLessonIds].filter((lessonId) =>
    persistedLessonIds.has(lessonId),
  );
  for (const lessonId of confirmedPendingIds) {
    pendingCompletionLessonIds.delete(lessonId);
    retryableProgressMutations.delete(lessonId);
  }
  useAppStore.setState((state) => {
    const progressSaveStatusByLesson = { ...state.progressSaveStatusByLesson };
    for (const lessonId of confirmedPendingIds) {
      progressSaveStatusByLesson[lessonId] = 'saved';
    }
    return {
      completedLessonIds: reconcileCompletedLessonIds(progress.completedLessonIds, [
        ...pendingCompletionLessonIds,
      ]),
      progressSaveStatusByLesson,
    };
  });
}

function handleProgressMutationFailure(
  operationId: number,
  mutation: RetryableProgressMutation | undefined,
): void {
  if (
    !mutation ||
    mutation.generation !== progressGeneration ||
    operationId !== activeFeedbackOperationIds.get(mutation.lessonId)
  ) {
    return;
  }
  retryableProgressMutations.set(mutation.lessonId, mutation);
  useAppStore.setState((state) => ({
    progressSaveStatusByLesson: {
      ...state.progressSaveStatusByLesson,
      [mutation.lessonId]: 'failed',
    },
  }));
}

export function commitProgressMutation(
  mutate: ProgressMutation,
  generation = progressGeneration,
): Promise<ProgressCommitResult> {
  const write = (): Progress => {
    const current = readProgress();
    if (generation !== progressGeneration) return current;
    return saveProgress(mutate(current));
  };

  try {
    const request =
      typeof navigator !== 'undefined' && navigator.locks
        ? navigator.locks.request(progressStorageKey, write)
        : Promise.resolve(write());
    return request.then(
      (savedProgress): ProgressCommitResult => ({ status: 'saved', progress: savedProgress }),
      (error: unknown): ProgressCommitResult => ({ status: 'failed', error }),
    );
  } catch (error) {
    return Promise.resolve({ status: 'failed', error });
  }
}

function persistProgressMutation(
  mutate: ProgressMutation,
  options: PersistProgressOptions = {},
): Promise<ProgressCommitResult> {
  const generation = progressGeneration;
  const operationId = ++progressOperationId;
  const pendingLessonIds = [...(options.pendingLessonIds ?? [])];
  const retryableMutation = options.feedbackLessonId
    ? {
        generation,
        lessonId: options.feedbackLessonId,
        mutate,
        pendingLessonIds,
      }
    : undefined;

  if (options.feedbackLessonId) {
    activeFeedbackOperationIds.set(options.feedbackLessonId, operationId);
    retryableProgressMutations.delete(options.feedbackLessonId);
    useAppStore.setState((state) => ({
      progressSaveStatusByLesson: {
        ...state.progressSaveStatusByLesson,
        [options.feedbackLessonId as string]: 'saving',
      },
    }));
  }

  const commit = commitProgressMutation(mutate, generation);
  void commit.then((result) => {
    if (result.status === 'saved') {
      if (generation !== progressGeneration) return;
      applySavedProgress(result.progress);
      return;
    }
    handleProgressMutationFailure(operationId, retryableMutation);
  });
  return commit;
}

export const useAppStore = create<AppState>((set, get) => ({
  locale: preferences.locale,
  mode: 'home',
  scenarioId: 'container-restart-golden',
  lessonId: progress.lessonId,
  stepIndex: progress.stepIndex,
  completedLessonIds: progress.completedLessonIds,
  progressSaveStatusByLesson: {},
  progressSaveMetadataByLesson: {},
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
    set((state) => ({
      mode: 'learn',
      lessonId,
      stepIndex,
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
    set((state) => ({
      stepIndex,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    const lessonId = get().lessonId;
    persistProgressMutation((current) => ({
      completedLessonIds: current.completedLessonIds,
      ...(lessonId ? { lessonId } : {}),
      stepIndex,
    }));
  },
  completeLesson: (lessonId, metadata) => {
    const persistedLessonIds = loadProgress().completedLessonIds;
    pendingCompletionLessonIds.add(lessonId);
    const completedLessonIds = uniqueCompletedLessonIds(
      persistedLessonIds,
      get().completedLessonIds,
      [...pendingCompletionLessonIds],
    );
    set((state) => ({
      completedLessonIds,
      progressSaveMetadataByLesson: metadata
        ? { ...state.progressSaveMetadataByLesson, [lessonId]: metadata }
        : state.progressSaveMetadataByLesson,
    }));
    const intendedLessonIds = [...pendingCompletionLessonIds];
    persistProgressMutation(
      (current) => ({
        ...current,
        completedLessonIds: uniqueCompletedLessonIds(current.completedLessonIds, intendedLessonIds),
      }),
      {
        feedbackLessonId: lessonId,
        pendingLessonIds: intendedLessonIds,
      },
    );
  },
  retryProgressSave: (lessonId) => {
    const retry = retryableProgressMutations.get(lessonId);
    if (!retry || retry.generation !== progressGeneration) return;
    persistProgressMutation(retry.mutate, {
      feedbackLessonId: retry.lessonId,
      pendingLessonIds: retry.pendingLessonIds,
    });
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
    progressGeneration += 1;
    activeFeedbackOperationIds.clear();
    retryableProgressMutations.clear();
    pendingCompletionLessonIds.clear();
    set((state) => ({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      progressSaveMetadataByLesson: {},
      view: 'overview',
      selectedEntityId: undefined,
      hoveredEntityId: undefined,
      filters: emptyFilters,
      transitionGeneration: state.transitionGeneration + 1,
    }));
    return persistProgressMutation(() => ({ completedLessonIds: [], stepIndex: 0 }));
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
      progressGeneration += 1;
      activeFeedbackOperationIds.clear();
      retryableProgressMutations.clear();
      pendingCompletionLessonIds.clear();
      useAppStore.setState((state) => ({
        lessonId: undefined,
        stepIndex: 0,
        completedLessonIds: [],
        progressSaveStatusByLesson: {},
        progressSaveMetadataByLesson: {},
        view: 'overview',
        selectedEntityId: undefined,
        hoveredEntityId: undefined,
        filters: emptyFilters,
        transitionGeneration: state.transitionGeneration + 1,
      }));
      return;
    }
    applySavedProgress(externalProgress);
  });
}
