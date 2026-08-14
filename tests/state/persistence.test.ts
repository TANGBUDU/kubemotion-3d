import { describe, expect, it } from 'vitest';
import {
  loadPreferences,
  loadProgress,
  localeFromNavigator,
  readProgress,
  savePreferences,
  saveProgress,
} from '../../src/state/persistence';

describe('persistence helpers', () => {
  it('still exposes browser-language classification for explicit locale tools', () => {
    expect(localeFromNavigator('ja-JP')).toBe('ja');
    expect(localeFromNavigator('zh-Hant')).toBe('zh-CN');
    expect(localeFromNavigator('fr-FR')).toBe('en');
  });

  it('uses English for a new public visitor regardless of browser language', () => {
    const empty = { getItem: () => null };
    expect(loadPreferences(empty)).toMatchObject({
      locale: 'en',
      orientationSeen: false,
    });
  });

  it('recovers from invalid storage in English', () => {
    const broken = { getItem: () => '{broken' };
    expect(loadPreferences(broken)).toMatchObject({
      locale: 'en',
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

  it('migrates inferred legacy locales to English but preserves an explicit language choice', () => {
    const legacyChinese = {
      getItem: () =>
        JSON.stringify({
          locale: 'zh-CN',
          courseNavCollapsed: true,
          inspectorCollapsed: false,
          orientationSeen: true,
        }),
    };
    expect(loadPreferences(legacyChinese)).toEqual({
      locale: 'en',
      courseNavCollapsed: true,
      inspectorCollapsed: false,
      orientationSeen: true,
    });

    const explicitJapanese = {
      getItem: () =>
        JSON.stringify({
          locale: 'ja',
          localeExplicit: true,
          courseNavCollapsed: false,
          inspectorCollapsed: true,
          orientationSeen: true,
        }),
    };
    expect(loadPreferences(explicitJapanese)).toEqual({
      locale: 'ja',
      courseNavCollapsed: false,
      inspectorCollapsed: true,
      orientationSeen: true,
    });
  });

  it('marks every newly saved locale as explicit', () => {
    let saved = '';
    savePreferences(
      {
        locale: 'zh-CN',
        courseNavCollapsed: false,
        inspectorCollapsed: true,
        orientationSeen: true,
      },
      { setItem: (_key, value) => (saved = value) },
    );
    expect(JSON.parse(saved)).toMatchObject({ locale: 'zh-CN', localeExplicit: true });
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
