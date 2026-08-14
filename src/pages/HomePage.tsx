import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import type { Locale } from '../app/types';
import { HomeShowcase } from '../components/HomeShowcase';
import { compiledFlowStories, course, lessonById } from '../content/loader';
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
    benefitsLabel: string;
    benefitDescriptions: readonly [string, string, string];
    flowEyebrow: string;
    flowTitle: string;
    flowDescription: string;
    openFlow: string;
    beatCount: (count: number) => string;
    lessonsMetric: string;
    storiesMetric: string;
    languagesMetric: string;
  }
> = {
  en: {
    eyebrow: 'LIVE WORLD STATE · VERIFIED CAUSALITY · INTERACTIVE 3D',
    headlineLead: 'Watch desired state',
    headlineEmphasis: 'become reality.',
    description:
      'KubeMotion turns Kubernetes API changes, reconciliation, scheduling, networking, and local runtime work into verified 3D causal stories. See the system move first; learn each responsibility at your own pace.',
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
    lessonsMetric: 'verified lessons',
    storiesMetric: 'causal stories',
    languagesMetric: 'languages',
  },
  ja: {
    eyebrow: 'LIVE WORLD STATE · 検証済み因果 · インタラクティブ 3D',
    headlineLead: 'desired state が',
    headlineEmphasis: '現実になる瞬間を見る。',
    description:
      'KubeMotion は Kubernetes API の変更、reconciliation、scheduling、networking、Node 内の runtime 処理を、検証済みの 3D 因果ストーリーとして可視化します。まず動きを見て、その後に各責務を自分のペースで学べます。',
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
    lessonsMetric: '検証済みレッスン',
    storiesMetric: '因果ストーリー',
    languagesMetric: '対応言語',
  },
  'zh-CN': {
    eyebrow: 'LIVE WORLD STATE · 已验证因果 · 交互式 3D',
    headlineLead: '看期望状态',
    headlineEmphasis: '如何变成现实。',
    description:
      'KubeMotion 把 Kubernetes API 变更、协调、调度、网络与 Node 内运行时处理，呈现为经过验证的 3D 因果故事。先看系统真正动起来，再按自己的节奏理解每一层职责。',
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
    lessonsMetric: '已验证课程',
    storiesMetric: '因果故事',
    languagesMetric: '语言',
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

  if (availableLessons.length === 0) throw new Error('No verified lesson is available');

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

          <dl className="hero-proof" aria-label="KubeMotion course scope">
            <div>
              <dd>14</dd>
              <dt>{copy.lessonsMetric}</dt>
            </div>
            <div>
              <dd>8</dd>
              <dt>{copy.storiesMetric}</dt>
            </div>
            <div>
              <dd>3</dd>
              <dt>{copy.languagesMetric}</dt>
            </div>
          </dl>

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

        <HomeShowcase locale={locale} reducedMotion={reducedMotion} />
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
          {compiledFlowStories.map(({ story, beats }, index) => {
            const firstBeat = beats[0];
            if (!firstBeat) throw new Error(`Flow story ${story.id} has no compiled beat`);
            return (
              <article
                key={story.id}
                data-flow-story-id={story.id}
                style={{ '--story-index': index + 1 } as CSSProperties}
              >
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
