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

function EvidenceValue({ row, locale }: { readonly row: EvidenceRow; readonly locale: Locale }) {
  const before = row.before?.[locale];
  const after = row.after?.[locale];
  if (row.change === 'unchanged') {
    return (
      <span className="evidence-value unchanged">
        <code>{after ?? before ?? '—'}</code>
        <small>{copy[locale].unchanged}</small>
      </span>
    );
  }
  if (before !== undefined && after !== undefined) {
    return (
      <span className="evidence-value transition">
        <code>{before}</code>
        <span aria-hidden="true">→</span>
        <code>{after}</code>
      </span>
    );
  }
  return <code>{after ?? before ?? '—'}</code>;
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
            <div className="evidence-row" data-change={row.change} key={row.id}>
              <dt>
                <span className="evidence-change" aria-hidden="true">
                  {changeGlyph[row.change]}
                </span>
                <span className="sr-only">{copy[locale].changeNames[row.change]}: </span>
                {row.label[locale]}
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
