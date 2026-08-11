import { Box, CheckCircle2, CircleHelp, ServerCog, UserRound } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Locale } from '../app/types';
import '../styles/beginner-problem-stage.css';

export type BeginnerProblemStageKind = 'single-container' | 'manual-replicas';

interface BeginnerProblemStageProps {
  readonly kind: BeginnerProblemStageKind;
  readonly locale: Locale;
  readonly ariaLabel?: string | undefined;
  readonly onViewportClassChange?: ((viewport: 'mobile' | 'desktop') => void) | undefined;
}

const copy: Record<
  Locale,
  {
    before: string;
    singleTitle: string;
    singleIntro: string;
    runtime: string;
    container: string;
    running: string;
    singleQuestion: string;
    singleConclusion: string;
    replicasTitle: string;
    replicasIntro: string;
    you: string;
    chores: readonly [string, string, string, string];
    replicasConclusion: string;
  }
> = {
  en: {
    before: 'BEFORE KUBERNETES',
    singleTitle: 'One container can already run your app',
    singleIntro: 'A container runtime is enough for this simple job.',
    runtime: 'Container runtime',
    container: 'api container',
    running: 'Application is running',
    singleQuestion: 'If this process stops tomorrow, who notices and restores it?',
    singleConclusion: 'Kubernetes is not needed just to start one process.',
    replicasTitle: 'Starting three copies is easy. Keeping three healthy is the hard part.',
    replicasIntro:
      'You can launch three copies by hand—but then someone must continuously manage them.',
    you: 'Without orchestration, that controller is you',
    chores: [
      'Detect a failure',
      'Count what remains',
      'Choose where a replacement runs',
      'Start it again',
    ],
    replicasConclusion: 'This continuing maintenance problem is where Kubernetes becomes useful.',
  },
  ja: {
    before: 'KUBERNETES を使う前',
    singleTitle: '1つのコンテナだけでもアプリは動く',
    singleIntro: 'この単純な仕事なら、コンテナランタイムだけで十分です。',
    runtime: 'コンテナランタイム',
    container: 'api コンテナ',
    running: 'アプリは実行中',
    singleQuestion: '明日このプロセスが止まったら、誰が気づいて復旧しますか？',
    singleConclusion: '1つのプロセスを起動するだけなら Kubernetes は不要です。',
    replicasTitle: '3つ起動するのは簡単。3つを正常に保つのが難しい。',
    replicasIntro:
      '手動で3つ起動できます。しかし、その後は誰かが継続して管理しなければなりません。',
    you: 'オーケストレーションがなければ、その controller はあなたです',
    chores: ['障害を見つける', '残っている数を数える', '置換先を選ぶ', 'もう一度起動する'],
    replicasConclusion: 'この「継続して守る」問題で Kubernetes が役立ちます。',
  },
  'zh-CN': {
    before: '还没有 KUBERNETES',
    singleTitle: '一个容器，本来就能把应用跑起来',
    singleIntro: '只是完成这件简单的事，容器运行时已经够用。',
    runtime: '容器运行时',
    container: 'api 容器',
    running: '应用正在运行',
    singleQuestion: '如果这个进程明天挂了，谁来发现它、再把它恢复？',
    singleConclusion: '只是启动一个进程，并不需要 Kubernetes。',
    replicasTitle: '启动三份很容易，长期保持三份健康才是难点',
    replicasIntro: '你当然可以手动启动三份，但从此必须有人持续管理它们。',
    you: '没有编排系统时，那个“控制器”就是你自己',
    chores: ['发现故障', '数还剩几份', '决定替换副本放哪里', '重新把它启动起来'],
    replicasConclusion: 'Kubernetes 真正解决的是这种持续维护问题。',
  },
};

export function BeginnerProblemStage({
  kind,
  locale,
  ariaLabel,
  onViewportClassChange,
}: BeginnerProblemStageProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const t = copy[locale];

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !onViewportClassChange) return;
    const publish = () => onViewportClassChange(host.clientWidth <= 720 ? 'mobile' : 'desktop');
    publish();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(publish);
    observer.observe(host);
    return () => observer.disconnect();
  }, [onViewportClassChange]);

  return (
    <div
      ref={hostRef}
      className="beginner-problem-stage"
      role="img"
      aria-label={ariaLabel}
      data-testid="beginner-problem-stage"
      data-concept={kind}
    >
      <div className="beginner-problem-stage__inner">
        <span className="beginner-problem-stage__eyebrow">{t.before}</span>
        {kind === 'single-container' ? (
          <>
            <div className="beginner-problem-stage__heading">
              <h2>{t.singleTitle}</h2>
              <p>{t.singleIntro}</p>
            </div>
            <div className="beginner-single-flow" aria-hidden="true">
              <div className="beginner-runtime-card">
                <ServerCog size={24} />
                <span>{t.runtime}</span>
                <div className="beginner-container-card">
                  <Box size={27} />
                  <strong>{t.container}</strong>
                </div>
              </div>
              <div className="beginner-flow-arrow">→</div>
              <div className="beginner-running-card">
                <CheckCircle2 size={32} />
                <strong>{t.running}</strong>
              </div>
            </div>
            <div className="beginner-problem-question">
              <CircleHelp size={22} aria-hidden="true" />
              <span>{t.singleQuestion}</span>
            </div>
            <p className="beginner-problem-conclusion">{t.singleConclusion}</p>
          </>
        ) : (
          <>
            <div className="beginner-problem-stage__heading">
              <h2>{t.replicasTitle}</h2>
              <p>{t.replicasIntro}</p>
            </div>
            <div className="beginner-replica-row" aria-hidden="true">
              {[1, 2, 3].map((replica) => (
                <div className="beginner-replica-card" key={replica}>
                  <Box size={25} />
                  <strong>api #{replica}</strong>
                </div>
              ))}
            </div>
            <div className="beginner-human-controller">
              <div className="beginner-human-controller__person">
                <UserRound size={28} aria-hidden="true" />
                <strong>{t.you}</strong>
              </div>
              <div className="beginner-human-controller__chores">
                {t.chores.map((chore, index) => (
                  <span key={chore}>
                    <b>{index + 1}</b>
                    {chore}
                  </span>
                ))}
              </div>
            </div>
            <p className="beginner-problem-conclusion">{t.replicasConclusion}</p>
          </>
        )}
      </div>
    </div>
  );
}
