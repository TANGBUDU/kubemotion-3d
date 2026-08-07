import { ArrowRight, Boxes, GitBranch, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ui } from '../app/i18n';
import { SceneViewport } from '../components/SceneViewport';
import { createExploreProjection } from '../course/exploreProjection';
import { createClusterGraph } from '../domain/clusterGraph';
import { scenario } from '../content/loader';
import { useAppStore } from '../state/appStore';

export function HomePage() {
  const locale = useAppStore((state) => state.locale);
  const reducedMotion = useAppStore((state) => state.reducedMotion);
  const t = ui(locale);
  const graph = useMemo(() => createClusterGraph(scenario), []);
  const projection = useMemo(
    () =>
      createExploreProjection(graph, 'overview', {
        query: '',
        kind: '',
        namespace: '',
        status: '',
      }),
    [graph],
  );
  return (
    <main className="home-page">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">STATIC-FIRST · INTERACTIVE · SOURCE-BACKED</div>
          <h1>
            Learn Kubernetes
            <br />
            <span>by watching it move.</span>
          </h1>
          <p>
            KubeMotion turns object relationships, placement decisions, control loops, and
            application traffic into an explorable 3D system.
          </p>
          <div className="hero-actions">
            <Link className="button primary" to="/learn/cluster-overview/0">
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
        <div className="hero-scene" aria-label="Demo cluster preview">
          <SceneViewport
            graph={graph}
            projection={projection}
            transition={[]}
            locale={locale}
            reducedMotion={reducedMotion}
            onSelectEntity={() => undefined}
          />
          <div className="scene-caption">
            <span className="live-dot" />
            SYNTHETIC DEMO · OVERVIEW
          </div>
        </div>
      </section>
      <section className="value-grid" aria-label="KubeMotion benefits">
        <article>
          <Boxes />
          <h2>{t.relationships}</h2>
          <p>Keep API objects, runtime components, infrastructure, and logical scope distinct.</p>
        </article>
        <article>
          <GitBranch />
          <h2>{t.flows}</h2>
          <p>See API control requests and application data take semantically different paths.</p>
        </article>
        <article>
          <ShieldCheck />
          <h2>{t.sources}</h2>
          <p>
            Every lesson links back to official Kubernetes documentation and a verification date.
          </p>
        </article>
      </section>
    </main>
  );
}
