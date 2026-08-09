import type { Locale } from '../../app/types';
import type { EvidenceChangeKind, EvidenceRow } from '../../course/types';

export interface EvidencePanelProps {
  readonly rows: readonly EvidenceRow[];
  readonly locale: Locale;
  readonly compact?: boolean;
}

const copy: Readonly<
  Record<
    Locale,
    {
      readonly title: string;
      readonly compactTitle: string;
      readonly technical: string;
      readonly empty: string;
      readonly unchanged: string;
      readonly changeNames: Readonly<Record<EvidenceChangeKind, string>>;
    }
  >
> = {
  en: {
    title: 'Evidence',
    compactTitle: 'Key evidence',
    technical: 'Kubernetes fields',
    empty: 'This step changes the view, not Kubernetes state.',
    unchanged: 'unchanged',
    changeNames: { added: 'added', removed: 'removed', changed: 'changed', unchanged: 'unchanged' },
  },
  ja: {
    title: '根拠',
    compactTitle: '重要な根拠',
    technical: 'Kubernetes フィールド',
    empty: 'このステップでは表示だけが変わり、Kubernetes の状態は変化しません。',
    unchanged: '変更なし',
    changeNames: { added: '追加', removed: '削除', changed: '変更', unchanged: '変更なし' },
  },
  'zh-CN': {
    title: '事实证据',
    compactTitle: '关键证据',
    technical: 'Kubernetes 字段',
    empty: '本步只改变展示方式，Kubernetes 状态没有变化。',
    unchanged: '未变化',
    changeNames: { added: '新增', removed: '移除', changed: '变化', unchanged: '未变化' },
  },
};

const changeGlyph: Readonly<Record<EvidenceChangeKind, string>> = {
  added: '+',
  removed: '−',
  changed: 'Δ',
  unchanged: '=',
};

const replicaCountsPattern = /^SPEC (\d+) · OBSERVED (\d+) · READY (\d+)$/;
const endpointConditionsPattern =
  /^ready=(true|false|unknown) · serving=(true|false|unknown) · terminating=(true|false|unknown)$/;
const endpointConditionsPath = /^\/data\/endpoints\/\d+\/conditions$/;
const BEGINNER_ROW_LIMIT = 4;

const beginnerPathPriority: Readonly<Record<string, number>> = {
  '/data/restartCount': 160,
  '/data/containerID': 158,
  '/data/conditions/ready': 156,
  '/data/conditions/containersReady': 154,
  '/data/replicas': 152,
  '/data/endpoints': 150,
  '/data/clusterIP': 148,
  '/data/ports/0': 146,
  '/data/nodeName': 144,
  '/data/uid': 142,
  '/data/state/kind': 140,
  '/data/phase': 138,
  '/data/lastState/reason': 136,
  '/data/lastState/exitCode': 134,
  '/identity': 132,
};

function evidenceKind(row: EvidenceRow): string {
  if (row.path === '/data/replicas') return 'replica-counts';
  if (row.path === '/data/containerID') return 'container-id';
  if (endpointConditionsPath.test(row.path ?? '')) return 'endpoint-conditions';
  return 'standard';
}

function compactValue(row: EvidenceRow, value: string, position: 'before' | 'after'): string {
  if (row.path === '/data/replicas') {
    const match = replicaCountsPattern.exec(value);
    return match ? `${match[1]}/${match[2]}/${match[3]}` : value;
  }
  if (row.path === '/data/containerID') {
    const suffix = /(-\d+)$/.exec(value)?.[1];
    return suffix ? `…${suffix}` : value;
  }
  if (row.path === '/data/uid' && value.length > 18) {
    return `…${value.slice(-12)}`;
  }
  if (endpointConditionsPath.test(row.path ?? '') && position === 'before') {
    const match = endpointConditionsPattern.exec(value);
    const compactCondition = (condition: string | undefined) =>
      condition === 'true' ? 'T' : condition === 'false' ? 'F' : '?';
    return match ? [match[1], match[2], match[3]].map(compactCondition).join('/') : value;
  }
  return value;
}

