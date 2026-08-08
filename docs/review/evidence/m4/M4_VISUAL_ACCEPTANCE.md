# M4 visual acceptance

Milestone 4 establishes dedicated logical Kubernetes object models without reusing the physical
Node/Pod scene as a universal layout. The executable evidence is `pnpm visual:m4`; its machine
results are recorded in `m4-logical-models-manifest.json`.

Final result: **PASS** for the M4 desktop gate. The 390×844 capture is deliberately recorded as a
non-blocking M5 responsive-layout risk rather than reported as an M4 pass.

## Automated gates

- No captured scene may require a generic fallback visual.
- Every visible scene label, including layout and route labels, must have zero screen-space overlap
  and remain inside the scene viewport.
- Logical view must show exactly one Namespace, one Deployment, one ReplicaSet, and three Pods,
  with zero Nodes or Node-local runtime modules.
- Placement view must show zero Namespace, Deployment, or ReplicaSet objects.
- The EndpointSlice inventory must create one row per endpoint, grow from three to five rows without
  replacing the original rows, and select the backend referenced by the active request route.
- The application request route must not contain EndpointSlice as a hop.
- Namespace, Deployment, ReplicaSet, Service, EndpointSlice, kubectl, Browser, and Developer must
  each resolve to a specialized, unique `visualKind` and a unique required-role signature.
- Browser and Developer role signatures must not contain Pod shell or Container-slot roles.

## Capture matrix

| Evidence                                 | Viewport | Objective                                                          | Automated status | Human status     |
| ---------------------------------------- | -------: | ------------------------------------------------------------------ | ---------------- | ---------------- |
| `m4-logical-objects-1440x900.png`        | 1440×900 | Namespace → Deployment → ReplicaSet → Pods                         | PASS             | PASS             |
| `m4-logical-objects-1280x720.png`        | 1280×720 | Compact desktop logical readability                                | PASS             | PASS             |
| `m4-logical-vs-placement-1280x720.png`   | 1280×720 | Physical placement excludes logical controllers                    | PASS             | PASS             |
| `m4-traffic-models-1440x900.png`         | 1440×900 | Service portal, dynamic EndpointSlice rows, selected backend route | PASS             | PASS             |
| `m4-external-control-actor-1280x720.png` | 1280×720 | kubectl is an external control actor, not a Pod                    | PASS             | PASS             |
| `m4-logical-objects-390x844.png`         |  390×844 | Record responsive composition before M5                            | RECORDED         | M5 RISK RECORDED |

## Human model checklist

- [x] Namespace reads as a shallow logical workspace, not a physical host.
- [x] Deployment reads as a blueprint and remains distinct from the ReplicaSet counter card.
- [x] ReplicaSet, Service, and EndpointSlice have distinguishable silhouettes before reading labels.
- [x] EndpointSlice visibly presents endpoint rows, conditions, and the selected backend.
- [x] kubectl remains outside the Control Plane Island, has clear separation from the API Server,
      and does not resemble a Pod.
- [x] Logical ownership and physical placement are not conflated.
- [x] The palette uses neutral surfaces plus restrained semantic accents rather than uniform green.
- [x] The mobile screenshot records, rather than conceals, the composition issue owned by M5.

## Final execution

The final capture was produced after a clean `pnpm build` followed by `pnpm visual:m4`. The build
validated 2 v2 scenarios, 32 entities, 34 relations, 2 verified lessons, 20 planned lessons, 26
terms, and 29 official sources. Content accuracy scanned 227 current-public text files and guarded
30 forbidden patterns.

All six captures reported zero generic visual handles, zero visible-label overlaps, and zero labels
outside the scene viewport. The desktop captures passed their semantic and rendered-scene gates;
the mobile capture retained `recorded` status. The model audit found eight specialized models with
eight unique visual kinds and eight unique role signatures. The EndpointSlice audit expanded from
three to five rows while preserving the original rows, and the request route did not use
EndpointSlice as a traffic hop.

## Deferred to M5

The mobile capture is intentionally non-blocking for M4. Explore currently gives its filter controls
substantial vertical space at 390×844, and the wide logical chain can become small below them. M5
owns mobile density, camera safe frames, teaching-sheet composition, and three-locale responsive
label review.
