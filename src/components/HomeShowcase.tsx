import {
  ArrowRightLeft,
  BookOpen,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Link } from 'react-router-dom';
import type { Locale } from '../app/types';
import { flowStoryById, lessonById, scenarioById, sources } from '../content/loader';
import { flowStoryEngine } from '../course/FlowStoryEngine';
import type { CompiledFlowStoryBeat, CompiledStep, TransitionCue } from '../course/types';
import { SceneViewport } from './SceneViewport';

interface HomeShowcaseProps {
  readonly locale: Locale;
  readonly reducedMotion: boolean;
}

type ShowcasePresetId = 'overview' | 'request' | 'restart' | 'replace' | 'scale';

interface ShowcasePreset {
  readonly storyId: string;
  readonly startBeat: number;
  readonly endBeat?: number;
}

const presetOrder: readonly ShowcasePresetId[] = [
  'overview',
  'request',
  'restart',
  'replace',
  'scale',
];

const presets: Readonly<Record<ShowcasePresetId, ShowcasePreset>> = {
  overview: {
    storyId: 'manifest-to-running-pod',
    startBeat: 0,
  },
  request: {
    storyId: 'internal-service-request',
    startBeat: 0,
  },
  restart: {
    storyId: 'container-restart-vs-pod-replacement',
    startBeat: 2,
    endBeat: 3,
  },
  replace: {
    storyId: 'container-restart-vs-pod-replacement',
    startBeat: 4,
    endBeat: 9,
  },
  scale: {
    storyId: 'hpa-scale-out',
    startBeat: 0,
  },
};

const showcaseCopy: Readonly<
  Record<
    Locale,
    {
      readonly live: string;
      readonly verified: string;
      readonly story: string;
      readonly scenario: string;
      readonly playground: string;
      readonly beat: (current: number, total: number) => string;
      readonly pause: string;
      readonly play: string;
      readonly next: string;
      readonly replay: string;
      readonly controls: string;
      readonly complete: string;
      readonly hint: string;
      readonly aria: string;
      readonly timeline: string;
      readonly explain: string;
      readonly presets: Readonly<
        Record<ShowcasePresetId, { readonly label: string; readonly caption: string }>
      >;
    }
  >
