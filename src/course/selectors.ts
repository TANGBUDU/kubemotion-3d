import type { EntitySelector } from './types';
import type { WorldEntity, WorldSnapshot } from '../world/types';

/** View-only selectors. Factual WorldPatch operations always require exact IDs. */
export function selectEntities(
  world: WorldSnapshot,
  selector: EntitySelector,
): readonly WorldEntity[] {
  const entities = Object.values(world.entities);
  if ('byIds' in selector) return selector.byIds.flatMap((id) => world.entities[id] ?? []);
  if ('byKind' in selector)
    return entities.filter(
      (entity) =>
        entity.kind === selector.byKind &&
        (!selector.namespace || entity.namespace === selector.namespace),
    );
  if ('byLabel' in selector)
    return entities.filter(
      (entity) =>
        entity.labels?.[selector.byLabel.key] === selector.byLabel.value &&
        (!selector.namespace || entity.namespace === selector.namespace),
    );
  if ('byCategory' in selector)
    return entities.filter((entity) => entity.category === selector.byCategory);
  return entities.filter((entity) => entity.data.nodeName === selector.byNode);
}
