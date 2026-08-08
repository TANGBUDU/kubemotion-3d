import { beforeEach, describe, expect, it } from 'vitest';
import { course, lessonById } from '../../src/content/loader';
import { orderedAvailableLessons, resolveLessonEntry, useAppStore } from '../../src/state/appStore';
import { progressStorageKey } from '../../src/state/persistence';

const availableLessons = orderedAvailableLessons(course, lessonById);

describe('app progress state', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
    });
  });

  it('preserves completed lessons while navigating and deduplicates completion', () => {
    useAppStore.getState().enterLesson('service-routes-to-pods', 5);
    useAppStore.getState().completeLesson('service-routes-to-pods');
    useAppStore.getState().enterLesson('container-restart-vs-pod-replacement', 3);
    useAppStore.getState().setLessonStep(4);
    useAppStore.getState().completeLesson('container-restart-vs-pod-replacement');
    useAppStore.getState().completeLesson('container-restart-vs-pod-replacement');

    expect(useAppStore.getState().completedLessonIds).toEqual([
      'service-routes-to-pods',
      'container-restart-vs-pod-replacement',
    ]);
    expect(JSON.parse(localStorage.getItem('kubemotion:v1:progress') ?? '{}')).toEqual({
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 4,
    });
  });

  it.each([-1, 999, 1.5])(
    'keeps a valid unfinished saved lesson and normalizes invalid step %s to zero',
    (stepIndex) => {
      expect(
        resolveLessonEntry(availableLessons, {
          lessonId: 'container-restart-vs-pod-replacement',
          stepIndex,
          completedLessonIds: ['service-routes-to-pods'],
        }),
      ).toEqual({
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 0,
      });
    },
  );

  it('clears in-memory and persisted completions when the experience is reset', () => {
    useAppStore.getState().enterLesson('service-routes-to-pods', 5);
    useAppStore.getState().completeLesson('service-routes-to-pods');
    useAppStore.getState().enterLesson('container-restart-vs-pod-replacement', 9);
    useAppStore.getState().completeLesson('container-restart-vs-pod-replacement');

    useAppStore.getState().resetExperience();

    expect(useAppStore.getState()).toMatchObject({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
    });
    expect(JSON.parse(localStorage.getItem('kubemotion:v1:progress') ?? '{}')).toEqual({
      completedLessonIds: [],
      stepIndex: 0,
    });
  });

  it('synchronizes external completions without replacing this tab cursor', () => {
    useAppStore.setState({
      lessonId: 'service-routes-to-pods',
      stepIndex: 2,
      completedLessonIds: [],
    });
    const externalProgress = JSON.stringify({
      completedLessonIds: ['container-restart-vs-pod-replacement'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
    });
    localStorage.setItem(progressStorageKey, externalProgress);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: progressStorageKey,
        newValue: externalProgress,
        storageArea: localStorage,
      }),
    );

    expect(useAppStore.getState()).toMatchObject({
      lessonId: 'service-routes-to-pods',
      stepIndex: 2,
      completedLessonIds: ['container-restart-vs-pod-replacement'],
    });

    useAppStore.getState().setLessonStep(3);
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: ['container-restart-vs-pod-replacement'],
      lessonId: 'service-routes-to-pods',
      stepIndex: 3,
    });
  });

  it('does not resurrect stale completions after another tab resets progress', () => {
    useAppStore.setState({
      lessonId: 'service-routes-to-pods',
      stepIndex: 2,
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
    });
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ completedLessonIds: [], stepIndex: 0 }),
    );

    useAppStore.getState().setLessonStep(3);

    expect(useAppStore.getState().completedLessonIds).toEqual([]);
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: [],
      lessonId: 'service-routes-to-pods',
      stepIndex: 3,
    });
  });

  it('applies an external reset to the full in-memory progress cursor', () => {
    useAppStore.setState({
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
      completedLessonIds: ['service-routes-to-pods'],
      view: 'traffic',
      selectedEntityId: 'api-object:namespaced:shop:Pod:api-a-old',
      filters: { query: 'api', kind: 'Pod', namespace: 'shop', status: 'ready' },
    });
    const externalReset = JSON.stringify({ completedLessonIds: [], stepIndex: 0 });
    localStorage.setItem(progressStorageKey, externalReset);

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: progressStorageKey,
        newValue: externalReset,
        storageArea: localStorage,
      }),
    );

    expect(useAppStore.getState()).toMatchObject({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
      view: 'overview',
      selectedEntityId: undefined,
      filters: { query: '', kind: '', namespace: '', status: '' },
    });
  });

  it('ignores an out-of-order storage event whose value is no longer current', () => {
    const staleProgress = JSON.stringify({
      completedLessonIds: ['service-routes-to-pods'],
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
    });
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ completedLessonIds: [], stepIndex: 0 }),
    );

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: progressStorageKey,
        newValue: staleProgress,
        storageArea: localStorage,
      }),
    );

    expect(useAppStore.getState().completedLessonIds).toEqual([]);
  });
});
