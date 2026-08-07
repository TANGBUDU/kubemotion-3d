import { AlertTriangle, BookOpenCheck, Layers3, ShieldCheck } from 'lucide-react';
import { ui } from '../app/i18n';
import { appConfig } from '../app/config';
import { course } from '../content/loader';
import { useAppStore } from '../state/appStore';

export function AboutPage() {
  const locale = useAppStore((state) => state.locale);
  const t = ui(locale);
  return (
    <main className="about-page">
      <div className="about-hero">
        <div className="eyebrow">ABOUT KUBEMOTION</div>
        <h1>An accurate visual language for Kubernetes.</h1>
        <p>
          KubeMotion is an open-source, static-first teaching system. It makes relationships and
          motion observable without asking for access to a real cluster.
        </p>
      </div>
      <section className="about-grid">
        <article>
          <Layers3 />
          <h2>Visual semantics</h2>
          <p>
            Solid blue packets represent application data. Purple document tokens represent
            Kubernetes API requests. Orange pulses represent reconciliation. Green links represent
            storage.
          </p>
        </article>
        <article>
          <BookOpenCheck />
          <h2>Source-backed content</h2>
          <p>
            Core facts are traced to Kubernetes or Gateway API official documentation and record a
            verification date of 2026-08-07.
          </p>
        </article>
        <article>
          <ShieldCheck />
          <h2>Privacy boundary</h2>
          <p>
            The current release uses only a synthetic snapshot. It does not read cluster
            credentials, metrics, logs, traces, or send browser data to a backend.
          </p>
        </article>
        <article>
          <AlertTriangle />
          <h2>Conceptual simplification</h2>
          <p>
            Animations explain responsibility and causality. They are not packet captures, literal
            timing traces, or a claim that every implementation uses the same data plane.
          </p>
        </article>
      </section>
      <section className="roadmap">
        <h2>{t.roadmap}</h2>
        <p>
          Release 0.1 includes five complete lessons. The remaining curriculum is visible here only
          as a non-interactive roadmap.
        </p>
        <div className="roadmap-list">
          {course.lessons.map((lesson, index) => (
            <div key={lesson.id} className={lesson.status}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{lesson.title[locale]}</strong>
              <small>{lesson.status}</small>
            </div>
          ))}
        </div>
      </section>
      <section className="license-note">
        <h2>Open source</h2>
        <p>
          Released under the MIT License. Repository URL is supplied through a single deploy-time
          configuration value when publishing.
        </p>
        {appConfig.repositoryUrl && (
          <a
            className="button secondary"
            href={appConfig.repositoryUrl}
            target="_blank"
            rel="noreferrer noopener"
          >
            View repository
          </a>
        )}
      </section>
    </main>
  );
}
