## Summary

> Foundation-first rebuild note: this document records the current accepted M9 release candidate.
> Historical milestone counts remain below as evidence of the incremental rebuild.

Delivered rebuild milestones on this branch:

- M0 preserves the rejected production baseline and locks the machine-readable rebuild gates;
- M1 gives Overview, Logical Ownership, Placement & Runtime, Control Flow, Traffic, and Storage
  independent scene grammars and density budgets;
- M2 replaces the unbounded shared floor with one bounded Cluster foundation, three
  layout-owned semantic islands, dedicated Cluster/etcd visuals, and deterministic Overview and
  Control Flow placement. The desktop five-second gate passes; the intentionally recorded 390 px
  composition remains an explicit M5 responsibility.
- M3 makes the runtime hierarchy structural: each Node has four dimension-backed Pod bays plus
  separate kubelet and Container Runtime mounts; each Pod is an open translucent shell with two
  deterministic Container slots, a short UID fingerprint, and a conditional restart badge.
  Runtime diagnostics use rendered THREE AABBs and reject overflow, overlap, orphan modules,
  Containers outside Pods, and Pending Pods inside Nodes.
- M4 establishes a separate logical-object language: Namespace is a shallow workspace,
  Deployment is a desired-state blueprint, ReplicaSet keeps SPEC / OBSERVED / READY counters,
  Service is a stable portal, and EndpointSlice is a dynamic endpoint inventory whose selected
  row follows the real Client → Service → Pod route. Browser and Developer actors use external
  terminal silhouettes, while Logical and Placement no longer share Pod/Node containment.
- M5 makes those scenes readable at the actual renderer width: desktop/mobile grammar compilation,
  measured safe-viewport exclusions, orthographic Guided scenes, optional low-distortion Explore
  perspective, cancelable camera transitions, callout-aware labels, and one shared three-label
  mobile budget. Host-width recompilation does not replay settled cues; bounded mobile inspectors
  and recoverable hidden filters preserve the scene. Fifteen reviewed EN/JA/zh-CN captures close
  the historical M2/M3/M4 390 px risks.
- M6 replaces route-by-token behavior with a formal persistent-route contract. Authored routes use
  canonical semantic anchors, remain visible before/during/after motion, and render as CSS-pixel
  `Line2` paths with arrowheads and numbered markers. Request/response phases carry independent
  direction and timing. EndpointSlice stays selection evidence rather than a packet hop, while its
  selected Ready endpoint must match the final physical backend. A deterministic sparse obstacle
  planner routes around model and label AABBs and replans moving endpoints without allowing token
  drift.
- M7 migrates all five original lessons to schema v2 and the foundation-first system. Cluster,
  logical ownership, physical placement, control flow, and traffic now use distinct projections;
  every normal step has one primary focus plus localized What changed / Why / Evidence / Takeaway
  teaching. The eight-step manifest story keeps API, reconciliation, scheduling, kubelet, runtime,
  and readiness responsibilities separate. A 10-objective multilingual browser matrix covers 30
  settled and 15 reduced-motion captures.
- M8 publishes seven additional source-verified lessons and makes the public manifest exactly 12
  available lessons followed by 10 honest planned entries. Every lesson has 4–10 compiled,
  trilingual, Evidence-backed steps with one primary focus. The opening step uses the Container's
  factual `image` field to distinguish container packaging from Kubernetes orchestration before
  desired-state recovery. DNS resolution is a persistent client-Pod → kube-dns Service → CoreDNS
  Pod route that is distinct from the later application request. Probe and rolling-update steps
  separately show startup gating, readiness-controlled EndpointSlice membership and traffic,
  new/old ReplicaSet handoff, and a liveness-triggered Container restart that preserves Pod identity.
  The M8 browser matrix covers every lesson at desktop, risk-height, and mobile viewports, plus
  reduced-motion replay for four route objectives.
- M9 promotes Flow Stories to a validated content layer and publishes the external browser request
  and HPA scale-out lessons, bringing the catalog to 14 available / 8 planned. Eight ordered stories
  compile from complete lesson history. External traffic separates public DNS from the physical
  Browser → Gateway data plane → Service → Ready Pod path; Gateway, HTTPRoute, and EndpointSlice
  remain configuration or selection evidence. HPA uses `ceil(2 × 78 / 60) = 3`, changes desired
  replicas only, and then attributes Pod creation, scheduling, runtime start, readiness,
  EndpointSlice publication, and traffic to the responsible controllers and node agents.

- immutable `WorldSnapshot` / `WorldPatch` / `WorldDiff` plus a separate `ViewProjection`;
- fourteen verified foundation-first lessons:
  - Why Kubernetes exists;
  - Cluster, Control Plane and Worker Nodes;
  - Pod and Container;
  - Namespace and Node;
  - Deployment, ReplicaSet and Pods;
  - Manifest to Running Pod;
  - Pending Pod and Scheduling;
  - Container Restart vs Pod Replacement;
  - Labels and Selectors;
  - Service and EndpointSlice;
  - Internal Request and DNS;
  - Probes and Rolling Update;
  - External Browser Request;
  - HPA Scale-out;
- premium teaching visuals, semantic zones, persistent `Line2` routes, canonical semantic anchors,
  deterministic sparse obstacle-aware planning, label collision handling, and desktop/mobile
  teaching shells;
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
  - the NotReady endpoint is not selected for ordinary traffic;
  - EndpointSlice is evidence, never a physical packet hop, and its selected endpoint matches the
    route's final backend;