> = {
  en: {
    live: 'LIVE 3D',
    verified: 'VERIFIED WORLD STATE',
    story: 'Causal sequence',
    scenario: 'Playground',
    playground: 'Kubernetes playground scenarios',
    beat: (current, total) => `Beat ${current} / ${total}`,
    pause: 'Pause sequence',
    play: 'Resume sequence',
    next: 'Advance sequence',
    replay: 'Replay sequence',
    controls: 'Sequence controls',
    complete: 'Sequence complete',
    hint: 'Drag to inspect · choose a scenario · select a beat to take control',
    aria: 'Live 3D Kubernetes demonstration',
    timeline: 'Demonstration beats',
    explain: 'Explain this',
    presets: {
      overview: {
        label: 'Overview',
        caption:
          'Desired state travels through the API, controllers, Scheduler, kubelet, and runtime.',
      },
      request: {
        label: 'Request',
        caption: 'Trace a client request through a stable Service to a Ready backend.',
      },
      restart: {
        label: 'Kill container',
        caption: 'The Container exits, then kubelet restarts it inside the same Pod.',
      },
      replace: {
        label: 'Delete Pod',
        caption:
          'Delete the Pod and watch controller reconciliation create and schedule a replacement.',
      },
      scale: {
        label: 'Scale +',
        caption:
          'Raise desired replicas and watch controllers, Scheduler, kubelet, and traffic catch up.',
      },
    },
  },
  ja: {
    live: 'LIVE 3D',
    verified: '検証済み WORLD STATE',
    story: '因果シーケンス',
    scenario: 'Playground',
    playground: 'Kubernetes Playground シナリオ',
    beat: (current, total) => `Beat ${current} / ${total}`,
    pause: 'シーケンスを一時停止',
    play: 'シーケンスを再開',
    next: '次の Beat へ',
    replay: 'シーケンスを再生し直す',
    controls: 'シーケンス操作',
    complete: 'シーケンス完了',
    hint: 'ドラッグで確認 · シナリオを選択 · Beat を選ぶと手動操作',
    aria: 'Kubernetes のライブ 3D デモ',
    timeline: 'デモの Beat',
    explain: 'この仕組みを学ぶ',
    presets: {
      overview: {
        label: 'Overview',
        caption:
          'desired state が API、controller、Scheduler、kubelet、runtime を通る流れを追います。',
      },
      request: {
        label: 'Request',
        caption: 'クライアント要求が安定した Service から Ready backend へ届く経路を追います。',
      },
      restart: {
        label: 'Kill container',
        caption: 'Container が終了し、同じ Pod の中で kubelet が再起動することを確認します。',
      },
      replace: {
        label: 'Delete Pod',
        caption: 'Pod を削除し、controller が replacement を作成して配置するまでを追います。',
      },
      scale: {
        label: 'Scale +',
        caption:
          'desired replicas を増やし、controller・Scheduler・kubelet・traffic が追従する流れを見ます。',
      },
    },
  },
  'zh-CN': {
    live: 'LIVE 3D',
    verified: '已验证 WORLD STATE',
    story: '因果序列',
    scenario: 'Playground',
    playground: 'Kubernetes Playground 场景',
    beat: (current, total) => `阶段 ${current} / ${total}`,
    pause: '暂停序列',
    play: '继续序列',
    next: '下一阶段',
    replay: '重新播放序列',
    controls: '序列控制',
    complete: '序列播放完成',
    hint: '拖动查看 · 选择场景 · 选择阶段即可接管播放',
    aria: 'Kubernetes 实时 3D 演示',
    timeline: '演示阶段',
    explain: '学习这个机制',
    presets: {
      overview: {
        label: 'Overview',
        caption: '观察期望状态依次经过 API、控制器、Scheduler、kubelet 和运行时。',
      },
      request: {
        label: 'Request',
        caption: '跟踪客户端请求如何经由稳定 Service 到达 Ready 后端。',
      },
      restart: {
        label: 'Kill container',
        caption: 'Container 退出后，由 kubelet 在同一个 Pod 内重启它。',
      },
      replace: {
        label: 'Delete Pod',
        caption: '删除 Pod，观察控制器协调、创建替代 Pod 并重新调度。',
      },
      scale: {
        label: 'Scale +',
        caption: '提高期望副本数，观察控制器、Scheduler、kubelet 与流量逐层追上。',
      },
    },
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
  if (reducedMotion) return 1_200;
  return Math.min(
    3_800,
    Math.max(1_800, ...cues.map((cue) => (cue.delayMs ?? 0) + cue.durationMs + 700)),
  );
}

function PresetIcon({ id }: { readonly id: ShowcasePresetId }) {
  const common = { size: 14, 'aria-hidden': true } as const;
  switch (id) {
    case 'request':
      return <ArrowRightLeft {...common} />;
    case 'restart':
      return <RefreshCcw {...common} />;
    case 'replace':
      return <Trash2 {...common} />;
    case 'scale':
      return <Plus {...common} />;
    default:
      return <Sparkles {...common} />;
  }
}

export function HomeShowcase({ locale, reducedMotion }: HomeShowcaseProps) {
  const [viewportClass, setViewportClass] = useState<'mobile' | 'desktop'>('desktop');
  const [presetId, setPresetId] = useState<ShowcasePresetId>('overview');
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
  const pointerFrameRef = useRef<number | undefined>(undefined);
  const pendingPointerRef = useRef<{ clientX: number; clientY: number } | undefined>(undefined);
  const copy = showcaseCopy[locale];
  const preset = presets[presetId];

  const compiled = useMemo(() => {
    const story = flowStoryById.get(preset.storyId);
    if (!story) throw new Error(`Home showcase story is missing: ${preset.storyId}`);
    return flowStoryEngine.compileStory(
      story,
      { lessons: lessonById, scenarios: scenarioById, sources },
      { viewport: viewportClass },
    );
  }, [preset.storyId, viewportClass]);

  const presetBeats = useMemo(() => {
    const lastBeat = Math.min(
      preset.endBeat ?? compiled.beats.length - 1,
      compiled.beats.length - 1,
    );
    return compiled.beats.slice(preset.startBeat, lastBeat + 1);
  }, [compiled.beats, preset.endBeat, preset.startBeat]);
  const beat = presetBeats[beatIndex] ?? presetBeats[0];
  if (!beat) throw new Error(`Home showcase preset has no beat: ${presetId}`);
  const step = useMemo(() => stepForBeat(beat), [beat]);
  const total = presetBeats.length;
  const compiledBeatIndex = preset.startBeat + beatIndex;
  const playing = !paused && !complete && !reducedMotion && inView && pageVisible;
  const presetCopy = copy.presets[presetId];

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

  useEffect(
    () => () => {
      if (pointerFrameRef.current !== undefined) cancelAnimationFrame(pointerFrameRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => {
        if (beatIndex >= total - 1) {
          setComplete(true);
          setPaused(true);
          return;
        }
        setBeatIndex((current) => current + 1);
        setPlaybackId((current) => current + 1);
      },
      playbackDuration(step.transition.cues, reducedMotion),
    );
    return () => window.clearTimeout(timer);
  }, [beatIndex, playing, reducedMotion, step.transition.cues, total]);

  const selectPreset = (nextPresetId: ShowcasePresetId): void => {
    setPresetId(nextPresetId);
    setBeatIndex(0);
    setPlaybackId((current) => current + 1);
    setPaused(reducedMotion);
    setComplete(false);
  };

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
    if (reducedMotion) {
      const next = Math.min(beatIndex + 1, total - 1);
      setBeatIndex(next);
      setPlaybackId((current) => current + 1);
      setComplete(next === total - 1);
      setPaused(true);
      return;
    }
    setPaused((current) => !current);
  };

  const updateTilt = (event: ReactPointerEvent<HTMLElement>): void => {
    if (reducedMotion || event.pointerType === 'touch') return;
    pendingPointerRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (pointerFrameRef.current !== undefined) return;
    pointerFrameRef.current = requestAnimationFrame(() => {
      pointerFrameRef.current = undefined;
      const frame = frameRef.current;
      const pointer = pendingPointerRef.current;
      if (!frame || !pointer) return;
      const rect = frame.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const x = Math.max(0, Math.min(1, (pointer.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (pointer.clientY - rect.top) / rect.height));
      const offsetX = x - 0.5;
      const offsetY = y - 0.5;
      frame.style.setProperty('--showcase-tilt-x', `${-offsetY * 2.1}deg`);
      frame.style.setProperty('--showcase-tilt-y', `${offsetX * 2.8}deg`);
      frame.style.setProperty('--showcase-light-x', `${x * 100}%`);
      frame.style.setProperty('--showcase-light-y', `${y * 100}%`);
      frame.style.setProperty('--showcase-pointer-x', `${x * 100}%`);
      frame.style.setProperty('--showcase-pointer-y', `${y * 100}%`);
      frame.style.setProperty('--showcase-grid-x', `${offsetX * 5}px`);
      frame.style.setProperty('--showcase-grid-y', `${offsetY * 4}px`);
      frame.style.setProperty('--showcase-scan-x', `${offsetX * -3}px`);
      frame.style.setProperty('--showcase-scan-y', `${offsetY * -2}px`);
      frame.style.setProperty('--showcase-pointer-active', '1');
    });
  };

  const resetTilt = (): void => {
    if (pointerFrameRef.current !== undefined) {
      cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = undefined;
    }
    pendingPointerRef.current = undefined;
    const frame = frameRef.current;
    if (!frame) return;
    frame.style.setProperty('--showcase-tilt-x', '0deg');
    frame.style.setProperty('--showcase-tilt-y', '0deg');
    frame.style.setProperty('--showcase-light-x', '64%');
    frame.style.setProperty('--showcase-light-y', '36%');
    frame.style.setProperty('--showcase-grid-x', '0px');
    frame.style.setProperty('--showcase-grid-y', '0px');
    frame.style.setProperty('--showcase-scan-x', '0px');
    frame.style.setProperty('--showcase-scan-y', '0px');
    frame.style.setProperty('--showcase-pointer-active', '0');
  };

  const controlLabel = complete
    ? copy.replay
    : reducedMotion
      ? copy.next
      : paused
        ? copy.play
        : copy.pause;
  const ControlIcon = complete ? RotateCcw : paused || reducedMotion ? Play : Pause;
  const beatTitle = beat.lessonStep.title[locale];
  const sceneLabel = `${copy.aria}: ${compiled.story.title[locale]}. ${beatTitle}`;

  return (
    <section
      ref={hostRef}
      className="home-showcase"
      aria-label={sceneLabel}
      data-play-state={complete ? 'complete' : playing ? 'playing' : 'paused'}
      data-preset={presetId}
      data-beat-index={beatIndex}
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
              stepKey: `home-showcase:${presetId}:${compiled.story.id}:${beat.beat.id}:${viewportClass}`,
              playbackId,
              transition: step.transition,
            }}
            locale={locale}
            reducedMotion={reducedMotion}
            ambientRouteFlow={inView && pageVisible}
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

        <nav className="showcase-playground" aria-label={copy.playground}>
          {presetOrder.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={id === presetId}
              title={copy.presets[id].caption}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                selectPreset(id);
              }}
            >
              <PresetIcon id={id} />
              <span>{copy.presets[id].label}</span>
            </button>
          ))}
        </nav>

        <div className="showcase-readout" aria-live="off">
          <span>
            {copy.scenario} · {presetCopy.label}
          </span>
          <div className="showcase-readout__title">{compiled.story.title[locale]}</div>
          <p>{beatTitle}</p>
          <em>{presetCopy.caption}</em>
          <small>{complete ? copy.complete : copy.beat(beatIndex + 1, total)}</small>
        </div>

        <div className="showcase-axis" aria-hidden="true">
          <span>DESIRED STATE</span>
          <i />
          <span>RUNNING STATE</span>
        </div>

        <nav className="showcase-timeline" aria-label={copy.timeline}>
          <ol style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
            {presetBeats.map((item, index) => (
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
          <div className="showcase-controls__actions">
            <Link
              className="showcase-learn-link"
              aria-label={copy.explain}
              title={copy.explain}
              to={`/stories/${preset.storyId}/${compiledBeatIndex}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <BookOpen size={15} aria-hidden="true" />
              <span>{copy.explain}</span>
            </Link>
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
          </div>
        </footer>
      </div>
    </section>
  );
}
