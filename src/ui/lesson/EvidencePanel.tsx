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
      readonly empty: string;
      readonly unchanged: string;
      readonly changeNames: Readonly<Record<EvidenceChangeKind, string>>;
    }
  >
> = {
  en: {
    title: 'Evidence',
    empty: 'No factual state changed.',
    unchanged: 'unchanged',
    changeNames: { added: 'added', removed: 'removed', changed: 'changed', unchanged: 'unchanged' },
  },
  ja: {
    title: '根拠',
    empty: '事実状態の変更はありません。',
    unchanged: '変更なし',
    changeNames: { added: '追加', removed: '削除', changed: '変更', unchanged: '変更なし' },
  },
  'zh-CN': {
    title: '事实证据',
    empty: '本步没有事实状态变化。',
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

function evidenceKind(row: EvidenceRow): string {
  if (row.path === '/data/replicas') return 'replica-counts';
  if (row.path === '/data/containerID') return 'container-id';
  if (/^\/data\/endpoints\/\d+\/conditions$/.test(row.path ?? '')) {
    return 'endpoint-conditions';
  }
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
  if (/^\/data\/endpoints\/\d+\/conditions$/.test(row.path ?? '') && position === 'before') {
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
    </code>
  );
}

function EvidenceLabel({ row, locale }: { readonly row: EvidenceRow; readonly locale: Locale }) {
  const full = row.label[locale];
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
  if (/^\/data\/endpoints\/\d+\/conditions$/.test(row.path ?? '')) {
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

export function EvidencePanel({ rows, locale, compact = false }: EvidencePanelProps) {
  return (
    <section
      className={`evidence-panel ${compact ? 'compact' : ''}`}
      aria-label={copy[locale].title}
      data-testid="evidence-panel"
    >
      <div className="evidence-heading">
        <span aria-hidden="true" className="evidence-heading-mark" />
        <h3>{copy[locale].title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="evidence-empty">{copy[locale].empty}</p>
      ) : (
        <dl>
          {rows.map((row) => (
            <div
              className="evidence-row"
              data-change={row.change}
              data-evidence-kind={evidenceKind(row)}
              key={row.id}
            >
              <dt>
                <span className="evidence-change" aria-hidden="true">
                  {changeGlyph[row.change]}
                </span>
                <span className="sr-only">{copy[locale].changeNames[row.change]}: </span>
                <EvidenceLabel row={row} locale={locale} />
              </dt>
              <dd>
                <EvidenceValue row={row} locale={locale} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
