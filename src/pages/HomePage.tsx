import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { course, lessonById, scenario } from '../content/loader';
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
    previewLabel: string;
    sceneCaption: string;
    benefitsLabel: string;
    benefitDescriptions: readonly [string, string, string];
  }
> = {
  en: {
    eyebrow: 'WORLD STATE · VERIFIED TIMELINE · INTERACTIVE 3D',
    headlineLead: 'Learn Kubernetes',
    headlineEmphasis: 'by watching facts change.',
    description:
      'KubeMotion separates what is factually true in the teaching world from how that world is presented—so a Container restart cannot masquerade as a Pod replacement.',
    orientationLabel: 'Quick orientation',
    orientationTime: '20–30 seconds',
    orientationTitle: 'Three ideas to find your way around',
    orientationIntro: 'Keep this map in mind while the lesson shows Kubernetes changing.',
    orientationPoints: [
      'Control Plane decides.',
      'Worker Nodes run Pods.',
      'A Pod contains one or more Containers.',
    ],
    startLesson: 'Start lesson',
    continueLesson: 'Continue learning',
    exploreCompleted: 'Explore completed lessons',
    revisitOrientation: 'View orientation again',
    continueHome: 'Continue without review',
    previewLabel: 'Verified Kubernetes lifecycle preview',
    sceneCaption: 'SYNTHETIC WORLD · VERIFIED GOLDEN LESSON',
    benefitsLabel: 'KubeMotion benefits',
    benefitDescriptions: [
      'Every step has an immutable WorldSnapshot plus a separate ViewProjection.',
      'See Pod identity, Node placement, Container ID, and replica counts change.',
      'Conceptual animations cite official Kubernetes documentation and use synthetic data.',
    ],
  },
  ja: {
    eyebrow: 'WORLD STATE · 検証済みタイムライン · インタラクティブ 3D',
    headlineLead: 'Kubernetes を',
    headlineEmphasis: '事実の変化を見ながら学ぶ。',
    description:
      'KubeMotion は、学習 world の事実とその見せ方を分離します。そのため、コンテナの再起動を Pod の置き換えとして誤って表現しません。',
    orientationLabel: 'クイックガイド',
    orientationTime: '20〜30 秒',
    orientationTitle: '最初に覚える 3 つのこと',
    orientationIntro: 'レッスンで Kubernetes の変化を見る前に、この全体像を確認しましょう。',
    orientationPoints: [
      'コントロールプレーンが判断します。',
      'ワーカーノードが Pod を実行します。',
      'Pod には 1 つ以上のコンテナが含まれます。',
    ],
    startLesson: 'レッスンを始める',
    continueLesson: '学習を続ける',
    exploreCompleted: '完了したレッスンを探索する',
    revisitOrientation: 'ガイドをもう一度見る',
    continueHome: '確認せずに続ける',
    previewLabel: '検証済み Kubernetes ライフサイクルのプレビュー',
    sceneCaption: '合成 WORLD · 検証済みゴールデンレッスン',
    benefitsLabel: 'KubeMotion の特長',
    benefitDescriptions: [
      '各ステップは、不変の WorldSnapshot と独立した ViewProjection を持ちます。',
      'Pod の ID、Node 配置、Container ID、レプリカ数の変化を確認できます。',
      '概念アニメーションは Kubernetes 公式ドキュメントを参照し、合成データを使用します。',
    ],
  },
  'zh-CN': {
    eyebrow: 'WORLD STATE · 已验证时间线 · 交互式 3D',
    headlineLead: '观察事实如何变化，',
    headlineEmphasis: '学懂 Kubernetes。',
    description:
      'KubeMotion 将教学世界中的事实与呈现方式分开，因此容器重启不会被错误表现成 Pod 替换。',
    orientationLabel: '快速导览',
    orientationTime: '20–30 秒',
    orientationTitle: '先记住这三个概念',
    orientationIntro: '课程会演示 Kubernetes 如何变化，请先用这张简图建立方向感。',
    orientationPoints: [
      '控制平面负责决策。',
      '工作节点运行 Pod。',
      '一个 Pod 包含一个或多个容器。',
    ],
    startLesson: '开始课程',
    continueLesson: '继续学习',
    exploreCompleted: '探索已完成课程',
    revisitOrientation: '再次查看导览',
    continueHome: '跳过回顾并继续',
    previewLabel: '已验证的 Kubernetes 生命周期预览',
    sceneCaption: '合成 WORLD · 已验证黄金课程',
    benefitsLabel: 'KubeMotion 的优势',
    benefitDescriptions: [
      '每一步都有不可变的 WorldSnapshot，并使用独立的 ViewProjection。',
      '直观看到 Pod 身份、Node 调度位置、Container ID 和副本计数的变化。',
      '概念动画引用 Kubernetes 官方文档，并且只使用合成数据。',
    ],
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
  const previewLesson = lessonById.get('container-restart-vs-pod-replacement');
  const step = useMemo(
    () =>
      previewLesson ? courseEngine.compileLesson(previewLesson, scenario).steps[0] : undefined,
    [previewLesson],
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

  if (!previewLesson) throw new Error('Verified lesson is missing');
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
            aria-label={copy.previewLabel}
            step={step}
            playback={{ stepKey: 'home-preview', playbackId: 0, transition: { cues: [] } }}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectEntity={() => undefined}
          />
          <div className="scene-caption">
            <span className="live-dot" />
            {copy.sceneCaption}
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
    </main>
  );
}
