import { RotateCcw } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import type { Locale } from '../domain/types';
import { ui } from '../app/i18n';
import { useAppStore } from '../state/appStore';

export function AppHeader() {
  const locale = useAppStore((state) => state.locale);
  const setLocale = useAppStore((state) => state.setLocale);
  const reset = useAppStore((state) => state.resetExperience);
  const t = ui(locale);
  return (
    <header className="app-header">
      <NavLink className="brand" to="/" aria-label="KubeMotion home">
        <span className="brand-mark">K</span>
        <span>KubeMotion</span>
      </NavLink>
      <nav aria-label="Primary navigation">
        <NavLink to="/learn">{t.learn}</NavLink>
        <NavLink to="/explore">{t.explore}</NavLink>
        <NavLink to="/about">{t.about}</NavLink>
      </nav>
      <div className="header-actions">
        <label className="sr-only" htmlFor="locale">
          Language
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
        <button className="icon-button" onClick={reset} aria-label={t.reset}>
          <RotateCcw size={17} />
        </button>
      </div>
    </header>
  );
}
