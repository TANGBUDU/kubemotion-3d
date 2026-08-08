import { AlertTriangle, BookOpenCheck, Layers3, ShieldCheck } from 'lucide-react';
import { ui } from '../app/i18n';
import { appConfig } from '../app/config';
import type { Locale } from '../app/types';
import { course } from '../content/loader';
import { useAppStore } from '../state/appStore';

const aboutCopy: Record<
  Locale,
  {
    eyebrow: string;
    title: string;
    intro: string;
    cards: readonly { title: string; description: string }[];
    roadmapDescription: string;
    available: string;
    planned: string;
    openSource: string;
    license: string;
    repository: string;
  }
> = {
  en: {
    eyebrow: 'ABOUT KUBEMOTION',
    title: 'An accurate visual language for Kubernetes.',
    intro:
      'KubeMotion is an open-source, static-first teaching system built on deterministic world snapshots. It makes state changes and relationships observable without asking for access to a real cluster.',
    cards: [
      {
        title: 'Visual semantics',
        description:
          'Nodes are racks, Pods are shells with child Containers, and relation shapes distinguish scheduling, ownership, runtime hosting, and control observation. Every lesson step is rendered from factual state rather than presentation overrides.',
      },
      {
        title: 'Source-backed content',
        description:
          'Core facts are traced to Kubernetes or Gateway API official documentation and record a verification date of 2026-08-07.',
      },
      {
        title: 'Privacy boundary',
        description:
          'The current release uses only synthetic snapshots. It does not read cluster credentials, metrics, logs, traces, or send browser data to a backend.',
      },
      {
        title: 'Conceptual simplification',
        description:
          'Animations explain responsibility and causality. They are not packet captures, literal timing traces, or a claim that every implementation uses the same data plane.',
      },
    ],
    roadmapDescription:
      'The world-state rebuild includes two fully verified lessons: one Pod lifecycle and one Service traffic story. The remaining curriculum stays a non-interactive roadmap until each lesson passes the same factual, accessibility, and visual validation gates.',
    available: 'available',
    planned: 'planned',
    openSource: 'Open source',
    license:
      'Released under the MIT License. The public repository contains the lesson source, deterministic engine, visual baselines, and validation suite.',
    repository: 'View repository',
  },
  ja: {
    eyebrow: 'KUBEMOTION について',
    title: 'Kubernetes を正確に伝えるビジュアル言語。',
    intro:
      'KubeMotion は、決定論的な world snapshot を基盤にした、オープンソースかつ static-first の学習システムです。実際のクラスターへのアクセスを求めず、状態変化と関係を観察できるようにします。',
    cards: [
      {
        title: '視覚的な意味体系',
        description:
          'Node はラック、Pod は子 Container を持つシェルとして表現し、線の形でスケジューリング、所有、runtime hosting、control observation を区別します。各ステップは表示上の上書きではなく事実状態から描画されます。',
      },
      {
        title: '公式情報源に基づく内容',
        description:
          '中核となる事実は Kubernetes または Gateway API の公式ドキュメントに結び付け、検証日 2026-08-07 を記録しています。',
      },
      {
        title: 'プライバシー境界',
        description:
          '現行版は合成 snapshot のみを使用します。クラスター認証情報、メトリクス、ログ、トレースを読み取らず、ブラウザーのデータを backend へ送信しません。',
      },
      {
        title: '概念上の単純化',
        description:
          'アニメーションは責任と因果関係を説明するものです。packet capture や実時間 trace ではなく、すべての実装が同じ data plane を使うという主張でもありません。',
      },
    ],
    roadmapDescription:
      'world-state 再構築版には、Pod lifecycle と Service traffic の 2 つの完全検証済みレッスンがあります。残りは同じ事実・アクセシビリティ・視覚検証を通過するまで非インタラクティブなロードマップとして表示します。',
    available: '利用可能',
    planned: '予定',
    openSource: 'オープンソース',
    license:
      'MIT License で公開しています。公開 repository には、レッスン source、決定論的 engine、visual baseline、検証 suite が含まれます。',
    repository: 'repository を見る',
  },
  'zh-CN': {
    eyebrow: '关于 KUBEMOTION',
    title: '为 Kubernetes 建立准确的视觉语言。',
    intro:
      'KubeMotion 是一个开源、静态优先的教学系统，以确定性的世界快照为基础。无需访问真实集群，也能观察状态变化与对象关系。',
    cards: [
      {
        title: '视觉语义',
        description:
          'Node 表现为机架，Pod 表现为容纳子 Container 的外壳，不同关系线区分调度、所有权、运行时承载和控制面观察。每个步骤都从事实状态渲染，而不是靠展示层覆盖事实。',
      },
      {
        title: '基于官方来源',
        description:
          '核心事实均追溯到 Kubernetes 或 Gateway API 官方文档，并记录验证日期 2026-08-07。',
      },
      {
        title: '隐私边界',
        description:
          '当前版本仅使用合成快照，不读取集群凭据、指标、日志或链路，也不会把浏览器数据发送到后端。',
      },
      {
        title: '概念简化',
        description:
          '动画用于解释职责和因果关系，不是抓包、真实时间轨迹，也不声称所有实现都使用同一种数据平面。',
      },
    ],
    roadmapDescription:
      '世界状态重构版包含两门完整验证的课程：一门 Pod 生命周期课程和一门 Service 流量课程。其余内容在通过同等事实、无障碍和视觉验证前，仅作为不可交互的路线图展示。',
    available: '可学习',
    planned: '计划中',
    openSource: '开源',
    license: '项目采用 MIT License。公开仓库包含课程源文件、确定性引擎、视觉基线和验证套件。',
    repository: '查看仓库',
  },
};

export function AboutPage() {
  const locale = useAppStore((state) => state.locale);
  const t = ui(locale);
  const copy = aboutCopy[locale];
  const [visualSemantics, sourceBacked, privacyBoundary, simplification] = copy.cards;
  if (!visualSemantics || !sourceBacked || !privacyBoundary || !simplification) return null;
  return (
    <main className="about-page">
      <div className="about-hero">
        <div className="eyebrow">{copy.eyebrow}</div>
        <h1>{copy.title}</h1>
        <p>{copy.intro}</p>
      </div>
      <section className="about-grid">
        <article>
          <Layers3 aria-hidden="true" />
          <h2>{visualSemantics.title}</h2>
          <p>{visualSemantics.description}</p>
        </article>
        <article>
          <BookOpenCheck aria-hidden="true" />
          <h2>{sourceBacked.title}</h2>
          <p>{sourceBacked.description}</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" />
          <h2>{privacyBoundary.title}</h2>
          <p>{privacyBoundary.description}</p>
        </article>
        <article>
          <AlertTriangle aria-hidden="true" />
          <h2>{simplification.title}</h2>
          <p>{simplification.description}</p>
        </article>
      </section>
      <section className="roadmap">
        <h2>{t.roadmap}</h2>
        <p>{copy.roadmapDescription}</p>
        <div className="roadmap-list">
          {course.lessons.map((lesson, index) => (
            <div key={lesson.id} className={lesson.status}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{lesson.title[locale]}</strong>
              <small>{lesson.status === 'available' ? copy.available : copy.planned}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="license-note">
        <h2>{copy.openSource}</h2>
        <p>{copy.license}</p>
        <a
          className="button secondary"
          href={appConfig.repositoryUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          {copy.repository}
        </a>
      </section>
    </main>
  );
}
