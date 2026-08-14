# Cloud Strata 3D — Claude handoff

Work only inside this `cloud-strata-3d/` directory unless the user explicitly asks otherwise. Do not modify the parent KubeMotion project.

## Goal

Build a public, editable AWS architecture builder where **3D is semantic, not decorative**.

The core idea is the same as KubeMotion's physical hierarchy: a Node contains Pod bays and a Pod contains Containers. For AWS, containment itself must communicate architecture:

`AWS Account → Region → VPC → Availability Zone → Subnet → Service / resource`

A user should still understand ownership/placement after every traffic line is hidden.

## Hard design rules

1. Do not regress into a 2D node-link diagram rendered at an isometric angle.
2. Parent scopes must be visible 3D chassis/trays/shells with children physically inside them.
3. Children must use coordinates relative to their parent scope or an equivalent explicit containment model.
4. `Explode` may separate hierarchy levels vertically for explanation, but must never change logical ownership.
5. Traffic, event, identity, telemetry, and dependency lines are secondary overlays. The structure must remain readable without them.
6. Global/edge services such as Route 53 or CloudFront must not be falsely placed inside a Subnet.
7. Regional services that are not Subnet resources need a distinct regional placement model instead of being forced into VPC bays.
8. Multi-AZ placement should be visually obvious from geometry, not only labels.
9. Keep this public-safe. Do not add any internal company architecture, screenshots, names, endpoints, identifiers, or data.
10. No email, Gmail, SMTP, SES notification, telemetry, analytics, or failure-notification behavior.

## Current prototype

Entry file: `index.html`

Current public deployment:
`https://cloud-strata-3d-tangbudu-7091s-projects.vercel.app`

The current prototype is intentionally small. It proves the containment model with Account, Region, VPC, two AZ chassis, subnet bays, services, an explode view, and a traffic overlay.

## What to improve next

Prioritize the foundation before adding lots of AWS icons:

- refactor the single-file prototype into maintainable modules if useful;
- create a typed resource/scope model rather than hard-coded coordinates;
- implement parent-aware placement and reusable bay/slot allocation;
- distinguish global, regional, VPC, AZ, subnet, and resource scopes accurately;
- make adding/removing resources actually modify the hierarchy model;
- support drag/drop into valid parent scopes, rejecting invalid placements;
- add selection/focus that can isolate one containment path;
- preserve Structure / Explode / Traffic as separate semantic views;
- improve real 3D camera, occlusion, labels, and depth readability;
- keep desktop and mobile usable;
- add deterministic validation tests for containment and invalid placements;
- only after the hierarchy engine is solid, expand service catalog and import/export.

## Reference inside the parent repository

KubeMotion's hierarchy implementation is useful as a design reference, especially:

- `src/renderer/LayoutEngine.ts`
- `src/renderer/design/dimensions.ts`
- `src/world/types.ts`
- `src/renderer/SceneController.ts`

Reuse principles, not Kubernetes-specific code or concepts blindly.

## Acceptance test

Before calling a version done, hide all relation/traffic lines and ask:

> Can a first-time viewer identify Account → Region → VPC → AZ → Subnet → Service purely from the 3D spatial structure?

If the answer is no, the 3D model is not doing its job yet.
