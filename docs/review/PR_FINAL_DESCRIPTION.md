## Summary

- immutable `WorldSnapshot` / `WorldPatch` / `WorldDiff` plus a separate `ViewProjection`;
- two verified lessons:
  - Container restart vs Pod replacement;
  - Service routes to Ready Pods;
- premium teaching visuals, semantic zones, `Line2` routes, obstacle-aware route planning, label
  collision handling, and desktop/mobile teaching shells;
- deterministic direct navigation and replay, meaningful reduced motion, and bounded renderer
  resources.

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
- `pnpm content:accuracy` — PASS (164 text files, 24 forbidden patterns, all lifecycle and
  Service invariants);
- `pnpm test:unit -- --run` — PASS (23 files, 176 tests);
- `pnpm build` — PASS;
- `pnpm test:e2e` — PASS (66 passed, 39 skipped, 0 failed); skips are deliberate
  project/viewport ownership selections;
- 20-cycle dual-lesson renderer pressure gate — PASS;
- visual acceptance — PASS (38 full-page + 5 focused = 43 screenshots; 0 labels outside the
  stage and 0 measured label overlap).

## Review aids

- current screenshot manifest: `docs/review/screenshots/manifest.json`;
- factual and visual checklist: `docs/review/VISUAL_ACCEPTANCE_CHECKLIST.md`;
- Before/After: `docs/review/BEFORE_AFTER.md`;
- architecture: `docs/architecture.md`;
- focused Evidence and comparison crops: `docs/review/screenshots/evidence-*.png` and
  `docs/review/screenshots/comparison-*.png`.

GitHub Pages remains sourced from `main`; this PR intentionally leaves merge and publication to the
repository owner after final review.
