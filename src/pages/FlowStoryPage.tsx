import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Route,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Locale } from '../app/types';
import { viewPresentation } from '../app/entityPresentation';
import { SceneViewport } from '../components/SceneViewport';
import { flowStoryById, lessonById, scenarioById, sources } from '../content/loader';
import { flowStoryEngine } from '../course/FlowStoryEngine';
import type {
  CompiledFlowStoryBeat,
  CompiledStep,
  PlaybackRequest,
  TransitionCue,
} from '../course/types';
import { useAppStore } from '../state/appStore';
import { EvidencePanel } from '../ui/lesson/EvidencePanel';
import '../styles/flow-stories.css';

const copy: Readonly<
  Record<
    Locale,
    {
      readonly back: string;
      readonly beat: (current: number, total: number) => string;
      readonly whatChanged: string;
      readonly why: string;
      readonly takeaway: string;
      readonly route: string;
      readonly replay: string;
      readonly play: string;
      readonly pause: string;
      readonly restart: string;
      readonly previous: string;
      readonly next: string;
      readonly fullLesson: string;
      readonly verified: string;
      readonly sources: string;
      readonly missing: string;
    }
  >
> = {
  en: {
    back: 'All stories',
    beat: (current, total) => `Beat ${current} of ${total}`,
    whatChanged: 'What changed',
    why: 'Why it happened',
    takeaway: 'Takeaway',
    route: 'Active path',
    replay: 'Replay beat',
    play: 'Play story',
    pause: 'Pause',
    restart: 'Restart story',
    previous: 'Previous',
    next: 'Next',
    fullLesson: 'Open full lesson',
    verified: 'Verified',
    sources: 'Official sources',
    missing: 'This flow story is unavailable.',
  },
  ja: {
    back: 'Story 一覧',
    beat: (current, total) => `Beat ${current} / ${total}`,
    whatChanged: '何が変わったか',
    why: 'なぜ起きたか',
    takeaway: '要点',
    route: '現在の経路',
    replay: 'Beat を再生',
    play: 'Story を再生',
    pause: '一時停止',
    restart: 'Story を最初から',
    previous: '前へ',
    next: '次へ',
    fullLesson: '完全なレッスンを開く',
    verified: '検証済み',
    sources: '公式ソース',
    missing: 'この Flow Story は利用できません。',
  },
  'zh-CN': {
    back: '全部故事',
    beat: (current, total) => `阶段 ${current} / ${total}`,
    whatChanged: '发生了什么变化',
    why: '为什么会发生',
    takeaway: '记住这一点',
    route: '当前路径',
    replay: '重播本阶段',
    play: '播放整条故事',
    pause: '暂停',
    restart: '从头播放',
    previous: '上一步',
    next: '下一步',
    fullLesson: '打开完整课程',
    verified: '已验证',
    sources: '官方来源',
    missing: '这条 Flow Story 当前不可用。',
  },
};

function transitionForBeat(beat: CompiledFlowStoryBeat): CompiledStep['transition'] {
  const routeIds = new Set(beat.beat.routeIds);
  const cues = beat.compiledStep.transition.cues.filter((cue) => {
    if (!('routeId' in cue)) return true;
    return routeIds.has(cue.routeId);
  });
  return { cues };
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
  if (reducedMotion) return 900;
  return Math.max(1050, ...cues.map((cue) => (cue.delayMs ?? 0) + cue.durationMs + 420));
}

function routeSummary(beat: CompiledFlowStoryBeat): string | undefined {
  const route = beat.selectedRoute ?? beat.routes[0];
  if (!route) return undefined;
  const ids = [route.hops[0]?.fromEntityId, ...route.hops.map((hop) => hop.toEntityId)].filter(
    (id): id is string => Boolean(id),
  );
  return ids
    .map((id) => beat.compiledStep.world.entities[id]?.name ?? id.split(':').at(-1) ?? id)
    .join(' → ');
}

