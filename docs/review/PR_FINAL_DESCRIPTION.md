## Summary

> Foundation-first rebuild note: this document records the accepted pre-rebuild release baseline.
> Milestones 0–10 replace its visual and curriculum completion claims as they are delivered.

- immutable `WorldSnapshot` / `WorldPatch` / `WorldDiff` plus a separate `ViewProjection`;
- two verified lessons:
  - Container restart vs Pod replacement;
  - Service routes to Ready Pods;
- premium teaching visuals, semantic zones, `Line2` routes, obstacle-aware route planning, label
  collision handling, and desktop/mobile teaching shells;
- deterministic direct navigation and replay, meaningful reduced motion, and bounded renderer
  resources;
- manifest-driven `/learn` continuation with manifest-ordered first entry, resumable progress,
  normalized lesson deep links, explicit completion, and first-unfinished next-lesson routing;
- serialized cross-tab completion merges with same-tab committed-result reconciliation, a
  Reset-generation guard, visible saving/saved/failed states, and a non-blocking Retry path;
- local WebGL fallback and Retry, plus comparison steps that do not mount a hidden 3D
  renderer;
- responsive 320/390 px navigation and timeline behavior, keyboard-complete tabs/drawers, and
  localized Home, About, Explore, and header surfaces;
- English, Japanese, and Simplified Chinese release documentation plus current visualization
  semantics guarded by the public-document accuracy scan.

## Factual acceptance gates

- same-Pod Container restart:
  - same Pod UID and Node;
  - new runtime `containerID`;
  - `restartCount` changes `0 → 1`;
  - `lastState` records the prior termination;
  - local kubelet causal route;
- Container failure:
  - Pod phase remains `Running`;
  - `ContainersReady` and `Ready` become false;
  - ReplicaSet `SPEC / OBSERVED / READY` becomes `3 / 3 / 2`;
- Pod replacement:
  - explicit deletion removes the old Pod identity;
  - the new Pending Pod has a new UID and no Node;
  - Scheduler binding is separate from kubelet startup and readiness;
- Service lesson:
  - stable Service address;
  - EndpointSlice conditions remain visible;
  - completed Request A and a distinct later Request B;
  - the NotReady endpoint is not selected for ordinary traffic.

## Validation

- `pnpm install --frozen-lockfile` — PASS;
- `pnpm format:check` — PASS;
- `pnpm lint` — PASS;
- `pnpm typecheck` — PASS;
- `pnpm content:validate` — PASS (2 v2 scenarios, 25 entities, 28 relations, 2 verified v2
  lessons, 20 planned lessons, 26 terms, 29 official sources);
- `pnpm content:accuracy` — PASS (208 current-public text files, 30 forbidden patterns, 23 local
  links, and all README, visualization, lifecycle, and Service invariants);
- `pnpm test:unit -- --run` — PASS (34 files, 238 tests);
- `pnpm build` — PASS;
- `pnpm test:e2e` — PASS (132 passed, 45 skipped, 0 failed); skips are deliberate
  project/viewport ownership selections;
- 20-cycle dual-lesson renderer resource pressure gate — PASS;
- screenshot gate / visual acceptance — PASS (38 full-page + 5 focused = 43 screenshots; 0 labels outside the
  stage and 0 measured label overlap).

## Targeted continuity and recovery gates

- controlled-lock Complete → Next navigation — PASS (the completion remains in session and
  storage while the current-tab cursor stays on the next lesson);
- forced-lock contention tests reconcile both writer tabs to the merged completion set in both
  Service-first and Pod-first order — PASS;
- pending completion → later Reset — PASS (the older commit cannot restore reset progress);
- injected `localStorage.setItem` failure → localized warning → Retry — PASS (both tabs converge
  after the retry succeeds);
- Home preview / CTA coherence — PASS for clean English, localized Simplified Chinese, saved Pod
  progress, Service-completed progress, and the all-complete showcase.

## Review aids

- current screenshot manifest: `docs/review/screenshots/manifest.json`;
- factual and visual checklist: `docs/review/VISUAL_ACCEPTANCE_CHECKLIST.md`;
- Before/After: `docs/review/BEFORE_AFTER.md`;
- architecture: `docs/architecture.md`;
- focused Evidence and comparison crops: `docs/review/screenshots/evidence-*.png` and
  `docs/review/screenshots/comparison-*.png`.

The VPS review site was published from this PR branch. GitHub Pages remains sourced from `main`,
and merging remains an explicit repository owner decision.
