import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EvidenceRow } from '../../src/course/types';
import { EvidencePanel } from '../../src/ui/lesson/EvidencePanel';

const localized = (en: string, ja = en, zh = en) => ({ en, ja, 'zh-CN': zh });

const rows: readonly EvidenceRow[] = [
  {
    id: 'pod-phase',
    entityId: 'pod:web',
    change: 'changed',
    label: localized('Pod phase'),
    before: localized('Pending'),
    after: localized('Running'),
    path: '/data/phase',
  },
  {
    id: 'container-added',
    entityId: 'container:web',
    change: 'added',
    label: localized('Container'),
    after: localized('container:web'),
  },
  {
    id: 'old-pod-removed',
    entityId: 'pod:web-old',
    change: 'removed',
    label: localized('Old Pod'),
    before: localized('pod:web-old'),
  },
  {
    id: 'pod-uid',
    entityId: 'pod:web',
    change: 'unchanged',
    label: localized('Pod UID'),
    after: localized('uid-web'),
    path: '/data/uid',
  },
];

describe('EvidencePanel', () => {
  it('shows explicit non-color change semantics and before-to-after values', () => {
    render(<EvidencePanel rows={rows} locale="en" />);

    const panel = screen.getByTestId('evidence-panel');
    expect(within(panel).getByRole('heading', { name: 'Evidence' })).toBeVisible();
    expect(within(panel).getByText('+')).toBeVisible();
    expect(within(panel).getByText('−')).toBeVisible();
    expect(within(panel).getByText('Δ')).toBeVisible();
    expect(within(panel).getByText('=')).toBeVisible();
    expect(within(panel).getByText('Pending')).toBeVisible();
    expect(within(panel).getByText('→')).toBeVisible();
    expect(within(panel).getByText('Running')).toBeVisible();
    expect(within(panel).getByText('unchanged')).toBeVisible();
    expect(within(panel).getByText(/^changed:/i)).toHaveClass('sr-only');
  });

  it('uses a beginner-first compact summary while retaining technical fields', () => {
    render(<EvidencePanel rows={rows} locale="en" compact />);

    const panel = screen.getByTestId('evidence-panel');
    expect(within(panel).getByRole('heading', { name: 'Key evidence' })).toBeVisible();
    expect(within(panel).getByText('Pod identity')).toBeVisible();
    const details = within(panel).getByText('Kubernetes fields').closest('details');
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute('open');
    expect(panel).toHaveTextContent('Pod UID');
  });

  it('localizes the fixed empty state without inventing evidence', () => {
    render(<EvidencePanel rows={[]} locale="zh-CN" compact />);

    const panel = screen.getByTestId('evidence-panel');
    expect(panel).toHaveClass('compact');
    expect(within(panel).getByRole('heading', { name: '关键证据' })).toBeVisible();
    expect(within(panel).getByText('本步只改变展示方式，Kubernetes 状态没有变化。')).toBeVisible();
  });
});
