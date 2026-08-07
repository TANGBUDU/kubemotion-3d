# Architecture

```text
YAML content
  → Zod validation
  → ClusterGraph / CompiledLesson
  → SceneProjection
  → SceneController diff
  → Three.js objects
```

Content is plain YAML and crosses one runtime validation boundary. `ClusterGraph` builds normalized indexes and rejects invalid ownership, placement, and references before rendering. `CourseEngine` is a deterministic, DOM-free compiler that produces one complete projection per step.

React owns routing, localization, panels, and serializable Zustand state. It does not store `Object3D`, renderer resources, DOM nodes, promises, maps, or cancellation tokens. `SceneViewport` creates one `SceneController`, sends structured updates, and destroys it on unmount. This boundary prevents StrictMode remounts and language changes from duplicating scene resources.

Steps use pure projections instead of imperative scene commands because deep links, Back, arbitrary jumps, reloads, and replay must produce the same final scene. A transition is a cancellable explanation between projections; it never mutates the compiled projection.

The renderer diffs entity visibility and state, reuses geometry and material catalogs, calculates deterministic layouts, renders on demand, and pools flow tokens. Diagnostics are regression signals, not a proof of total GPU memory use.
