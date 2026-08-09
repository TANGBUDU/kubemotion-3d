import { ArrowRight, Route, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Locale } from '../app/types';
import { compiledFlowStories } from '../content/loader';
import type { CompiledFlowStory } from '../course/types';
import { useAppStore } from '../state/appStore';
import '../styles/flow-stories.css';

const copy: Readonly<
  Record<
    Locale,
    {
      readonly eyebrow: string;
      readonly title: string;
      readonly description: string;
      readonly beats: (count: number) => string;
      readonly verified: string;
      readonly open: string;
      readonly route: string;
      readonly back: string;
    }
  >
> = {
  en: {
    eyebrow: 'FLOW STORIES · CAUSAL PATHS · PERSISTENT ROUTES',
    title: 'Watch one Kubernetes story at a time',
    description:
      'Each story reuses a verified lesson timeline, but removes unrelated steps so the causal path stays visible from beginning to end.',
    beats: (count) => `${count} beats`,
    verified: 'Verified teaching sequence',
    open: 'Open story',
    route: 'Representative path',
    back: 'Back to home',
  },
  ja: {
    eyebrow: 'FLOW STORY · 因果経路 · PERSISTENT ROUTE',
    title: 'Kubernetes の流れを 1 本ずつ追う',
    description:
      '各 Story は検証済みレッスンの履歴を再利用し、関係のないステップを外して、最初から最後まで因果経路を追いやすくします。',
    beats: (count) => `${count} beats`,
    verified: '検証済みの学習シーケンス',
    open: 'Story を開く',
    route: '代表的な経路',
    back: 'ホームへ戻る',
  },
  'zh-CN': {
    eyebrow: 'FLOW STORY · 因果路径 · 持久路线',
    title: '一次看懂一条 Kubernetes 故事',
    description:
      '每条故事复用经过验证的课程历史，但去掉无关步骤，让完整因果路径从开始到结束始终清晰可见。',
    beats: (count) => `${count} 个阶段`,
    verified: '已验证教学序列',
    open: '打开故事',
    route: '代表路径',
    back: '返回首页',
  },
};

function representativePath(compiled: CompiledFlowStory, locale: Locale): string {
  const beat = compiled.beats.find((candidate) => candidate.routes.length > 0);
  const route = beat?.selectedRoute ?? beat?.routes[0];
  if (!beat || !route) return compiled.story.outcome[locale];

  const ids = [route.hops[0]?.fromEntityId, ...route.hops.map((hop) => hop.toEntityId)].filter(
    (id): id is string => Boolean(id),
  );
  const names = ids.map(
    (id) => beat.compiledStep.world.entities[id]?.name ?? id.split(':').at(-1) ?? id,
  );
  return names.join(' → ');
}

export function FlowStoriesPage() {
  const locale = useAppStore((state) => state.locale);
  const t = copy[locale];

  return (
    <main className="flow-stories-page">
      <header className="flow-stories-hero">
        <div>
          <span className="flow-stories-eyebrow">{t.eyebrow}</span>
          <h1>{t.title}</h1>
          <p>{t.description}</p>
        </div>
        <Link className="flow-stories-back" to="/">
          {t.back}
        </Link>
      </header>

      <section className="flow-stories-grid" aria-label={t.title}>
        {compiledFlowStories.map((compiled) => (
          <article className="flow-story-card" key={compiled.story.id}>
            <div className="flow-story-card-meta">
              <span className="flow-story-priority" data-priority={compiled.story.priority}>
                {compiled.story.priority}
              </span>
              <span>{t.beats(compiled.beats.length)}</span>
              <span className="flow-story-verified">
                <ShieldCheck size={13} aria-hidden="true" />
                {t.verified}
              </span>
            </div>
            <h2>{compiled.story.title[locale]}</h2>
            <p>{compiled.story.summary[locale]}</p>
            <div className="flow-story-path">
              <span>
                <Route size={14} aria-hidden="true" />
                {t.route}
              </span>
              <strong>{representativePath(compiled, locale)}</strong>
            </div>
            <Link className="flow-story-open" to={`/stories/${compiled.story.id}/0`}>
              {t.open}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}
