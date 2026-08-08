# Scene grammars

Scene grammars are the mandatory projection boundary between an authored lesson or Explore query
and the renderer. A scenario may contain a complete synthetic cluster, but that does not make every
entity part of every scene.

The registry lives in `src/renderer/scene-grammar/`. Each of the six `ViewMode` values resolves to
one independent grammar contract:

| View         | Teaching purpose                                              | Default primary structure                                                                                       | Default exclusions                                                                             |
| ------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Overview     | Establish the cluster boundary and its major responsibilities | Cluster, API Server, etcd, scheduler, controller manager, up to three Nodes, and up to four representative Pods | Workload controllers, network API objects, Containers, browser, and Node-local detail          |
| Logical      | Explain Namespace scope and desired-state ownership           | Namespace, Deployment, ReplicaSet, and Pod identities                                                           | Full Node chassis and runtime modules                                                          |
| Placement    | Explain Node → Pod → Container and Pending placement          | Node chassis, Pod bays, Containers, kubelet, and runtime context                                                | Workload controllers, network objects, Namespace cards, and unrelated control-plane components |
| Control Flow | Explain one API-mediated causal chain                         | Actor, API Server, one relevant control component, bounded workload context, and at most two Nodes              | Unrelated peer chains and network objects                                                      |
| Traffic      | Explain a statically readable application request             | Client, Service, EndpointSlice evidence, selected backend, and bounded peers                                    | Controllers, etcd, workload ownership objects, and unrelated network objects                   |
| Storage      | Explain mount and persistence relationships                   | Pod, Container, PVC, PV, and storage backend                                                                    | Unrelated control-plane and network objects                                                    |

The current milestone establishes the contracts and safety policy. Foundation geometry, distinct
layout algorithms, model completion, responsive replanning, and authored-course migration are
delivered by their later rebuild milestones; a grammar's declared layout, camera, aggregation, and
separation policies are not claims that those later visual systems are already complete.

## Effective scene plan

`createEffectiveScenePlan(world, authoredProjection, options)` returns a deterministic
`EffectiveScenePlan`. The plan contains:

- the grammar and viewport profile;
- a grammar-safe `ViewProjection`;
- primary and secondary entity IDs;
- visible relation IDs and semantic families;
- explicit reasons for every entity hidden by policy;
- the selected layout, camera, zone, separation, aggregation, and density contracts.

Unknown or disallowed kinds fail closed. A direct Explore filter match may use the explicit
`allowFocusedKindOverride` option as bounded detail-on-demand; guided lessons do not receive this
override.

The policy order is deterministic:

1. preserve active-route participants and authored focus/callout context;
2. apply the grammar allowlist and default-hidden policy;
3. rank by protected context, authored emphasis, kind priority, and stable entity ID;
4. apply per-kind and primary/secondary limits;
5. enforce physical parent closure where that view represents containment;
6. cap focus, labels, and relation families;
7. hide every relation whose endpoints are not both visible.

An active route with a semantic that the selected grammar forbids, a transient route where the
grammar requires persistence, or a current-world endpoint removed by density policy is a compile
error. A deletion route may still end at the explicit exiting object in `beforeWorld`; the renderer
keeps that target only for the authored exit transition instead of restoring the entire old scene.

## Density profiles

The directive ceilings remain hard upper bounds, while each grammar uses a narrower profile suited
to its teaching purpose.

| View         | Desktop primary / secondary | Mobile primary / secondary |
| ------------ | --------------------------: | -------------------------: |
| Overview     |                       9 / 4 |                      7 / 1 |
| Logical      |                       8 / 4 |                      5 / 2 |
| Placement    |                      11 / 6 |                      6 / 2 |
| Control Flow |                       9 / 4 |                      7 / 2 |
| Traffic      |                       5 / 5 |                      4 / 2 |
| Storage      |                       5 / 3 |                      5 / 1 |

Desktop never exceeds seven entity labels, three relation labels, three focused entities, six
tokens, or two persistent relation families plus the active teaching route. Mobile never exceeds
three entity labels, one relation label, two focused entities, or two relation families. Individual
grammars lower those ceilings further where the explanation needs less context.

Mobile budgets are part of the pure planning API and its deterministic tests. Viewport-driven
renderer replanning and peer aggregation are intentionally tracked under the responsive-layout
milestone; until then, compiled guided projections use the desktop profile and the existing label
manager still applies its mobile screen-space label limit.

## Hierarchy and relation rules

- A visible Container cannot remain without its visible Pod.
- Placement and Control Flow cannot show a scheduled Pod without its visible Node context.
- Logical and Traffic views do not pull in full Node chassis merely because a Pod has a Node.
- A persistent relation is visible only when both endpoints survive the grammar.
- Focused relation families outrank dimmed background families before the two-family cap is
  applied.
- Traffic permits EndpointSlice configuration and endpoint-membership evidence, while the active
  request route remains a separate client → Service → selected backend path.

These rules are exercised by pure grammar tests and by a guided safety test that compiles every
available step. The rejected universal Overview remains in `docs/review/before-after/` only as
historical evidence.
