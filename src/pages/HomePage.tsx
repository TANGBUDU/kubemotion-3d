import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { compiledFlowStories, course, lessonById, scenarioById } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { orderedAvailableLessons, resolveLessonEntry, useAppStore } from '../state/appStore';
import '../styles/home.css';

const availableLessons = orderedAvailableLessons(course, lessonById);

const homeCopy: Record<
  Locale,
  {
    eyebrow: string;
    headlineLead: string;
    headlineEmphasis: string;
    description: string;
    orientationLabel: string;
    orientationTime: string;
    orientationTitle: string;
    orientationIntro: string;
    orientationPoints: readonly [string, string, string];
    startLesson: string;
    continueLesson: string;
    exploreCompleted: string;
    revisitOrientation: string;
    continueHome: string;
    lessonPreviewLabel: string;
    showcasePreviewLabel: string;
    lessonSceneCaption: string;
    showcaseSceneCaption: string;
    benefitsLabel: string;
    benefitDescriptions: readonly [string, string, string];
    flowEyebrow: string;
    flowTitle: string;
    flowDescription: string;
    openFlow: string;
    beatCount: (count: number) => string;
  }
> = {
  en: {
    eyebrow: 'WORLD STATE · VERIFIED TIMELINE · INTERACTIVE 3D',
    headlineLead: 'Why Kubernetes?',
    headlineEmphasis: 'Start with the problem, not the jargon.',
    description:
      'A container can run one app by itself. Kubernetes becomes useful when you need several copies, automatic recovery, placement, networking, and safe change. This course shows the problem first, then the Kubernetes concept that solves it.',
    orientationLabel: 'Quick orientation',
    orientationTime: '20–30 seconds',
    orientationTitle: 'Three things to know before lesson 1',
    orientationIntro: 'You do not need to memorize components yet. Start with these three ideas.',
    orientationPoints: [
      'One app can run without Kubernetes.',
      'Kubernetes keeps a declared result true over time.',
      'Every highlighted line has one job: request, control, scheduling, or local runtime.',
    ],
    startLesson: 'Start lesson',
    continueLesson: 'Continue learning',
    exploreCompleted: 'Explore completed lessons',
    revisitOrientation: 'View orientation again',
    continueHome: 'Continue without review',
    lessonPreviewLabel: 'Interactive lesson preview',
    showcasePreviewLabel: 'Showcase preview',
    lessonSceneCaption: 'Current lesson',
    showcaseSceneCaption: 'Showcase',
    benefitsLabel: 'KubeMotion benefits',
    benefitDescriptions: [
      'See why each Kubernetes object exists before you are asked to remember its name.',
      'Each step highlights one cause and one effect; background relationships stay quiet.',
      'Begin with plain-language evidence, then open the raw Kubernetes fields only when you want them.',
    ],
    flowEyebrow: '8 verified flow stories',
    flowTitle: 'Trace complete Kubernetes causes, not isolated animations',
    flowDescription:
      'Each story reuses ordered lesson state and keeps its evidence routes visible before and after tokens move.',
    openFlow: 'Open story',
    beatCount: (count) => `${count} beats`,
  },
  ja: {
    eyebrow: 'WORLD STATE · 検証済みタイムライン · インタラクティブ 3D',
    headlineLead: 'なぜ Kubernetes？',
    headlineEmphasis: '用語ではなく、問題から学ぶ。',
    description:
      '1つのアプリならコンテナだけでも動かせます。複数コピー、自動復旧、配置、ネットワーク、安全な変更が必要になったとき Kubernetes が役立ちます。このコースは、先に問題を見せ、その後で解決する Kubernetes の概念を紹介します。',
    orientationLabel: 'クイックガイド',
    orientationTime: '20〜30 秒',
    orientationTitle: '第1課の前に知る 3 つのこと',
    orientationIntro: 'まだコンポーネント名を暗記する必要はありません。まずこの3点だけ押さえます。',
    orientationPoints: [
      'アプリを1つ動かすだけなら Kubernetes は不要な場合があります。',
      'Kubernetes は宣言した結果を時間が経っても保ち続けます。',
      '強調された線は、通信・制御・配置・Node 内処理のどれか1つの意味だけを持ちます。',
    ],
    startLesson: 'レッスンを始める',
    continueLesson: '学習を続ける',
    exploreCompleted: '完了したレッスンを探索する',
    revisitOrientation: 'ガイドをもう一度見る',
    continueHome: '確認せずに続ける',
    lessonPreviewLabel: 'インタラクティブなレッスンプレビュー',
    showcasePreviewLabel: 'ショーケースプレビュー',
    lessonSceneCaption: '現在のレッスン',
    showcaseSceneCaption: 'ショーケース',
    benefitsLabel: 'KubeMotion の特長',
    benefitDescriptions: [
      '名前を覚える前に、それぞれの Kubernetes オブジェクトがなぜ必要なのかを理解します。',
      '各ステップは1つの原因と1つの結果を強調し、背景の関係線は控えめにします。',
      'まず平易な Evidence を読み、必要なときだけ生の Kubernetes フィールドを開けます。',
    ],
    flowEyebrow: '検証済みフローストーリー 8 本',
    flowTitle: '孤立したアニメーションではなく、Kubernetes の因果を追う',
    flowDescription:
      '各 story は順序付き lesson state を再利用し、token の移動前後も証拠 route を表示し続けます。',
    openFlow: 'Story を開く',
    beatCount: (count) => `${count} ステップ`,
  },
  'zh-CN': {
    eyebrow: 'WORLD STATE · 已验证时间线 · 交互式 3D',
    headlineLead: '为什么需要 Kubernetes？',
    headlineEmphasis: '先讲问题，再讲名词。',
    description:
      '一个应用，用容器自己就能跑。真正需要 Kubernetes，是当你开始面对多副本、自动恢复、放置、网络和安全变更。本课程先把问题讲清楚，再介绍解决它的 Kubernetes 概念。',
    orientationLabel: '快速导览',
    orientationTime: '20–30 秒',
    orientationTitle: '第一课前只记住这三件事',
    orientationIntro: '先不要背组件名。只要带着这三个问题进入第一课。',
    orientationPoints: [
      '只运行一个应用时，未必需要 Kubernetes。',
      'Kubernetes 的价值是让你声明的结果长期自动成立。',
      '每条高亮线只表达一种动作：请求、控制、调度或 Node 内执行。',
    ],
    startLesson: '开始课程',
    continueLesson: '继续学习',
    exploreCompleted: '探索已完成课程',
    revisitOrientation: '再次查看导览',
    continueHome: '跳过回顾并继续',
    lessonPreviewLabel: '交互式课程预览',
    showcasePreviewLabel: '展示预览',
    lessonSceneCaption: '当前课程',
    showcaseSceneCaption: '展示',
    benefitsLabel: 'KubeMotion 的优势',
    benefitDescriptions: [
      '先理解每个 Kubernetes 对象为什么存在，再记它叫什么。',
      '每一步只突出一个原因和一个结果，背景关系线主动降噪。',
      '默认读人话证据；只有想深挖时才展开原始 Kubernetes 字段。',
    ],
    flowEyebrow: '8 条已验证的流程故事',
    flowTitle: '追踪完整因果，而不是观看孤立动画',
    flowDescription: '每条故事都复用按顺序编译的课程状态，并让证据路线在动画前后持续可见。',
    openFlow: '打开故事',
    beatCount: (count) => `${count} 个步骤`,
  },
};

