import { describe, expect, it } from 'vitest';
import { loadPreferences, loadProgress, localeFromNavigator } from '../../src/state/persistence';

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
});
