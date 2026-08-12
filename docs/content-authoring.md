# Content authoring

The verified lesson format is schema version 2. Add official sources to `content/sources.yaml`, terms under `content/glossary/`, a validated scenario under `content/scenarios/`, and a lesson under its course directory.

## Step contract

Every available lesson step must define one learning outcome, narration in English/Japanese/Simplified Chinese, source IDs, glossary introduction/use order, a `viewPatch`, and—when facts change—a typed `worldPatch`. Transitions may only reference entities and relations that exist in the correct before/after world.

World operations are explicit:

- `add-entity`, `remove-entity`, `patch-entity`
- `add-relation`, `remove-relation`, `patch-relation`

IDs cannot be patched. Removing an entity requires its relations to be removed in the same transaction. Do not use presentation fields to simulate status, identity, placement, or replica-count changes.

Selectors must match unless `allowEmpty` is explicitly justified. A `comparison` request names compiled steps and must derive its cells from their snapshots.

## Validation

Run:

```sh
pnpm content:validate
pnpm content:accuracy
pnpm test:unit -- --run
pnpm build
pnpm test:e2e
pnpm visual:capture
```

Validation checks schemas, stable IDs, relations, patch transactions, cue references, counter values, source hosts, prerequisite cycles, glossary order, localized fields, and a sensitive/misleading-expression denylist.

`pnpm visual:capture` regenerates the review evidence; it does not approve that evidence.
Human screenshot review against the acceptance checklist remains mandatory.

The four older schema-v1 lesson files remain reference material for planned curriculum. They are not loaded as verified lessons until migrated through the world-state and visual gates.

Never add real company names, internal addresses, cluster names, credentials, Secret values, or real telemetry.
