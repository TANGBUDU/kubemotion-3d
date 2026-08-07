import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import { SceneViewport } from '../components/SceneViewport';
import { lessonById, scenario } from '../content/loader';
import { courseEngine } from '../course/CourseEngine';
import { useAppStore } from '../state/appStore';

export function HomePage() {
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const t = ui(locale);
  const lesson = lessonById.get('container-restart-vs-pod-replacement');
  const step = useMemo(
    () => (lesson ? courseEngine.compileLesson(lesson, scenario).steps[0] : undefined),
    [lesson],
  );
  if (!lesson) throw new Error('Verified lesson is missing');
  if (!step) return null;
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">WORLD STATE · VERIFIED TIMELINE · INTERACTIVE 3D</div>
          <h1>
            Learn Kubernetes
            <br />
            <span>by watching facts change.</span>
          </h1>
          <p>
            KubeMotion separates what is factually true in the teaching world from how that world is
            presented—so a Container restart cannot masquerade as a Pod replacement.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/learn/container-restart-vs-pod-replacement/0">
              {t.start}
              <ArrowRight size={18} />
            </Link>
            <Link className="button secondary" to="/explore">
              {t.demo}
            </Link>
          </div>
          <div className="trust-row">
            <ShieldCheck size={17} />
            {t.noAccess}
            <span>·</span>
            {t.private}
          </div>
        </div>
        <div className="hero-scene" aria-label="Verified Kubernetes lifecycle preview">
          <SceneViewport
            step={step}
            playback={{ stepKey: 'home-preview', playbackId: 0, transition: { cues: [] } }}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectEntity={() => undefined}
          />
          <div className="scene-caption">
            <span className="live-dot" />
            SYNTHETIC WORLD · VERIFIED GOLDEN LESSON
          </div>
        </div>
      </section>
      <section className="value-grid" aria-label="KubeMotion benefits">
        <article>
          <Boxes />
          <h2>{t.relationships}</h2>
          <p>Every step has an immutable WorldSnapshot plus a separate ViewProjection.</p>
        </article>
        <article>
          <GitBranch />
          <h2>{t.flows}</h2>
          <p>See Pod identity, Node placement, Container generation, and replica counts change.</p>
        </article>
        <article>
          <ShieldCheck />
          <h2>{t.sources}</h2>
          <p>
            Conceptual animations cite official Kubernetes documentation and use synthetic data.
          </p>
        </article>
      </section>
    </main>
  );
}
