import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  InspectorDrawer,
  type DetailSection,
  type InspectorFact,
} from '../../src/ui/lesson/InspectorDrawer';
import { useDrawerFocus } from '../../src/ui/lesson/useDrawerFocus';

function DrawerHarness({ modal }: { readonly modal: boolean }) {
  const [open, setOpen] = useState(false);
  const drawerRef = useDrawerFocus(open, () => setOpen(false), modal);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open drawer
      </button>
      <aside ref={drawerRef} hidden={!open} aria-label="Test drawer">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </aside>
      <button type="button">Outside action</button>
    </>
  );
}

function InspectorHarness({ facts = [] }: { readonly facts?: readonly InspectorFact[] }) {
  const [section, setSection] = useState<DetailSection>('terms');
  return (
    <InspectorDrawer
      open
      locale="en"
      activeSection={section}
      facts={facts}
      terms={[]}
      sources={[]}
      verifiedAt="2026-08-08"
      onSectionChange={setSection}
      onClose={() => undefined}
    />
  );
}

describe('drawer keyboard behavior', () => {
  it('traps focus only for modal drawers', async () => {
    const { unmount } = render(<DrawerHarness modal />);
    fireEvent.click(screen.getByRole('button', { name: 'Open drawer' }));
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Tab' })).toBe(false);
    expect(first).toHaveFocus();
    expect(fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(last).toHaveFocus();
    unmount();

    render(<DrawerHarness modal={false} />);
    const trigger = screen.getByRole('button', { name: 'Open drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    const nonModalFirst = screen.getByRole('button', { name: 'First action' });
    const nonModalLast = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(nonModalFirst).toHaveFocus());

    nonModalLast.focus();
    expect(fireEvent.keyDown(nonModalLast, { key: 'Tab' })).toBe(true);
    expect(nonModalLast).toHaveFocus();

    const outside = screen.getByRole('button', { name: 'Outside action' });
    outside.focus();
    fireEvent.keyDown(outside, { key: 'Escape' });
    await waitFor(() => expect(screen.getByLabelText('Test drawer')).not.toBeVisible());
    expect(trigger).toHaveFocus();
  });

  it('uses roving tabs and skips a disabled inspector tab', () => {
    const windowKeydown = vi.fn();
    window.addEventListener('keydown', windowKeydown);
    render(<InspectorHarness />);

    const inspector = screen.getByRole('tab', { name: 'Inspector' });
    const terms = screen.getByRole('tab', { name: 'Terms' });
    const sources = screen.getByRole('tab', { name: 'Sources' });
    expect(inspector).toBeDisabled();
    expect(inspector).toHaveAttribute('tabindex', '-1');
    expect(terms).toHaveAttribute('tabindex', '0');
    expect(sources).toHaveAttribute('tabindex', '-1');

    terms.focus();
    fireEvent.keyDown(terms, { key: 'ArrowLeft' });
    expect(sources).toHaveFocus();
    expect(sources).toHaveAttribute('aria-selected', 'true');
    expect(terms).toHaveAttribute('tabindex', '-1');
    expect(windowKeydown).not.toHaveBeenCalled();

    fireEvent.keyDown(sources, { key: 'Home' });
    expect(terms).toHaveFocus();
    expect(terms).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(terms, { key: 'End' });
    expect(sources).toHaveFocus();
    expect(sources).toHaveAttribute('aria-selected', 'true');
    window.removeEventListener('keydown', windowKeydown);
  });

  it('includes the inspector tab in arrow navigation when facts exist', () => {
    render(<InspectorHarness facts={[{ label: 'Name', value: 'api-a' }]} />);
    const terms = screen.getByRole('tab', { name: 'Terms' });
    const inspector = screen.getByRole('tab', { name: 'Inspector' });
    terms.focus();

    fireEvent.keyDown(terms, { key: 'ArrowLeft' });
    expect(inspector).toHaveFocus();
    expect(inspector).toHaveAttribute('aria-selected', 'true');
    expect(inspector).toHaveAttribute('tabindex', '0');
  });
});
