# Foundation-first current-state findings

## Authority and baseline

- Rejected visual reference: [`before-after/current-overview.png`](./before-after/current-overview.png).
- Reference SHA-256: `701a248d077afd235242875e3235239ddf05f1dbff105439a2085ac8f9f40941`.
- Working-branch baseline: `bdcc5f92e61ff3e9bcee2c5048a0dbc87c19e0c4`.
- Latest fetched `origin/main`: `c515f8a06f37c96e50236ed3e975d5ce0ac9d12f`.
- The working branch is 34 commits ahead and 0 commits behind that `main` baseline.

The supplied reference is evidence of a rejected composition. It is not an approved visual
baseline and must not be used as a screenshot-diff target.

## Curriculum truth

The course manifest contains 22 entries, but the baseline branch has exactly **2 available** and
**20 planned** entries:

1. `service-routes-to-pods`;
2. `container-restart-vs-pod-replacement`.

Three additional authored YAML files exist for cluster overview, Pod/placement, and manifest to
running Pod, but they are not loaded as verified lessons and remain planned. The new directive's
statement that the starting release has five available lessons does not match this repository
state. All rebuild reporting and gates use the measured count of two; planned content will not be
relabeled to manufacture a higher count.

## Rejected-reference findings

The supplied screenshot fails the new five-second comprehension gate because it presents logical
scope, control-plane components, workload ownership, runtime placement, Services, endpoints,
external actors, and several relation families at comparable priority. The dominant symptoms are:

- no single mental model or primary focus;
- similarly colored object silhouettes;
- overlapping translucent regions;
- dense labels competing with the models;
- relation crossings without a clear active story;
- weak Node → Pod → Container containment;
- no static-readable application route that dominates the composition.

## Current branch measurements

`pnpm visual:baseline` records the repeatable measurements in
[`foundation-baseline-manifest.json`](./before-after/foundation-baseline-manifest.json).

| Capture                       | Entity handles | Entity labels | Layout labels | Relation handles | Active routes | Arrowheads | Settled tokens |
| ----------------------------- | -------------: | ------------: | ------------: | ---------------: | ------------: | ---------: | -------------: |
| Explore Overview              |             17 |             7 |             4 |               17 |             0 |          0 |              0 |
| Service entry                 |              6 |             5 |             3 |                7 |             0 |          0 |              0 |
| Service Request A settled     |              6 |             6 |             3 |                8 |             1 |          4 |       2 pooled |
| Restart/replacement entry     |             16 |             7 |             4 |               10 |             0 |          0 |              0 |
| Explicit-delete route settled |             15 |             7 |             4 |                6 |             1 |          2 |       1 pooled |

All five branch captures measured zero label-to-label overlap and zero labels outside the scene.
Those useful protections remain in force, but they do not make the new foundation, hierarchy, or
scene-grammar gates pass.

## Correct work to preserve

The branch is materially ahead of the rejected reference and already has several correct systems:

- immutable world snapshots and separate projections;
- fixed teaching, evidence, takeaway, and source UI;
- deterministic direct navigation and replay;
- `Line2`-based persistent active routes with CSS-pixel widths and resize handling;
- route-linked motion tokens rather than an unvalidated free-position list;
- arrowheads, numbered route markers, reduced-motion persistence, and resource diagnostics;
- label budgets with stable collision resolution;
- correct Container restart, Pod replacement, Service, and endpoint-readiness semantics;
- English, Japanese, and Simplified Chinese content for the two verified lessons.

The claim that this exact branch has only a moving sphere and no visible route is therefore false:
the baseline Service route has one persistent wide-line handle and four arrowheads after playback.
The rebuild must preserve that behavior while moving route authorship, anchors, obstacle policies,
and view selection into the new formal architecture.

## Remaining structural failures

1. `CourseEngine` begins from a projection in which the whole world is visible, so guided content
   depends on every lesson author remembering to hide unrelated objects.
2. Overview, Logical, and Control Flow currently share the Placement layout implementation instead
   of using independent scene grammars and layout algorithms.
3. Explore enters a 17-entity, 17-relation composition that still reads as a graph inspector.
4. Density diagnostics do not distinguish primary from secondary entities or relation families.
5. The stage has useful zones and chassis-like forms, but no formal Cluster Foundation contract,
   deterministic Pod-bay containment gate, or semantic-island acceptance model.
6. Visual construction remains too centralized; the required dedicated object modules and fallback
   boundary are incomplete.
7. Only two lessons satisfy the current verified-content contract; the required core curriculum is
   not available.
8. Only parts of the eight mandatory flow stories exist.

## Baseline artifacts

- supplied rejected overview: `current-overview.png`;
- branch Explore baseline: `branch-before-explore-overview-1440x900.png`;
- branch Service entry and route baseline;
- branch restart/replacement entry and route baseline;
- machine-readable measurements: `foundation-baseline-manifest.json`.

Milestone 0 accepts these only as evidence of the starting state. Every new visual approval must be
based on the foundation-first human and automated gates.
