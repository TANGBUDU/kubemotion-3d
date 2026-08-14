import type { Locale } from '../app/types';

export interface Preferences {
  locale: Locale;
  courseNavCollapsed: boolean;
  inspectorCollapsed: boolean;
  orientationSeen: boolean;
}
export interface Progress {
  completedLessonIds: string[];
  lessonId?: string | undefined;
  stepIndex: number;
}

const preferencesKey = 'kubemotion:v1:preferences';
export const progressStorageKey = 'kubemotion:v1:progress';

function uniqueLessonIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.filter(
        (lessonId): lessonId is string => typeof lessonId === 'string' && lessonId.length > 0,
      ),
    ),
  ];
}

export function normalizeProgress(progress: Progress): Progress {
  return {
    completedLessonIds: uniqueLessonIds(progress.completedLessonIds),
    ...(progress.lessonId ? { lessonId: progress.lessonId } : {}),
    stepIndex:
      Number.isInteger(progress.stepIndex) && progress.stepIndex >= 0 ? progress.stepIndex : 0,
  };
}

export function localeFromNavigator(language: string): Locale {
  if (language.toLowerCase().startsWith('ja')) return 'ja';
  if (language.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function loadPreferences(storage: Pick<Storage, 'getItem'> = localStorage): Preferences {
  const fallback: Preferences = {
    locale: 'en',
    courseNavCollapsed: false,
    inspectorCollapsed: false,
    orientationSeen: false,
  };
  try {
    const raw = storage.getItem(preferencesKey);
    if (!raw) return fallback;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return fallback;
    const record = value as Record<string, unknown>;
    const locale = record.locale;
    if (locale !== 'en' && locale !== 'ja' && locale !== 'zh-CN') return fallback;
    return {
      // Older builds inferred locale from the browser. Treat that legacy value as non-explicit so
      // the public landing page migrates to English once. Every later manual choice is persisted
      // with localeExplicit=true by savePreferences().
      locale: record.localeExplicit === true ? locale : 'en',
      courseNavCollapsed: record.courseNavCollapsed === true,
      inspectorCollapsed: record.inspectorCollapsed === true,
      orientationSeen: record.orientationSeen === true,
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(preferencesKey, JSON.stringify({ ...preferences, localeExplicit: true }));
}

export function progressFromStorageValue(raw: string | null): Progress {
  try {
    if (!raw) return { completedLessonIds: [], stepIndex: 0 };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { completedLessonIds: [], stepIndex: 0 };
    const record = value as Record<string, unknown>;
    return {
      completedLessonIds: uniqueLessonIds(record.completedLessonIds),
      ...(typeof record.lessonId === 'string' ? { lessonId: record.lessonId } : {}),
      stepIndex:
        typeof record.stepIndex === 'number' &&
        Number.isInteger(record.stepIndex) &&
        record.stepIndex >= 0
          ? record.stepIndex
          : 0,
    };
  } catch {
    return { completedLessonIds: [], stepIndex: 0 };
  }
}

export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  try {
    return readProgress(storage);
  } catch {
    return { completedLessonIds: [], stepIndex: 0 };
  }
}

/**
 * Reads progress without hiding storage failures. Mutating transactions use this
 * variant so a denied or exhausted storage backend can surface a retryable error.
 */
export function readProgress(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  return progressFromStorageValue(storage.getItem(progressStorageKey));
}

export function saveProgress(
  progress: Progress,
  storage: Pick<Storage, 'setItem'> = localStorage,
): Progress {
  const normalized = normalizeProgress(progress);
  storage.setItem(progressStorageKey, JSON.stringify(normalized));
  return normalized;
}
