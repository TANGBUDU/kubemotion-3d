# Foundation-first route acceptance checklist

## Baseline route inventory

The working branch already renders persistent active routes with Three.js wide-line examples. This
is correct work to preserve, not a reason to add another token system.

| Baseline story step   | Persistent handle | Arrowheads | Settled pooled tokens | Static route labels                              | Baseline result      |
| --------------------- | ----------------: | ---------: | --------------------: | ------------------------------------------------ | -------------------- |
| Service Request A     |                 1 |          4 |                     2 | `Request A enters Service`; `select Ready api-a` | PASS for persistence |
| Explicit Pod deletion |                 1 |          2 |                     1 | `request delete`; `delete Pod object`            | PASS for persistence |

The compiler rejects routed motion cues whose `routeId` has no active authored route, rejects empty
or discontinuous routes, and validates route endpoints against the before/after world. Renderer
tests lock `Line2`, logical CSS-pixel width, resize resolution, arrowheads, reduced motion, disposal,
and the rule that settled routes remain authoritative.

## Mandatory route gates

Status values below describe the baseline, not the final rebuild.

### Route before, during, and after motion

- [x] A persistent route exists before a routed token starts.
- [x] The route remains visible while the token moves.
- [x] Authored persistent routes remain after motion settles.
- [x] Reduced motion keeps the route, arrowheads, markers, and selected endpoint.
- [ ] Request and response phases are modeled independently where required.
- [ ] DNS and application routes are present as distinct phases.

### Geometry and direction

- [x] Primary routes use `Line2`/`LineGeometry`/`LineMaterial`.
- [x] Active route width is tested at no less than 4 CSS pixels.
- [x] Material resolution updates when the viewport changes.
- [x] Direction markers and numbered hop markers exist.
- [ ] Every required visual exposes the complete semantic-anchor contract.
- [ ] Route anchors avoid center-to-center fallback for every primary story.

### Routing correctness

- [x] A packet route does not use Deployment, ReplicaSet, Namespace, or EndpointSlice as a physical
      hop in the verified Service story.
- [x] EndpointSlice appears as endpoint inventory and selection evidence.
- [x] The selected endpoint agrees with the final backend in the verified Service story.
- [x] Routed motion cannot compile without a matching authored route.
- [ ] An explicit obstacle map covers primary models and label rectangles.
- [ ] Automated gates reject route/entity intersection and clipped arrowheads.
- [ ] Direct navigation and sequential navigation are checked across all new stories.

### Resource and lifecycle behavior

- [x] Route handles, wide-line geometry/material counts, tokens, and arrowheads are observable in
      diagnostics.
- [x] Existing 20-cycle tests bound route and renderer resources for the two verified lessons.
- [x] Changing steps removes obsolete route handles.
- [x] Cancellation restores a settled route state in existing animation tests.
- [ ] The same gates cover all six scene grammars and eight required stories.

## Milestone implications

Milestone 6 is a responsibility and coverage rebuild, not a regression to free-flying tokens. It
must preserve the tested wide-line core while introducing a formal route registry, complete
semantic anchors, grammar-owned route policy, obstacle diagnostics, request/response support, and
validation across the expanded curriculum.
