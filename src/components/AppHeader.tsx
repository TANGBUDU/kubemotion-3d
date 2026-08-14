import { Languages, Menu, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { Locale } from '../app/types';
import { ui } from '../app/i18n';
import { useAppStore } from '../state/appStore';

const storiesLabel: Readonly<Record<Locale, string>> = {
  en: 'Stories',
  ja: 'Story',
  'zh-CN': '故事',
};

export function AppHeader() {
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const reset = useAppStore((state) => state.resetExperience);
  const [resetNotice, setResetNotice] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { pathname } = useLocation();
  const [menuPath, setMenuPath] = useState(pathname);
  const t = ui(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // The compact header collapses the primary nav behind a disclosure button. Close it whenever the
  // destination changes -- including browser history moves -- so the panel never covers the page the
  // reader just chose. Adjusting during render keeps this out of an effect and avoids a frame where
  // the open panel is drawn over the new route.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (!resetNotice) return;
    const timeout = window.setTimeout(() => setResetNotice(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [resetNotice]);

  const confirmReset = async (): Promise<void> => {
    if (!window.confirm(t.resetProgressConfirm)) return;
    const result = await reset();
    setResetNotice(result.status === 'saved' ? t.resetProgressDone : t.resetProgressFailed);
  };

  return (
    <header className="app-header" data-testid="app-header">
      <NavLink className="brand" to="/" aria-label={`KubeMotion ${t.home}`}>
        <span className="brand-mark">K</span>
        <span>KubeMotion</span>
      </NavLink>
      <button
        ref={menuButtonRef}
        className="nav-menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="app-primary-nav"
        aria-label={menuOpen ? t.closeMenu : t.openMenu}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>
      <nav
        id="app-primary-nav"
        className="app-primary-nav"
        aria-label={t.primaryNavigation}
        data-open={menuOpen ? 'true' : 'false'}
      >
        <NavLink to="/learn">{t.learn}</NavLink>
        <NavLink to="/stories">{storiesLabel[locale]}</NavLink>
        <NavLink to="/explore">
          {t.explore}
          <small className="nav-beta">{t.beta}</small>
        </NavLink>
        <NavLink to="/about">{t.about}</NavLink>
      </nav>
      <div className="header-actions">
        <label className="motion-toggle">
          <input
            type="checkbox"
            checked={reducedMotion}
            onChange={(event) => setReducedMotion(event.target.checked)}
          />
          <span>{t.reducedMotion}</span>
        </label>
        <label className="sr-only" htmlFor="locale">
          {t.language}
        </label>
        <div className="locale-control">
          <Languages size={15} aria-hidden="true" />
          <span>LANG</span>
          <select
            id="locale"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
            <option value="zh-CN">中文</option>
          </select>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={() => void confirmReset()}
          aria-label={t.resetProgress}
          title={t.resetProgress}
        >
          <RotateCcw size={17} aria-hidden="true" />
        </button>
      </div>
      {resetNotice ? (
        <p className="header-reset-status" role="status">
          {resetNotice}
        </p>
      ) : null}
    </header>
  );
}
