/**
 * The Rules overlay's "Card list" tab (docs/phase4-screen-gaps.md §3 "W4"; owner feedback
 * 2026-09-18 asked for real card art here, not a name-only text dump — see `scenes/rules.ts`'s
 * own header for the redesign this belongs to).
 *
 * Every encounter set the app's pool knows, grouped and sorted so the sets touching the *live*
 * game (when there is one) read first, each with its own real card list — the running game's own
 * `cardPool` when it names the set (exactly what `createGame` actually built for this scenario,
 * difficulty, modular sets and heroes' obligations/nemesis sets), the static pool otherwise, so
 * every set is always browsable even before or without a game. `view/scenario-card-list.ts`
 * (S4/W4's original, name-only list still used by Pause's own "Scenario card list" count) is left
 * alone; this is a separate, richer model built for the full-screen grid.
 */
import type { AnyCard, EncounterSet } from "@mc/content";
import type { GameState } from "@mc/engine";

export interface RulesCardListCard {
  readonly cardId: string;
  readonly name: string;
}

export interface RulesCardListGroup {
  readonly setId: string;
  readonly setName: string;
  /** True when this set is part of the live game's own `cardPool` — false with no game at all. */
  readonly inGame: boolean;
  /** Unique cards in this set, alphabetical — a reference list, not a decklist (no multiplicity). */
  readonly cards: readonly RulesCardListCard[];
}

function uniqueCardsOf(cards: Iterable<AnyCard>): readonly RulesCardListCard[] {
  const byId = new Map<string, RulesCardListCard>();
  for (const card of cards) if (!byId.has(card.id as string)) byId.set(card.id as string, { cardId: card.id as string, name: card.name });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every card in the static `pool` naming `setId` among its own `encounterSetIds`. */
function poolCardsForSet(pool: readonly AnyCard[], setId: string): readonly RulesCardListCard[] {
  return uniqueCardsOf(pool.filter((card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)));
}

/**
 * Every encounter set the pool knows, `game`'s own sets first (each populated from its live
 * `cardPool`) sorted by name, then every other set (populated from the static `pool`) sorted by
 * name — matching the task's "IN THIS GAME" / "NOT IN THIS GAME" split. With no game, every set is
 * `inGame: false` and there is only the one sorted list (nothing to split).
 */
export function rulesCardListOf(game: GameState | null, pool: readonly AnyCard[], encounterSets: readonly EncounterSet[]): readonly RulesCardListGroup[] {
  const inGameCards = new Map<string, AnyCard[]>();
  if (game) {
    for (const card of Object.values(game.cardPool)) {
      if (!("encounterSetIds" in card)) continue;
      for (const setId of card.encounterSetIds as readonly string[]) {
        const list = inGameCards.get(setId) ?? [];
        list.push(card);
        inGameCards.set(setId, list);
      }
    }
  }

  const inGame: RulesCardListGroup[] = [];
  const notInGame: RulesCardListGroup[] = [];
  for (const set of encounterSets) {
    const setId = set.id as string;
    const live = inGameCards.get(setId);
    if (live) inGame.push({ setId, setName: set.name, inGame: true, cards: uniqueCardsOf(live) });
    else notInGame.push({ setId, setName: set.name, inGame: false, cards: poolCardsForSet(pool, setId) });
  }
  const byName = (a: RulesCardListGroup, b: RulesCardListGroup): number => a.setName.localeCompare(b.setName);
  return [...inGame.sort(byName), ...notInGame.filter((group) => group.cards.length > 0).sort(byName)];
}
