import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import type { Locale } from '../app/types';
import { SceneViewport } from '../components/SceneViewport';
import { lessonById, scenario } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { useAppStore } from '../state/appStore';
import '../styles/home.css';

const lessonPath = '/learn/container-restart-vs-pod-replacement/0';

const homeCopy: Record<
  Locale,
  {
    orientationLabel: string;
    orientationTime: string;
    orientationTitle: string;
    orientationIntro: string;
    orientationPoints: readonly [string, string, string];
    startLesson: string;
    revisitOrientation: string;
    continueHome: string;
    previewLabel: string;
    benefitsLabel: string;
  }
> = {
  en: {
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
    revisitOrientation: 'View orientation again',
    continueHome: 'Continue without review',
    previewLabel: 'Verified Kubernetes lifecycle preview',
    benefitsLabel: 'KubeMotion benefits',
  },
  ja: {
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
    revisitOrientation: 'ガイドをもう一度見る',
    continueHome: '確認せずに続ける',
    previewLabel: '検証済み Kubernetes ライフサイクルのプレビュー',
    benefitsLabel: 'KubeMotion の特長',
  },
  'zh-CN': {
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
    revisitOrientation: '再次查看导览',
    continueHome: '跳过回顾并继续',
    previewLabel: '已验证的 Kubernetes 生命周期预览',
    benefitsLabel: 'KubeMotion 的优势',
  },
};

export function HomePage() {
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const orientationSeen = useAppStore((state) => state.orientationSeen);
  const setOrientationSeen = useAppStore((state) => state.setOrientationSeen);
  const [orientationOpen, setOrientationOpen] = useState(() => !orientationSeen);
  const revisitButtonRef = useRef<HTMLButtonElement>(null);
  const orientationHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<'orientation' | 'revisit' | null>(null);
  const t = ui(locale);
  const copy = homeCopy[locale];
  const lesson = lessonById.get('container-restart-vs-pod-replacement');
  const step = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, scenario).steps[0] : undefined),
    [lesson],
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

  if (!lesson) throw new Error('Verified lesson is missing');
  if (!step) return null;

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
          <div className="eyebrow">WORLD STATE · VERIFIED TIMELINE · INTERACTIVE 3D</div>
          <h1>
            Learn Kubernetes
            <br />
            <span>by watching facts change.</span>
          </h1>
          <p>
            KubeMotion separates what is factually true in the teaching world from how that world is
            presented—so a Container restart cannot masquerade as a Pod replacement.
          </p>

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
                  {copy.startLesson}
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
                {copy.startLesson}
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
        <div className="hero-scene" aria-label={copy.previewLabel}>
          <SceneViewport
            step={step}
            playback={{ stepKey: 'home-preview', playbackId: 0, transition: { cues: [] } }}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectEntity={() => undefined}
          />
          <div className="scene-caption">
            <span className="live-dot" />
            SYNTHETIC WORLD · VERIFIED GOLDEN LESSON
          </div>
        </div>
      </section>
      <section className="value-grid" aria-label={copy.benefitsLabel}>
        <article>
          <Boxes aria-hidden="true" />
          <h2>{t.relationships}</h2>
          <p>Every step has an immutable WorldSnapshot plus a separate ViewProjection.</p>
        </article>
        <article>
          <GitBranch aria-hidden="true" />
          <h2>{t.flows}</h2>
          <p>See Pod identity, Node placement, Container ID, and replica counts change.</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <h2>{t.sources}</h2>
          <p>
            Conceptual animations cite official Kubernetes documentation and use synthetic data.
          </p>
        </article>
      </section>
    </main>
  );
}