function EvidenceCode({
  row,
  value,
  position,
}: {
  readonly row: EvidenceRow;
  readonly value: string;
  readonly position: 'before' | 'after';
}) {
  const visible = compactValue(row, value, position);
  return (
    <code
      aria-label={visible === value ? undefined : value}
      title={visible === value ? undefined : value}
    >
      {visible}
      {visible !== value ? <span className="sr-only">{value}</span> : null}
    </code>
  );
}

function beginnerLabel(row: EvidenceRow, locale: Locale): string {
  const labels: Readonly<Record<Locale, Readonly<Record<string, string>>>> = {
    en: {
      '/data/replicas': 'Replicas · desired / current / ready',
      '/data/containerID': 'Container instance',
      '/data/restartCount': 'Restart count',
      '/data/lastState/reason': 'Previous exit',
      '/data/lastState/exitCode': 'Previous exit code',
      '/data/conditions/ready': 'Ready for traffic',
      '/data/conditions/containersReady': 'All containers ready',
      '/data/state/kind': 'Container state',
      '/data/phase': 'Pod phase',
      '/data/uid': 'Pod identity',
      '/data/nodeName': 'Assigned node',
      '/data/ready': 'Container ready',
      '/data/endpoints': 'Ready endpoints',
      '/data/clusterIP': 'Service address',
      '/data/ports/0': 'Service port',
      '/identity': 'Object identity',
    },
    ja: {
      '/data/replicas': 'レプリカ · 期待 / 現在 / Ready',
      '/data/containerID': 'コンテナ実体',
      '/data/restartCount': '再起動回数',
      '/data/lastState/reason': '直前の終了理由',
      '/data/lastState/exitCode': '直前の終了コード',
      '/data/conditions/ready': 'トラフィック受付可能',
      '/data/conditions/containersReady': '全コンテナ Ready',
      '/data/state/kind': 'コンテナ状態',
      '/data/phase': 'Pod フェーズ',
      '/data/uid': 'Pod の識別子',
      '/data/nodeName': '割り当て先 Node',
      '/data/ready': 'コンテナ Ready',
      '/data/endpoints': 'Ready endpoint',
      '/data/clusterIP': 'Service アドレス',
      '/data/ports/0': 'Service ポート',
      '/identity': 'オブジェクト識別子',
    },
    'zh-CN': {
      '/data/replicas': '副本 · 期望 / 当前 / Ready',
      '/data/containerID': '容器实例',
      '/data/restartCount': '重启次数',
      '/data/lastState/reason': '上次退出原因',
      '/data/lastState/exitCode': '上次退出码',
      '/data/conditions/ready': '可接收流量',
      '/data/conditions/containersReady': '全部容器已就绪',
      '/data/state/kind': '容器状态',
      '/data/phase': 'Pod 阶段',
      '/data/uid': 'Pod 身份',
      '/data/nodeName': '所在 Node',
      '/data/ready': '容器已就绪',
      '/data/endpoints': 'Ready Endpoint',
      '/data/clusterIP': 'Service 地址',
      '/data/ports/0': 'Service 端口',
      '/identity': '对象身份',
    },
  };
  if (endpointConditionsPath.test(row.path ?? '')) {
    const full = row.label[locale];
    const target = full.replace(/ Endpoint conditions$/, '').replace(/ conditions$/, '');
    return locale === 'ja'
      ? `${target} の流量受付条件`
      : locale === 'zh-CN'
        ? `${target} 的流量可用性`
        : `${target} traffic eligibility`;
  }
  return labels[locale][row.path ?? ''] ?? row.label[locale];
}

