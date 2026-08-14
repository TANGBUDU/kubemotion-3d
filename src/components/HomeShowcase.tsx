import { Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Locale } from '../app/types';
import { flowStoryById, lessonById, scenarioById, sources } from '../content/loader';
import { flowStoryEngine } from '../course/FlowStoryEngine';
import type {
  CompiledFlowStoryBeat,
  CompiledStep,
  TransitionCue,
} from '../course/types';
import { SceneViewport } from './SceneViewport';

interface HomeShowcaseProps {
  readonly locale: Locale;
  readonly reducedMotion: boolean;
}

const storyId = 'manifest-to-running-pod';
const authoredStory = flowStoryById.get(storyId);
if (!authoredStory) throw new Error(`Home showcase story is missing: ${storyId}`);

const showcaseCopy: Readonly<
  Record<
    Locale,
    {
      readonly live: string;
      readonly verified: string;
      readonly story: string;
      readonly beat: (current: number, total: number) => string;
      readonly pause: string;
      readonly play: string;
      readonly replay: string;
      readonly controls: string;
      readonly complete: string;
      readonly hint: string;
      readonly aria: string;
      readonly timeline: string;
    }
  >
> = {
  en: {
    live: 'LIVE 3D',
    verified: 'VERIFIED WORLD STATE',
    story: 'Causal sequence',
    beat: (current, total) => `Beat ${current} / ${total}`,
    pause: 'Pause sequence',
    play: 'Resume sequence',
    replay: 'Replay sequence',
    controls: 'Sequence controls',
    complete: 'Sequence complete',
    hint: 'Drag to inspect · select a beat to take control',
    aria: 'Live 3D Kubernetes demonstration',
    timeline: 'Demonstration beats',
  },
  ja: {
    live: 'LIVE 3D',
    verified: '検証済み WORLD STATE',
    story: '因果シーケンス',
    beat: (current, total) => `Beat ${current} / ${total}`,
    pause: 'シーケンスを一時停止',
    play: 'シーケンスを再開',
    replay: 'シーケンスを再生し直す',
    controls: 'シーケンス操作',
    complete: 'シーケンス完了',
    hint: 'ドラッグで確認 · Beat を選ぶと手動操作に切り替わります',
    aria: 'Kubernetes のライブ 3D デモ',
    timeline: 'デモの Beat',
  },
  'zh-CN': {
    live: 'LIVE 3D',
    verified: '已验证 WORLD STATE',
    story: '因果序列',
    beat: (current, total) => `阶段 ${current} / ${total}`,
    pause: '暂停序列',
    play: '继续序列',
    replay: '重新播放序列',
    controls: '序列控制',
    complete: '序列播放完成',
    hint: '拖动查看 · 选择阶段即可接管播放',
    aria: 'Kubernetes 实时 3D 演示',
    timeline: '演示阶段',
  },
};

function transitionForBeat(beat: CompiledFlowStoryBeat): CompiledStep['transition'] {
  const routeIds = new Set(beat.beat.routeIds);
  return {
    cues: beat.compiledStep.transition.cues.filter((cue) => {
      if (!('routeId' in cue)) return true;
      return routeIds.has(cue.routeId);
    }),
  };
}

function stepForBeat(beat: CompiledFlowStoryBeat): CompiledStep {
  return {
    ...beat.compiledStep,
    view: {
      ...beat.compiledStep.view,
      activeRoutes: beat.routes,
    },
    transition: transitionForBeat(beat),
  };
}

function playbackDuration(cues: readonly TransitionCue[], reducedMotion: boolean): number {
  if (reducedMotion) return 1_400;
  return Math.min(
    5_200,
    Math.max(2_650, ...cues.map((cue) => (cue.delayMs ?? 0) + cue.durationMs + 1_050)),
  );
}

