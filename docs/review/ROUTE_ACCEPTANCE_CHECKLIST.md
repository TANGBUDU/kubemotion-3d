# Foundation-first route acceptance checklist

## Baseline route inventory

The working branch already renders persistent active routes with Three.js wide-line examples. This
is correct work to preserve, not a reason to add another token system.

| Baseline story step   | Persistent handle | Arrowheads | Settled pooled tokens | Static route labels                              | Baseline result      |
| --------------------- | ----------------: | ---------: | --------------------: | ------------------------------------------------ | -------------------- |
| Service Request A     |                 1 |          4 |                     2 | `Request A enters Service`; `select Ready api-a` | PASS for persistence |
| Explicit Pod deletion |                 1 |          1 |                     1 | `request delete`                                 | PASS for persistence |

The compiler rejects routed motion cues whose `routeId` has no active authored route, rejects empty
or discontinuous routes, and validates route endpoints against the before/after world. Renderer
tests lock `Line2`, logical CSS-pixel width, resize resolution, arrowheads, reduced motion, disposal,
and the rule that settled routes remain authoritative.

## Mandatory route gates

Status values below describe the implemented M6 foundation. The executable browser evidence is
produced by `pnpm visual:m6` in `docs/review/evidence/m6/m6-route-visual-manifest.json`.

M6 result: **PASS** — 9 cases / 36 screenshots, three stories, three required viewports, all three
locales, four temporal phases per case, and no recorded failures.

### Route before, during, and after motion

- [x] A persistent route exists before a routed token starts.
- [x] The route remains visible while the token moves.
- [x] Authored persistent routes remain after motion settles.
- [x] Reduced motion keeps the route, arrowheads, markers, and selected endpoint.
- [x] Request and response phases have independent direction, timing, and flow-phase validation.
- [ ] DNS and application routes are present as distinct phases.

### Geometry and direction

- [x] Primary routes use `Line2`/`LineGeometry`/`LineMaterial`.
- [x] Active route width is tested at no less than 4 CSS pixels.
- [x] Material resolution updates when the viewport changes.
- [x] Direction markers and numbered hop markers exist.
- [x] Every required visual exposes the complete semantic-anchor contract.
- [x] Authored primary routes use semantic anchors; route content cannot fall back to `center`.
- [x] The authored anchor vocabulary is restricted to `api-in`, `api-out`, `control`, `network-in`,
      `network-out`, `storage`, `ownership`, `placement`, `local-runtime`, `top`, `bottom`, `left`,
      and `right`.

### Routing correctness

- [x] A packet route does not use Deployment, ReplicaSet, Namespace, or EndpointSlice as a physical
      hop in the verified Service story.
- [x] EndpointSlice appears as endpoint inventory and selection evidence.
- [x] The selected endpoint agrees with the final backend in the verified Service story.
- [x] Routed motion cannot compile without a matching authored route.
- [x] An explicit obstacle map covers primary models and label rectangles.
- [x] The planner uses deterministic sparse rectilinear neighbors and a stable minimum heap instead
      of constructing a dense all-pairs graph.
- [x] Runtime diagnostics and M6 browser gates reject route/entity intersection, endpoint drift,
      undersized active lines, arrowless routes, off-route tokens (maximum distance `0.02`), and
      clipped routes/arrows/markers.
- [ ] Direct navigation and sequential navigation are checked across all new stories.

### Resource and lifecycle behavior

- [x] Route handles, wide-line geometry/material counts, tokens, and arrowheads are observable in
      diagnostics.
- [x] The 20-cycle gate rotates through all five verified lessons and bounds route and renderer resources.
- [x] Changing steps removes obsolete route handles.
- [x] Cancellation restores a settled route state in existing animation tests.
- [ ] The same gates cover all six scene grammars and eight required stories.

## Executable M6 browser evidence

`pnpm visual:m6` checks three authored route stories: Service Request A, the distinct later Service
Request B, and golden scheduler step 7 (`worker-c`). Each story is exercised at 1440x900, 1280x800,
and 390x844, with EN/JA/zh-CN rotated across the nine-case matrix.

The latest manifest is PASS with 9 cases, 36 phase screenshots, and no failures. Normal-motion
replay produced at least 16 samples per case; maximum token-to-route distance was
`4.440892098500626e-16`, with zero off-route tokens, endpoint drift, obstacle intersections, and
replan failures. Reduced-motion replay leased zero tokens in every sample.

For every case the gate records four screenshots and diagnostics:

1. settled: the persistent route, arrows, markers, and endpoint evidence remain while token count is
   zero;
2. during replay: the same route remains authoritative and at least one routed token is leased;
3. after replay: tokens return to zero and the route remains;
4. reduced motion: tokens stay at zero while the route, arrows, numbered markers, and selected
   endpoint evidence remain.

Normal motion uses two independent replays: the first samples the full timeline (including the
scheduler's 560 ms delayed layout interval), and the second captures the during/after screenshots.

The mobile scheduler captures additionally require a visible route label containing `worker-c`.
Because Request B is the final Service step, its replay gate navigates to step 4 and then forward to
step 5; it does not use the header action, which correctly restarts a completed lesson.
Any failed phase is written to the JSON manifest and exits the command with a non-zero status.

## Milestone implications

Milestone 6 is a responsibility and coverage rebuild, not a regression to free-flying tokens. It
preserves the tested wide-line core while delivering a formal route registry, complete semantic
anchors, grammar-owned route policy, obstacle diagnostics, and request/response support. Milestones
7–9 must extend the same executable validation to the migrated curriculum and all eight required
flow stories.
