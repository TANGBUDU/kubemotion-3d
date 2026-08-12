import { describe, expect, it } from 'vitest';
import {
  loadPreferences,
  loadProgress,
  localeFromNavigator,
  readProgress,
  saveProgress,
} from '../../src/state/persistence';

describe('persistence helpers', () => {
  it('selects a locale from the browser language', () => {
    expect(localeFromNavigator('ja-JP')).toBe('ja');
    expect(localeFromNavigator('zh-Hant')).toBe('zh-CN');
    expect(localeFromNavigator('fr-FR')).toBe('en');
  });

  it('recovers from invalid storage', () => {
    const broken = { getItem: () => '{broken' };
    expect(loadPreferences(broken)).toMatchObject({
      locale: expect.stringMatching(/en|ja|zh-CN/),
      orientationSeen: false,
    });
    expect(loadProgress(broken)).toEqual({ completedLessonIds: [], stepIndex: 0 });
  });

  it('keeps tolerant reads separate from transaction reads that surface storage errors', () => {
    const error = new DOMException('Storage denied', 'SecurityError');
    const denied = {
      getItem: () => {
        throw error;
      },
    };

    expect(loadProgress(denied)).toEqual({ completedLessonIds: [], stepIndex: 0 });
    expect(() => readProgress(denied)).toThrow(error);
  });

  it('migrates old preferences and persists the orientation flag', () => {
    const oldPreferences = {
      getItem: () =>
        JSON.stringify({ locale: 'en', courseNavCollapsed: true, inspectorCollapsed: false }),
    };
    expect(loadPreferences(oldPreferences)).toEqual({
      locale: 'en',
      courseNavCollapsed: true,
      inspectorCollapsed: false,
      orientationSeen: false,
    });

    const seenPreferences = {
      getItem: () =>
        JSON.stringify({
          locale: 'zh-CN',
          courseNavCollapsed: false,
          inspectorCollapsed: true,
          orientationSeen: true,
        }),
    };
    expect(loadPreferences(seenPreferences).orientationSeen).toBe(true);
  });

  it('deduplicates completed lessons when progress is loaded and saved', () => {
    const duplicateProgress = {
      getItem: () =>
        JSON.stringify({
          completedLessonIds: ['service-routes-to-pods', 'service-routes-to-pods'],
          lessonId: 'service-routes-to-pods',
          stepIndex: 2,
        }),
    };
    expect(loadProgress(duplicateProgress).completedLessonIds).toEqual(['service-routes-to-pods']);

    let saved = '';
    const normalized = saveProgress(
      {
        completedLessonIds: [
          'service-routes-to-pods',
          'container-restart-vs-pod-replacement',
          'service-routes-to-pods',
        ],
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 9,
      },
      { setItem: (_key, value) => (saved = value) },
    );
    expect(JSON.parse(saved)).toEqual({
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
    });
    expect(normalized).toEqual(JSON.parse(saved));
  });
});
