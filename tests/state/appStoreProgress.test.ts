import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { course, lessonById } from '../../src/content/loader';
import {
  commitProgressMutation,
  orderedAvailableLessons,
  reconcileCompletedLessonIds,
  resolveLessonEntry,
  useAppStore,
} from '../../src/state/appStore';
import { progressStorageKey } from '../../src/state/persistence';

const availableLessons = orderedAvailableLessons(course, lessonById);
const originalLocksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');

function installControlledLocks() {
  const queue: Array<() => Promise<void>> = [];
  const request = (
    _name: string,
    callback: (lock: Lock) => unknown | PromiseLike<unknown>,
  ): Promise<unknown> =>
    new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          resolve(await callback({ name: progressStorageKey, mode: 'exclusive' } as Lock));
        } catch (error) {
          reject(error);
        }
      });
    });
  Object.defineProperty(navigator, 'locks', {
    configurable: true,
    value: { request } as unknown as LockManager,
  });
  return {
    pending: () => queue.length,
    releaseNext: async () => {
      const release = queue.shift();
      if (!release) throw new Error('No queued lock request');
      await release();
      await Promise.resolve();
      await Promise.resolve();
    },
  };
}

describe('app progress state', () => {
  beforeEach(async () => {
    await useAppStore.getState().resetExperience();
    localStorage.clear();
    useAppStore.setState({
      lessonId: undefined,
      stepIndex: 0,
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
    });
  });

  afterEach(() => {
    if (originalLocksDescriptor) {
      Object.defineProperty(navigator, 'locks', originalLocksDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'locks');
    }
    vi.restoreAllMocks();
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

  it('does not resurrect stale completions after another tab resets progress', async () => {
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

    await vi.waitFor(() => expect(useAppStore.getState().completedLessonIds).toEqual([]));
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

  it('reconciles Complete to Next behind a held lock without overwriting the next lesson cursor', async () => {
    const locks = installControlledLocks();
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({
        completedLessonIds: ['container-restart-vs-pod-replacement'],
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 9,
      }),
    );
    useAppStore.setState({
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: [],
    });

    useAppStore.getState().completeLesson('service-routes-to-pods');
    useAppStore.getState().enterLesson('container-restart-vs-pod-replacement', 0);

    expect(locks.pending()).toBe(2);
    expect(useAppStore.getState()).toMatchObject({
      progressSaveStatusByLesson: { 'service-routes-to-pods': 'saving' },
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 0,
    });

    await locks.releaseNext();

    await vi.waitFor(() =>
      expect(useAppStore.getState()).toMatchObject({
        completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
        progressSaveStatusByLesson: { 'service-routes-to-pods': 'saved' },
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 0,
      }),
    );
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
    });

    await locks.releaseNext();
    expect(useAppStore.getState()).toMatchObject({
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 0,
      completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
    });
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 0,
    });
  });

  it('serializes concurrent completion commits against the latest lock-time state', async () => {
    const locks = installControlledLocks();
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ completedLessonIds: [], lessonId: 'service-routes-to-pods', stepIndex: 5 }),
    );
    const serviceCommit = commitProgressMutation((current) => ({
      ...current,
      completedLessonIds: [...new Set([...current.completedLessonIds, 'service-routes-to-pods'])],
    }));
    const podCommit = commitProgressMutation((current) => ({
      ...current,
      completedLessonIds: [
        ...new Set([...current.completedLessonIds, 'container-restart-vs-pod-replacement']),
      ],
    }));

    expect(locks.pending()).toBe(2);
    const writerA = {
      completedLessonIds: [] as string[],
      pendingLessonIds: ['service-routes-to-pods'],
    };
    const writerB = {
      completedLessonIds: [] as string[],
      pendingLessonIds: ['container-restart-vs-pod-replacement'],
    };
    const settleWriter = (writer: typeof writerA, persistedLessonIds: readonly string[]) => {
      writer.pendingLessonIds = writer.pendingLessonIds.filter(
        (lessonId) => !persistedLessonIds.includes(lessonId),
      );
      writer.completedLessonIds = reconcileCompletedLessonIds(
        persistedLessonIds,
        writer.pendingLessonIds,
      );
    };

    await locks.releaseNext();
    const serviceResult = await serviceCommit;
    expect(serviceResult).toMatchObject({
      status: 'saved',
      progress: { completedLessonIds: ['service-routes-to-pods'] },
    });
    if (serviceResult.status !== 'saved') throw serviceResult.error;
    settleWriter(writerA, serviceResult.progress.completedLessonIds);
    settleWriter(writerB, serviceResult.progress.completedLessonIds);
    await locks.releaseNext();
    const podResult = await podCommit;
    expect(podResult).toMatchObject({
      status: 'saved',
      progress: {
        completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
      },
    });
    if (podResult.status !== 'saved') throw podResult.error;
    settleWriter(writerA, podResult.progress.completedLessonIds);
    settleWriter(writerB, podResult.progress.completedLessonIds);
    expect(writerA.completedLessonIds).toEqual([
      'service-routes-to-pods',
      'container-restart-vs-pod-replacement',
    ]);
    expect(writerB.completedLessonIds).toEqual([
      'service-routes-to-pods',
      'container-restart-vs-pod-replacement',
    ]);
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
    });
  });

  it('tracks held same-tab completion feedback independently across A to B to A navigation', async () => {
    const locks = installControlledLocks();
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ completedLessonIds: [], lessonId: 'service-routes-to-pods', stepIndex: 5 }),
    );
    useAppStore.setState({ lessonId: 'service-routes-to-pods', stepIndex: 5 });

    useAppStore.getState().completeLesson('service-routes-to-pods');
    useAppStore.getState().enterLesson('container-restart-vs-pod-replacement', 9);
    useAppStore.getState().completeLesson('container-restart-vs-pod-replacement');
    useAppStore.getState().enterLesson('service-routes-to-pods', 5);

    expect(locks.pending()).toBe(4);
    expect(useAppStore.getState()).toMatchObject({
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      progressSaveStatusByLesson: {
        'service-routes-to-pods': 'saving',
        'container-restart-vs-pod-replacement': 'saving',
      },
    });

    await locks.releaseNext();
    expect(useAppStore.getState().progressSaveStatusByLesson).toMatchObject({
      'service-routes-to-pods': 'saved',
      'container-restart-vs-pod-replacement': 'saving',
    });
    await locks.releaseNext();
    await locks.releaseNext();
    await locks.releaseNext();

    expect(useAppStore.getState()).toMatchObject({
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: ['service-routes-to-pods', 'container-restart-vs-pod-replacement'],
      progressSaveStatusByLesson: {
        'service-routes-to-pods': 'saved',
        'container-restart-vs-pod-replacement': 'saved',
      },
    });
  });

  it('keeps A failed rather than falsely saved while B is the active held completion', async () => {
    const locks = installControlledLocks();
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({ completedLessonIds: [], lessonId: 'service-routes-to-pods', stepIndex: 5 }),
    );
    const originalSetItem = Storage.prototype.setItem;
    let failNextProgressWrite = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === progressStorageKey && failNextProgressWrite) {
        failNextProgressWrite = false;
        throw new DOMException('Storage denied', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });
    useAppStore.getState().completeLesson('service-routes-to-pods');
    useAppStore.getState().completeLesson('container-restart-vs-pod-replacement');

    expect(useAppStore.getState().progressSaveStatusByLesson).toMatchObject({
      'service-routes-to-pods': 'saving',
      'container-restart-vs-pod-replacement': 'saving',
    });
    await locks.releaseNext();
    expect(useAppStore.getState().progressSaveStatusByLesson).toMatchObject({
      'service-routes-to-pods': 'failed',
      'container-restart-vs-pod-replacement': 'saving',
    });

    await locks.releaseNext();
    expect(useAppStore.getState().progressSaveStatusByLesson).toMatchObject({
      'service-routes-to-pods': 'saved',
      'container-restart-vs-pod-replacement': 'saved',
    });
  });

  it('invalidates a queued completion when a later Reset advances the generation', async () => {
    const locks = installControlledLocks();
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({
        completedLessonIds: [],
        lessonId: 'service-routes-to-pods',
        stepIndex: 5,
      }),
    );
    useAppStore.setState({ lessonId: 'service-routes-to-pods', stepIndex: 5 });

    useAppStore.getState().completeLesson('service-routes-to-pods');
    const reset = useAppStore.getState().resetExperience();

    expect(locks.pending()).toBe(2);
    expect(useAppStore.getState()).toMatchObject({
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      lessonId: undefined,
      stepIndex: 0,
    });

    await locks.releaseNext();
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: [],
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
    });
    expect(useAppStore.getState().completedLessonIds).toEqual([]);

    await locks.releaseNext();
    await expect(reset).resolves.toMatchObject({ status: 'saved' });
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: [],
      stepIndex: 0,
    });
    expect(useAppStore.getState()).toMatchObject({
      completedLessonIds: [],
      progressSaveStatusByLesson: {},
      lessonId: undefined,
      stepIndex: 0,
    });
  });

  it('keeps a failed completion intent and retries against the latest stored progress', async () => {
    const originalSetItem = Storage.prototype.setItem;
    let failProgressWrite = true;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === progressStorageKey && failProgressWrite) {
        throw new DOMException('Storage denied', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    });
    useAppStore.setState({
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
      completedLessonIds: [],
    });

    useAppStore.getState().completeLesson('service-routes-to-pods');
    await vi.waitFor(() =>
      expect(useAppStore.getState()).toMatchObject({
        completedLessonIds: ['service-routes-to-pods'],
        progressSaveStatusByLesson: { 'service-routes-to-pods': 'failed' },
      }),
    );

    failProgressWrite = false;
    localStorage.setItem(
      progressStorageKey,
      JSON.stringify({
        completedLessonIds: ['container-restart-vs-pod-replacement'],
        lessonId: 'container-restart-vs-pod-replacement',
        stepIndex: 9,
      }),
    );
    useAppStore.getState().retryProgressSave('service-routes-to-pods');

    expect(useAppStore.getState().progressSaveStatusByLesson['service-routes-to-pods']).toBe(
      'saving',
    );
    await vi.waitFor(() =>
      expect(useAppStore.getState().progressSaveStatusByLesson['service-routes-to-pods']).toBe(
        'saved',
      ),
    );
    expect(useAppStore.getState()).toMatchObject({
      completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
      lessonId: 'service-routes-to-pods',
      stepIndex: 5,
    });
    expect(JSON.parse(localStorage.getItem(progressStorageKey) ?? '{}')).toEqual({
      completedLessonIds: ['container-restart-vs-pod-replacement', 'service-routes-to-pods'],
      lessonId: 'container-restart-vs-pod-replacement',
      stepIndex: 9,
    });
  });
});