export function HomeShowcase({ locale, reducedMotion }: HomeShowcaseProps) {
  const [viewportClass, setViewportClass] = useState<'mobile' | 'desktop'>('desktop');
  const [beatIndex, setBeatIndex] = useState(0);
  const [playbackId, setPlaybackId] = useState(1);
  const [paused, setPaused] = useState(false);
  const [complete, setComplete] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
  );
  const hostRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const previousViewportClass = useRef(viewportClass);
  const copy = showcaseCopy[locale];

  const compiled = useMemo(
    () =>
      flowStoryEngine.compileStory(
        authoredStory,
        { lessons: lessonById, scenarios: scenarioById, sources },
        { viewport: viewportClass },
      ),
    [viewportClass],
  );
  const beat = compiled.beats[beatIndex] ?? compiled.beats[0];
  if (!beat) throw new Error(`Home showcase has no beat: ${storyId}`);
  const step = useMemo(() => stepForBeat(beat), [beat]);
  const total = compiled.beats.length;
  const playing = !paused && !complete && !reducedMotion && inView && pageVisible;

  useEffect(() => {
    if (previousViewportClass.current === viewportClass) return;
    previousViewportClass.current = viewportClass;
    setPlaybackId((current) => current + 1);
  }, [viewportClass]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry?.isIntersecting ?? true),
      { rootMargin: '12% 0px', threshold: 0.08 },
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (beatIndex >= total - 1) {
        setComplete(true);
        setPaused(true);
        return;
      }
      setBeatIndex((current) => current + 1);
      setPlaybackId((current) => current + 1);
    }, playbackDuration(step.transition.cues, reducedMotion));
    return () => window.clearTimeout(timer);
  }, [beatIndex, playing, reducedMotion, step.transition.cues, total]);

  useEffect(() => {
    if (!reducedMotion) return;
    setPaused(true);
  }, [reducedMotion]);

  const chooseBeat = (index: number): void => {
    setBeatIndex(index);
    setPlaybackId((current) => current + 1);
    setPaused(true);
    setComplete(index === total - 1);
  };

  const togglePlayback = (): void => {
    if (complete) {
      setBeatIndex(0);
      setPlaybackId((current) => current + 1);
      setComplete(false);
      setPaused(reducedMotion);
      return;
    }
    setPaused((current) => !current);
  };

  const updateTilt = (event: ReactPointerEvent<HTMLElement>): void => {
    if (reducedMotion || viewportClass === 'mobile') return;
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    frame.style.setProperty('--showcase-tilt-x', `${(0.5 - y) * 2.6}deg`);
    frame.style.setProperty('--showcase-tilt-y', `${(x - 0.5) * 3.4}deg`);
    frame.style.setProperty('--showcase-light-x', `${x * 100}%`);
    frame.style.setProperty('--showcase-light-y', `${y * 100}%`);
  };

  const resetTilt = (): void => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--showcase-tilt-x', '0deg');
    frame.style.setProperty('--showcase-tilt-y', '0deg');
    frame.style.setProperty('--showcase-light-x', '64%');
    frame.style.setProperty('--showcase-light-y', '36%');
  };

  const controlLabel = complete ? copy.replay : paused || reducedMotion ? copy.play : copy.pause;
  const ControlIcon = complete ? RotateCcw : paused || reducedMotion ? Play : Pause;
  const beatTitle = beat.lessonStep.title[locale];
  const sceneLabel = `${copy.aria}: ${compiled.story.title[locale]}. ${beatTitle}`;

  return (
    <section
      ref={hostRef}
      className="home-showcase"
      aria-label={sceneLabel}
      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      onPointerMove={updateTilt}
      onPointerLeave={resetTilt}
      onPointerDown={() => setPaused(true)}
    >
      <div ref={frameRef} className="home-showcase__frame">
        <div className="home-showcase__viewport">
          <SceneViewport
            role="img"
            aria-label={sceneLabel}
            step={step}
            playback={{
              stepKey: `home-showcase:${compiled.story.id}:${beat.beat.id}`,
              playbackId,
              transition: step.transition,
            }}
            locale={locale}
            reducedMotion={reducedMotion}
            cameraMode={viewportClass === 'mobile' ? 'orthographic' : 'perspective'}
            allowPerspective
            onViewportClassChange={setViewportClass}
            onSelectEntity={() => setPaused(true)}
          />
        </div>

        <div className="home-showcase__grid" aria-hidden="true" />
        <div className="home-showcase__scan" aria-hidden="true" />
        <div className="home-showcase__corners" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>

        <header className="showcase-status">
          <span className="showcase-status__pulse" aria-hidden="true" />
          <strong>{copy.live}</strong>
          <span>{copy.verified}</span>
          <i aria-hidden="true">WEBGL / {step.view.view.toUpperCase()}</i>
        </header>

        <div className="showcase-readout" aria-live="off">
          <span>
            {copy.story} · {compiled.story.priority}
          </span>
          <h2>{compiled.story.title[locale]}</h2>
          <p>{beatTitle}</p>
          <small>{complete ? copy.complete : copy.beat(beatIndex + 1, total)}</small>
        </div>

        <div className="showcase-axis" aria-hidden="true">
          <span>DESIRED STATE</span>
          <i />
          <span>RUNNING STATE</span>
        </div>

        <nav className="showcase-timeline" aria-label={copy.timeline}>
          <ol>
            {compiled.beats.map((item, index) => (
              <li key={item.beat.id}>
                <button
                  type="button"
                  aria-label={`${copy.beat(index + 1, total)}: ${item.lessonStep.title[locale]}`}
                  aria-current={index === beatIndex ? 'step' : undefined}
                  title={item.lessonStep.title[locale]}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    chooseBeat(index);
                  }}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <i aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <footer className="showcase-controls">
          <span>
            <Sparkles size={14} aria-hidden="true" />
            {copy.hint}
          </span>
          <button
            type="button"
            aria-label={controlLabel}
            title={copy.controls}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              togglePlayback();
            }}
          >
            <ControlIcon size={16} aria-hidden="true" />
            <span>{controlLabel}</span>
          </button>
        </footer>
      </div>
    </section>
  );
}