- DNS lesson:
  - the DNS query/response route is client Pod → kube-dns Service → CoreDNS Pod;
  - the later application request is a separate Client → Service → selected Pod route;
  - neither request treats EndpointSlice as a packet hop;
- probes and rolling update:
  - startup success unlocks liveness/readiness checks without making the Pod Ready by itself;
  - readiness changes EndpointSlice eligibility before traffic shifts to the v2 Pod;
  - the old ReplicaSet shrinks only after the new endpoint becomes Ready;
  - liveness failure changes Container ID and restart count while preserving Pod UID and Node;
- external browser request:
  - public DNS query/response is separate from HTTPS application traffic;
  - the physical application route is Browser → Gateway data plane → Service → selected Ready Pod;
  - Gateway, HTTPRoute, and EndpointSlice are never packet hops;
- HPA scale-out:
  - `ceil(2 × 78 / 60) = 3` produces the new desired replica count;
  - the Pending Pod initially has neither `nodeName` nor `podIP`;
  - scheduling, kubelet/runtime start, readiness, endpoint publication, and traffic remain separate;
- route lifecycle:
  - the persistent wide route, arrowheads, and numbered markers exist before, during, and after
    token motion;
  - normal request/response phases carry validated direction and timing;
  - reduced motion removes moving tokens but retains the complete static path and endpoint evidence.

## Validation

- `pnpm install --frozen-lockfile` — PASS;
- `pnpm format:check` — PASS;
- `pnpm lint` — PASS;
- `pnpm typecheck` — PASS;
- `pnpm content:validate` — PASS (6 v2 scenarios, 81 entities, 98 relations, 14 verified v2
  lessons, 8 planned lessons, 35 terms, 31 official sources);
- `pnpm content:accuracy` — PASS (current-public text scan plus README, visualization, ReplicaSet,
  Pod lifecycle, and Service request invariants);
- `pnpm test:unit -- --run` — PASS (48 files, 345 tests);
- `pnpm build` — PASS;
- `pnpm visual:m2` — PASS (four captures; desktop foundation/island gate passes with 0 measured
  entity-label overlap and 0 labels outside the stage; mobile risk recorded for M5);
- `pnpm visual:m3` — PASS (four captures; 12 deterministic bays, 3 mounted kubelets, 3 mounted
  runtimes, 3 contained Containers, no hierarchy/overlap failures; mobile risk recorded for M5);
- `pnpm visual:m4` — PASS (six captures; eight unique specialized model contracts, Logical and
  Placement separation, dynamic EndpointSlice rows, visible external kubectl, zero generic
  handles, label overlap, or labels outside the stage; mobile composition risk recorded for M5);
- `pnpm visual:m5` — PASS (15 captures; five objectives × three required viewports with EN/JA/zh-CN
  rotation; every 390×844 capture has three visible labels/callouts, lesson scenes measure 49.4vh,
  Pending keeps its `UNSCHEDULED / TRANSIT` heading, “What changed” is fully unobscured, minimum
  scene text is 10 CSS px, the Overview subject fills 48–97% of the safe frame, and horizontal
  overflow / label-callout overlap / safe-frame / complete-foundation violations are 0);
- `pnpm visual:m6` — PASS (9 cases / 36 screenshots; Request A, Request B, and Scheduler binding at
  1440×900, 1280×800, and 390×844 with EN/JA/zh-CN rotation; persistent routes survive all four
  temporal phases; reduced-motion active tokens, obstacle intersections, endpoint drift, off-route
  tokens, route-replan failures, undersized routes, missing arrows, and clipped routes/arrows/markers
  are all 0; maximum measured token-to-route distance is `4.44e-16`);
- `pnpm visual:m7` — PASS (10 objectives / 45 screenshots; all five lessons at 1440×900,
  1280×720/800, and 390×844 with EN/JA/zh-CN rotation; 30 settled and 15 reduced-motion captures;
  scene density, focus, hierarchy, label, teaching, source, persistent-route, and static-readability
  failures are all 0);
- `pnpm visual:m8` — PASS (13 objectives / 51 screenshots; all twelve lessons at 1440×900,
  1280×720/800, and 390×844 with EN/JA/zh-CN rotation; 39 settled and 12 reduced-motion captures;
  comparison, density, focus, hierarchy, label, teaching, source, persistent-route, and
  static-readability failures are all 0);
- `pnpm test:e2e` — PASS; skips are deliberate project/viewport ownership selections;
- 20-cycle fourteen-lesson renderer resource pressure gate — PASS;
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
- M6 route manifest: `docs/review/evidence/m6/m6-route-visual-manifest.json`;
- M8 curriculum manifest: `docs/review/evidence/m8/m8-curriculum-visual-manifest.json`;
- M8 curriculum checklist: `docs/review/M8_CURRICULUM_ACCEPTANCE_CHECKLIST.md`;
- factual and visual checklist: `docs/review/VISUAL_ACCEPTANCE_CHECKLIST.md`;
- Before/After: `docs/review/BEFORE_AFTER.md`;
- architecture: `docs/architecture.md`;
- focused Evidence and comparison crops: `docs/review/screenshots/evidence-*.png` and
  `docs/review/screenshots/comparison-*.png`.

The VPS review site is updated from this PR branch only after the M10 final gates. GitHub Pages
remains sourced from `main`, and merging remains an explicit repository owner decision.