export function HomePage() {
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const orientationSeen = useAppStore((state) => state.orientationSeen);
  const savedLessonId = useAppStore((state) => state.lessonId);
  const savedStepIndex = useAppStore((state) => state.stepIndex);
  const completedLessonIds = useAppStore((state) => state.completedLessonIds);
  const setOrientationSeen = useAppStore((state) => state.setOrientationSeen);
  const [orientationOpen, setOrientationOpen] = useState(() => !orientationSeen);
  const [sceneViewportClass, setSceneViewportClass] = useState<'mobile' | 'desktop'>('desktop');
  const revisitButtonRef = useRef<HTMLButtonElement>(null);
  const orientationHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<'orientation' | 'revisit' | null>(null);
  const t = ui(locale);
  const copy = homeCopy[locale];
  const entry = resolveLessonEntry(availableLessons, {
    lessonId: savedLessonId,
    stepIndex: savedStepIndex,
    completedLessonIds,
  });
  const previewLessonId = entry?.lessonId ?? 'container-restart-vs-pod-replacement';
  const previewLesson = lessonById.get(previewLessonId);
  const previewScenario = previewLesson ? scenarioById.get(previewLesson.scenarioId) : undefined;
  const step = useMemo(
    () =>
      previewLesson && previewScenario
        ? courseEngine.compileLesson(previewLesson, previewScenario, {
            viewport: sceneViewportClass,
          }).steps[0]
        : undefined,
    [previewLesson, previewScenario, sceneViewportClass],
  );

  useEffect(() => {
    if (pendingFocus.current === 'orientation' && orientationOpen) {
      orientationHeadingRef.current?.focus();
      pendingFocus.current = null;
    }
    if (pendingFocus.current === 'revisit' && !orientationOpen) {
      revisitButtonRef.current?.focus();
      pendingFocus.current = null;
    }
  }, [orientationOpen]);

  if (!previewLesson) throw new Error(`Preview lesson is missing: ${previewLessonId}`);
  if (!previewScenario) {
    throw new Error(`Preview scenario is missing: ${previewLesson.scenarioId}`);
  }
  if (availableLessons.length === 0) throw new Error('No verified lesson is available');
  if (!step) return null;

  const hasValidProgress = Boolean(
    entry &&
    savedLessonId &&
    entry.lessonId === savedLessonId &&
    entry.stepIndex === savedStepIndex,
  );
  const lessonPath = entry ? `/learn/${entry.lessonId}/${entry.stepIndex}` : '/explore';
  const lessonAction = entry
    ? hasValidProgress
      ? copy.continueLesson
      : copy.startLesson
    : copy.exploreCompleted;
  const localizedPreviewTitle = previewLesson.title[locale];
  const previewLabel = `${entry ? copy.lessonPreviewLabel : copy.showcasePreviewLabel}: ${localizedPreviewTitle}`;
  const sceneCaption = `${entry ? copy.lessonSceneCaption : copy.showcaseSceneCaption} · ${localizedPreviewTitle}`;

  const rememberOrientation = () => setOrientationSeen(true);
  const closeOrientation = () => {
    pendingFocus.current = 'revisit';
    setOrientationOpen(false);
  };
  const openOrientation = () => {
    pendingFocus.current = 'orientation';
    setOrientationOpen(true);
  };

  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">{copy.eyebrow}</div>
          <h1>
            {copy.headlineLead}
            <br />
            <span>{copy.headlineEmphasis}</span>
          </h1>
          <p>{copy.description}</p>

          {orientationOpen ? (
            <section
              className="orientation-card"
              aria-labelledby="orientation-title"
              data-testid="orientation-card"
            >
              <div className="orientation-card-heading">
                <span>{copy.orientationLabel}</span>
                <span className="orientation-time">{copy.orientationTime}</span>
              </div>
              <h2 id="orientation-title" ref={orientationHeadingRef} tabIndex={-1}>
                {copy.orientationTitle}
              </h2>
              <p>{copy.orientationIntro}</p>
              <ol className="orientation-points">
                {copy.orientationPoints.map((point, index) => (
                  <li key={point}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <strong>{point}</strong>
                  </li>
                ))}
              </ol>
              <div className="orientation-actions">
                <Link
                  className="button primary orientation-start"
                  to={lessonPath}
                  onClick={rememberOrientation}
                >
                  {lessonAction}
                  <ArrowRight size={18} aria-hidden="true" />
                </Link>
                {orientationSeen ? (
                  <button type="button" className="orientation-continue" onClick={closeOrientation}>
                    {copy.continueHome}
                  </button>
                ) : null}
              </div>
            </section>
          ) : (
            <div className="home-entry-actions">
              <Link className="button primary" to={lessonPath}>
                {lessonAction}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <button
                ref={revisitButtonRef}
                type="button"
                className="orientation-revisit"
                onClick={openOrientation}
              >
                {copy.revisitOrientation}
              </button>
            </div>
          )}

          <div className="trust-row">
            <ShieldCheck size={17} aria-hidden="true" />
            {t.noAccess}
            <span aria-hidden="true">·</span>
            {t.private}
          </div>
        </div>
        <div className="hero-scene">
          <SceneViewport
            role="img"
            aria-label={previewLabel}
            step={step}
            playback={{
              stepKey: `home-preview:${previewLesson.id}:0`,
              playbackId: 0,
              transition: { cues: [] },
            }}
            locale={locale}
            reducedMotion={reducedMotion}
            onViewportClassChange={setSceneViewportClass}
            onSelectEntity={() => undefined}
          />
          <div className="scene-caption">
            <span className="live-dot" />
            {sceneCaption}
          </div>
        </div>
      </section>
      <section className="value-grid" aria-label={copy.benefitsLabel}>
        <article>
          <Boxes aria-hidden="true" />
          <h2>{t.relationships}</h2>
          <p>{copy.benefitDescriptions[0]}</p>
        </article>
        <article>
          <GitBranch aria-hidden="true" />
          <h2>{t.flows}</h2>
          <p>{copy.benefitDescriptions[1]}</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <h2>{t.sources}</h2>
          <p>{copy.benefitDescriptions[2]}</p>
        </article>
      </section>
      <section className="flow-story-catalog" id="flow-stories" aria-labelledby="flow-story-title">
        <header>
          <span>{copy.flowEyebrow}</span>
          <h2 id="flow-story-title">{copy.flowTitle}</h2>
          <p>{copy.flowDescription}</p>
        </header>
        <div className="flow-story-grid">
          {compiledFlowStories.map(({ story, beats }) => {
            const firstBeat = beats[0];
            if (!firstBeat) throw new Error(`Flow story ${story.id} has no compiled beat`);
            return (
              <article key={story.id} data-flow-story-id={story.id}>
                <div className="flow-story-meta">
                  <span data-priority={story.priority}>{story.priority}</span>
                  <span>{copy.beatCount(beats.length)}</span>
                </div>
                <h3>{story.title[locale]}</h3>
                <p>{story.summary[locale]}</p>
                <Link to={`/stories/${story.id}/0`}>
                  {copy.openFlow}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