export function FlowStoryPage() {
  const { storyId = '', beatIndex: beatIndexParam } = useParams();
  const navigate = useNavigate();
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const [viewportClass, setViewportClass] = useState<'mobile' | 'desktop'>('desktop');
  const [playbackId, setPlaybackId] = useState(0);
  const [playing, setPlaying] = useState(false);
  const authoredStory = flowStoryById.get(storyId);
  const t = copy[locale];

  const compiled = useMemo(() => {
    if (!authoredStory) return undefined;
    return flowStoryEngine.compileStory(
      authoredStory,
      { lessons: lessonById, scenarios: scenarioById, sources },
      { viewport: viewportClass },
    );
  }, [authoredStory, viewportClass]);

  const parsedIndex = Number(beatIndexParam ?? 0);
  const beatIndex =
    compiled &&
    Number.isInteger(parsedIndex) &&
    parsedIndex >= 0 &&
    parsedIndex < compiled.beats.length
      ? parsedIndex
      : 0;
  const beat = compiled?.beats[beatIndex];
  const step = useMemo(() => (beat ? stepForBeat(beat) : undefined), [beat]);
  const route = beat ? routeSummary(beat) : undefined;

  const go = useCallback(
    (index: number, replay = true) => {
      if (!compiled) return;
      const next = Math.max(0, Math.min(index, compiled.beats.length - 1));
      navigate(`/stories/${compiled.story.id}/${next}`);
      if (replay) setPlaybackId((value) => value + 1);
    },
    [compiled, navigate],
  );

  useEffect(() => {
    if (!playing || !compiled || !step) return undefined;
    const timeout = window.setTimeout(
      () => {
        if (beatIndex >= compiled.beats.length - 1) {
          setPlaying(false);
          return;
        }
        go(beatIndex + 1);
      },
      playbackDuration(step.transition.cues, reducedMotion),
    );
    return () => window.clearTimeout(timeout);
  }, [beatIndex, compiled, go, playbackId, playing, reducedMotion, step]);

  if (!compiled || !beat || !step) {
    return (
      <main className="flow-story-missing">
        <p>{t.missing}</p>
        <Link to="/stories">{t.back}</Link>
      </main>
    );
  }

  const playback: PlaybackRequest = {
    stepKey: `story:${compiled.story.id}:${beat.beat.id}`,
    playbackId,
    transition: step.transition,
  };
  const sourceEntries = compiled.story.sourceIds.flatMap((id) => {
    const source = sources.get(id);
    return source ? [source] : [];
  });

  return (
    <main className="flow-story-player" data-testid="flow-story-player">
      <header className="flow-story-player-header">
        <div className="flow-story-player-heading">
          <Link to="/stories" className="flow-story-back">
            <ArrowLeft size={15} aria-hidden="true" />
            {t.back}
          </Link>
          <div className="flow-story-kicker">
            <span data-priority={compiled.story.priority}>{compiled.story.priority}</span>
            <span>
              <ShieldCheck size={13} aria-hidden="true" /> {t.verified}
            </span>
            <span>{t.beat(beatIndex + 1, compiled.beats.length)}</span>
          </div>
          <h1>{compiled.story.title[locale]}</h1>
          <p>{compiled.story.summary[locale]}</p>
        </div>
        <div className="flow-story-header-actions">
          <button
            type="button"
            onClick={() => {
              go(0);
              setPlaying(true);
            }}
          >
            <RotateCcw size={15} aria-hidden="true" />
            {t.restart}
          </button>
          <button type="button" className="primary" onClick={() => setPlaying((value) => !value)}>
            {playing ? (
              <Pause size={15} aria-hidden="true" />
            ) : (
              <Play size={15} aria-hidden="true" />
            )}
            {playing ? t.pause : t.play}
          </button>
        </div>
      </header>

      <div className="flow-story-workspace">
        <section className="flow-story-stage" aria-label={beat.lessonStep.title[locale]}>
          <div className="flow-story-stage-meta">
            <span>{viewPresentation(step.view.view, locale).title}</span>
            {route ? (
              <strong>
                <Route size={13} aria-hidden="true" /> {route}
              </strong>
            ) : null}
          </div>
          <SceneViewport
            role="img"
            aria-label={`${compiled.story.title[locale]} · ${beat.lessonStep.title[locale]}`}
            step={step}
            playback={playback}
            locale={locale}
            reducedMotion={reducedMotion}
            safeInsets={{ top: 18, right: 18, bottom: 18, left: 18 }}
            onViewportClassChange={setViewportClass}
            onSelectEntity={() => undefined}
          />
        </section>

        <aside className="flow-story-teaching">
          <div className="flow-story-beat-heading">
            <span>{t.beat(beatIndex + 1, compiled.beats.length)}</span>
            <h2 data-testid="story-beat-heading">{beat.lessonStep.title[locale]}</h2>
          </div>
          <section>
            <h3>{t.whatChanged}</h3>
            <p>{beat.lessonStep.teaching.whatChanged[locale]}</p>
          </section>
          <section>
            <h3>{t.why}</h3>
            <p>{beat.lessonStep.teaching.whyItHappened[locale]}</p>
          </section>
          <EvidencePanel rows={step.evidence} locale={locale} compact />
          <section className="flow-story-takeaway">
            <h3>{t.takeaway}</h3>
            <p>{beat.lessonStep.teaching.takeaway[locale]}</p>
          </section>
          <div className="flow-story-support-links">
            <span>{t.sources}</span>
            <div>
              {sourceEntries.slice(0, 3).map((source) => (
                <a key={source.id} href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
              ))}
            </div>
          </div>
          <Link
            className="flow-story-full-lesson"
            to={`/learn/${compiled.story.lessonId}/${beat.compiledStep.index}`}
          >
            <BookOpen size={15} aria-hidden="true" />
            {t.fullLesson}
          </Link>
        </aside>
      </div>

      <footer className="flow-story-controls">
        <button type="button" onClick={() => go(beatIndex - 1)} disabled={beatIndex === 0}>
          <ChevronLeft size={17} aria-hidden="true" />
          {t.previous}
        </button>
        <div
          className="flow-story-beat-timeline"
          aria-label={t.beat(beatIndex + 1, compiled.beats.length)}
        >
          {compiled.beats.map((candidate, index) => (
            <button
              type="button"
              key={candidate.beat.id}
              className={index === beatIndex ? 'active' : undefined}
              aria-current={index === beatIndex ? 'step' : undefined}
              aria-label={`${index + 1}. ${candidate.lessonStep.title[locale]}`}
              onClick={() => {
                setPlaying(false);
                go(index);
              }}
            >
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setPlaybackId((value) => value + 1)}>
          <RotateCcw size={15} aria-hidden="true" />
          {t.replay}
        </button>
        <button
          type="button"
          onClick={() => go(beatIndex + 1)}
          disabled={beatIndex === compiled.beats.length - 1}
        >
          {t.next}
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </footer>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {t.beat(beatIndex + 1, compiled.beats.length)}. {beat.lessonStep.title[locale]}.
      </p>
    </main>
  );
}