function EvidenceLabel({
  row,
  locale,
  beginner = false,
}: {
  readonly row: EvidenceRow;
  readonly locale: Locale;
  readonly beginner?: boolean;
}) {
  const full = row.label[locale];
  if (beginner) {
    const friendly = beginnerLabel(row, locale);
    return (
      <>
        <span className="evidence-label">{friendly}</span>
        {friendly !== full ? <span className="sr-only">{full}</span> : null}
      </>
    );
  }
  if (row.path === '/data/replicas') {
    return (
      <>
        <span aria-hidden="true" className="evidence-label">
          RS · SPEC / OBSERVED / READY
        </span>
        <span className="sr-only">{full}</span>
      </>
    );
  }
  if (endpointConditionsPath.test(row.path ?? '')) {
    return (
      <>
        <span aria-hidden="true" className="evidence-label">
          {full.replace(' Endpoint conditions', ' conditions')}
        </span>
        <span className="sr-only">{full}</span>
      </>
    );
  }
  return <span className="evidence-label">{full}</span>;
}

function EvidenceValue({ row, locale }: { readonly row: EvidenceRow; readonly locale: Locale }) {
  const before = row.before?.[locale];
  const after = row.after?.[locale];
  if (row.change === 'unchanged') {
    return (
      <span className="evidence-value unchanged">
        <EvidenceCode row={row} value={after ?? before ?? '—'} position="after" />
        <small>{copy[locale].unchanged}</small>
      </span>
    );
  }
  if (before !== undefined && after !== undefined) {
    return (
      <span className="evidence-value transition">
        <EvidenceCode row={row} value={before} position="before" />
        <span aria-hidden="true">→</span>
        <EvidenceCode row={row} value={after} position="after" />
      </span>
    );
  }
  return <EvidenceCode row={row} value={after ?? before ?? '—'} position="after" />;
}

function beginnerRows(rows: readonly EvidenceRow[]): readonly EvidenceRow[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftPriority = endpointConditionsPath.test(left.row.path ?? '')
        ? 155
        : (beginnerPathPriority[left.row.path ?? ''] ?? 80);
      const rightPriority = endpointConditionsPath.test(right.row.path ?? '')
        ? 155
        : (beginnerPathPriority[right.row.path ?? ''] ?? 80);
      const leftScore = (left.row.change === 'unchanged' ? 0 : 1000) + leftPriority;
      const rightScore = (right.row.change === 'unchanged' ? 0 : 1000) + rightPriority;
      return rightScore - leftScore || left.index - right.index;
    })
    .slice(0, BEGINNER_ROW_LIMIT)
    .map(({ row }) => row);
}

function EvidenceRows({
  rows,
  locale,
  beginner = false,
}: {
  readonly rows: readonly EvidenceRow[];
  readonly locale: Locale;
  readonly beginner?: boolean;
}) {
  return (
    <dl>
      {rows.map((row) => (
        <div
          className="evidence-row"
          data-change={row.change}
          data-evidence-kind={evidenceKind(row)}
          key={`${beginner ? 'beginner' : 'technical'}:${row.id}`}
        >
          <dt>
            <span className="evidence-change" aria-hidden="true">
              {changeGlyph[row.change]}
            </span>
            <span className="sr-only">{copy[locale].changeNames[row.change]}: </span>
            <EvidenceLabel row={row} locale={locale} beginner={beginner} />
          </dt>
          <dd>
            <EvidenceValue row={row} locale={locale} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EvidencePanel({ rows, locale, compact = false }: EvidencePanelProps) {
  const keyRows = compact ? beginnerRows(rows) : rows;
  return (
    <section
      className={`evidence-panel ${compact ? 'compact' : ''}`}
      aria-label={copy[locale].title}
      data-testid="evidence-panel"
    >
      <div className="evidence-heading">
        <span aria-hidden="true" className="evidence-heading-mark" />
        <h3>{compact ? copy[locale].compactTitle : copy[locale].title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="evidence-empty">{copy[locale].empty}</p>
      ) : compact ? (
        <>
          <EvidenceRows rows={keyRows} locale={locale} beginner />
          <details className="evidence-technical-details">
            <summary>{copy[locale].technical}</summary>
            <EvidenceRows rows={rows} locale={locale} />
          </details>
        </>
      ) : (
        <EvidenceRows rows={rows} locale={locale} />
      )}
    </section>
  );
}
