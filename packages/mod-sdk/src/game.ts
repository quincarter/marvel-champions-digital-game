import type { AnyCard } from "@mc/content";
import type { EngineDeps } from "@mc/engine";
import type { PackInput } from "./validate.js";

/**
 * The engine's deps with a pack's abilities added: what the client does when it wires an installed pack into a game
 * (docs/custom-content-packs.md §7.4), and what a pack's own tests do. A pack ability that shadows one the deps already
 * have is an error (`validatePack` rejects it too), never a silent override.
 */
export function gameDepsWithPack(base: EngineDeps, pack: Pick<PackInput, "abilities">): EngineDeps {
  for (const id of Object.keys(pack.abilities)) {
    if (Object.hasOwn(base.abilities, id)) throw new Error(`pack ability ${id} is already defined by the base game`);
  }
  return { ...base, abilities: { ...base.abilities, ...pack.abilities } };
}

/** The card pool with a pack's cards added, for `GameSetupConfig.cards` / `coreScenario`'s `cardPool`. */
export function cardPoolWithPack(pool: readonly AnyCard[], pack: Pick<PackInput, "cards">): readonly AnyCard[] {
  const known = new Set(pool.map((card) => card.id as string));
  for (const card of pack.cards) {
    if (known.has(card.id as string)) throw new Error(`pack card ${card.id} is already in the pool`);
  }
  return [...pool, ...pack.cards];
}
