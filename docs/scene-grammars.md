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

Milestone 1 established these contracts and the safety policy. Milestone 2 implemented the shared
bounded foundation and the Overview/Control Flow semantic-island layouts. Runtime-hierarchy model
completion, full logical-model completion, responsive replanning, and authored-course migration
remain owned by their later rebuild milestones; a grammar's declared camera, aggregation, or
separation policy is not a claim that those later systems are already complete.

## Foundation ownership and layout independence

All six grammars render on one `SceneStage` foundation, but the foundation is not a universal scene
layout. Ownership is explicit:

- `SceneStage` owns one bounded base and local alignment marks. It owns no semantic-island plates.
- the selected view layout produces semantic-island bounds, slots, and labels;
- `SceneRegistry` owns and diffs the resulting island plates and unscheduled tray;
- the Cluster entity renders only a compact boundary plaque, never a duplicate floor.

Overview no longer inherits Placement geometry. Its deterministic layout separates
`control-plane-island`, `worker-nodes-island`, and `unscheduled-transit-lane`, seats scheduled Pods
inside Node bays, and leaves Pending Pods parentless in the transit lane. The three islands must be
pairwise non-overlapping and remain inside the bounded stage.

Control Flow is also an independent grammar and semantic composition. It may start with the proven
physical allocation of Node/Pod context, but it projects only the entities needed for one causal
chain into control-plane, workload/transit, and worker-node island families. It is not Overview with
different coordinates and it is not the Placement allowlist with extra control-plane objects.

The Overview etcd model has one permitted basic relation: API Server → etcd. No controller,
scheduler, kubelet, external client, or application request connects directly to etcd in this basic
teaching projection.

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
manager still applies its mobile screen-space label limit. The M2 390×844 foundation capture is
therefore recorded as a known readability failure owned by M5, not as evidence that the desktop
composition is automatically responsive.

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
