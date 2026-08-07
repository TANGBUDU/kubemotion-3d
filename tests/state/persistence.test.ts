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
    expect(loadPreferences(broken).locale).toMatch(/en|ja|zh-CN/);
    expect(loadProgress(broken)).toEqual({ completedLessonIds: [], stepIndex: 0 });
  });
});
