# KubeMotion

**Learn Kubernetes by watching factual state change.**

KubeMotion is an open-source, static-first 3D teaching system. Its world-state engine separates
the Kubernetes facts in a lesson from the camera, emphasis, labels, routes, and animation used to
explain them. That boundary makes a Container restart visibly and testably different from replacing
a Pod.

![KubeMotion ten-step Pod lifecycle lesson](docs/review/screenshots/golden-step-00-1440x900.png)

## Live demo

[Open the canonical GitHub Pages deployment](https://tangbudu.github.io/kubemotion-3d/)

## Verified release scope

- **5 fully verified lessons:** `cluster-overview`, `pod-and-placement`,
  `manifest-to-running-pod`, `service-routes-to-pods`, and
  `container-restart-vs-pod-replacement`
- **Foundation-first sequence:** cluster boundary → Node/Pod/Container placement → API-mediated
  manifest flow → stable Service traffic → restart-versus-replacement comparison
- **10-step Pod lifecycle:** orientation → healthy baseline → Container exit → in-place restart → intentional Pod deletion → controller replacement → unscheduled Pending → scheduler binding → kubelet start/readiness → snapshot-derived comparison
- **6-step Service traffic path:** identify objects → stable Service entry → EndpointSlice readiness → Request A to a Ready backend → readiness change → later Request B to another Ready backend
- **17 planned lessons:** visible as roadmap entries, not represented as complete
- **Explore (Beta):** filters a compiled snapshot while keeping one-hop ownership and placement context
- **Synthetic only:** no cluster credentials, telemetry, backend, or resource mutation

The Pod lifecycle lesson shows three semantic zones, API-mediated control routes, a real
unscheduled tray, Node racks with embedded kubelets and Pod bays, Pods as shells containing child
Container status slots, and in-place ReplicaSet counters. A runtime restart is evidenced by
`containerID`, `restartCount`, `state`, and `lastState`; ReplicaSet counters are presented as
`SPEC / OBSERVED / READY`. The traffic lesson separates the stable Service address, EndpointSlice
API state, and the selected Ready backend. All five lessons use a fixed teaching panel with
evidence and takeaways, collision-aware labels, explicit replay, and meaningful reduced-motion
fallbacks; causal and traffic steps retain persistent wide teaching routes.

## Architecture

```mermaid
flowchart TD
  YAML["YAML lesson + scenario"] --> Validate["Zod + semantic validation"]
  Validate --> Before["beforeWorld: WorldSnapshot"]
  Validate --> Patch["typed atomic WorldPatch"]
  Before --> Apply["applyWorldPatch"]
  Patch --> Apply
  Apply --> World["world: WorldSnapshot"]
  Before --> Diff["WorldDiff"]
  World --> Diff
  Validate --> ViewPatch["ViewProjectionPatch"]
  World --> Projection["ViewProjection"]
  ViewPatch --> Projection
  World --> Renderer["Three.js renderer registries"]
  Diff --> Renderer
  Projection --> Renderer
  Renderer --> Routes["Semantic relations + active teaching routes"]
  Renderer --> Teaching["EvidencePanel + comparison + accessible summary"]
```

`WorldSnapshot` is the factual source of truth. `ViewProjection` can hide, dim, label, or frame
facts, but it cannot override them. Every `CompiledStep` includes `beforeWorld`, `world`,
`worldDiff`, `view`, and `transition`. Animations are cancellable explanations between settled
states and never become factual state.

React owns routes and serializable UI state. `SceneController` owns Three.js handles, relation
resources, DOM labels/callouts, pooled animation tokens, post-processing, rendering, and disposal.
See [the architecture notes](docs/architecture.md).

## Quick start

Requirements: Node.js 24 and pnpm 11.16.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

## Validation

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm content:validate
pnpm content:accuracy
pnpm test:unit -- --run
pnpm build
pnpm test:e2e
pnpm visual:capture
```

The suite covers typed patch transactions, deterministic diffs, snapshot immutability, cue
contracts, specialized visuals, stable and traffic-specific layouts, both factual timelines,
desktop/mobile navigation and language persistence, camera/route/label gates, required visual
captures at 1440×900, 1280×720, and 390×844, and 20-cycle renderer memory stress across all five
verified lessons. Human screenshot acceptance remains mandatory; see the
[review checklist](docs/review/VISUAL_ACCEPTANCE_CHECKLIST.md) and
[before/after evidence](docs/review/BEFORE_AFTER.md).

## Deployment

Hash routing and a relative Vite base make GitHub Pages the canonical static host. The repository
also includes a digest-pinned, non-root nginx image and hardened Helm chart; neither requires
Kubernetes RBAC.

## Accuracy and safety

Lesson claims cite official Kubernetes documentation and carry a verification date. Animations
explain responsibility and causality; they are not packet captures or literal timing traces.
Synthetic IDs and timestamps are clearly teaching data, while field meanings follow Kubernetes API
concepts. Service data-plane behavior remains implementation-dependent. See
[the accuracy policy](docs/accuracy-policy.md) and
[visual semantics](docs/visualization-semantics.md).

## License

MIT
