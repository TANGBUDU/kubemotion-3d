import type { Locale } from '../app/types';

export interface Preferences {
  locale: Locale;
  courseNavCollapsed: boolean;
  inspectorCollapsed: boolean;
}
export interface Progress {
  completedLessonIds: string[];
  lessonId?: string | undefined;
  stepIndex: number;
}

const preferencesKey = 'kubemotion:v1:preferences';
const progressKey = 'kubemotion:v1:progress';

export function localeFromNavigator(language: string): Locale {
  if (language.toLowerCase().startsWith('ja')) return 'ja';
  if (language.toLowerCase().startsWith('zh')) return 'zh-CN';
  return 'en';
}

export function loadPreferences(storage: Pick<Storage, 'getItem'> = localStorage): Preferences {
  const fallback: Preferences = {
    locale: localeFromNavigator(navigator.language),
    courseNavCollapsed: false,
    inspectorCollapsed: false,
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
      locale,
      courseNavCollapsed: record.courseNavCollapsed === true,
      inspectorCollapsed: record.inspectorCollapsed === true,
    };
  } catch {
    return fallback;
  }
}

export function savePreferences(
  preferences: Preferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(preferencesKey, JSON.stringify(preferences));
}

export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): Progress {
  try {
    const raw = storage.getItem(progressKey);
    if (!raw) return { completedLessonIds: [], stepIndex: 0 };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return { completedLessonIds: [], stepIndex: 0 };
    const record = value as Record<string, unknown>;
    return {
      completedLessonIds: Array.isArray(record.completedLessonIds)
        ? record.completedLessonIds.filter((id): id is string => typeof id === 'string')
        : [],
      ...(typeof record.lessonId === 'string' ? { lessonId: record.lessonId } : {}),
      stepIndex:
        typeof record.stepIndex === 'number' && record.stepIndex >= 0 ? record.stepIndex : 0,
    };
  } catch {
    return { completedLessonIds: [], stepIndex: 0 };
  }
}

export function saveProgress(
  progress: Progress,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(progressKey, JSON.stringify(progress));
}
