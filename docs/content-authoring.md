# Content authoring

Add sources to `content/sources.yaml`, glossary terms under `content/glossary/`, and lessons under the course directory. All localized fields require English, Japanese, and Simplified Chinese. First use of a term must introduce it in that step or rely on an earlier prerequisite lesson.

Each step must have one main learning point and a complete projection patch. Selectors must match at least one entity unless an explicitly justified empty match is allowed. Use flow cues only for entities whose domain semantics permit that path. Never place Deployment, ReplicaSet, or HTTPRoute in an application packet path.

Run `pnpm content:validate` before committing. Do not add real company names, internal addresses, cluster names, credentials, or Secret values.
