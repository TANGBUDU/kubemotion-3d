import { RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { Locale } from '../app/types';
import { ui } from '../app/i18n';
import { useAppStore } from '../state/appStore';

export function AppHeader() {
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const setReducedMotion = useAppStore((state) => state.setReducedMotion);
  const reset = useAppStore((state) => state.resetExperience);
  const [resetNotice, setResetNotice] = useState('');
  const t = ui(locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
      <nav className="app-primary-nav" aria-label={t.primaryNavigation}>
        <NavLink to="/learn">{t.learn}</NavLink>
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
        <select
          id="locale"
          value={locale}
          onChange={(event) => setLocale(event.target.value as Locale)}
        >
          <option value="en">EN</option>
          <option value="ja">日本語</option>
          <option value="zh-CN">中文</option>
        </select>
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
