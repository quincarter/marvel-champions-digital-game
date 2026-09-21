/**
 * The Rules overlay's "Card list" tab (docs/phase4-screen-gaps.md §3 "W4"; owner feedback
 * 2026-09-18 asked for real card art here, not a name-only text dump — see `scenes/rules.ts`'s
 * own header for the redesign this belongs to).
 *
 * Every encounter set the app's pool knows, grouped and sorted so the sets touching the *live*
 * game (when there is one) read first, each with its own real card list — populated from every
 * *instance* actually in the game (`state.instances`) when the set is one of those, the static
 * pool otherwise, so every set is always browsable even before or without a game.
 *
 * **Not `game.cardPool`, on purpose.** `view/scenario-card-list.ts` (S4/W4's original, name-only
 * list still used by Pause's own "Scenario card list" count) reads `Object.values(game.cardPool)`
 * on the assumption — stated in its own doc comment — that it's "the exact card pool `createGame`
 * already assembled for this scenario". That's only true for a scenario built with `cardPool:
 * CORE_CARDS`; `wave1Scenario` (the app's own scenario builder, `content/pool.ts`) always passes
 * `cardPool: WAVE1_CARDS` — *every* wave 1 card, not this scenario's own subset (`packages/cards/
 * src/wave1/setup.ts`'s own doc comment: "so a wave 1 deck ... could sit at a Core scenario"), so
 * `game.cardPool` is the *whole app pool* for every game, and reading it here would make "IN THIS
 * GAME" mean "in the pool" for literally every set — the same split this tab exists to draw. This
 * module reads `state.instances` instead: `createGame` only ever creates an instance for a card it
 * actually shuffled into a deck, dealt to a villain, or set aside for this scenario/modular
 * sets/heroes' obligations and nemesis sets, so the *sets those instances' cards belong to* are
 * this game's own, and nothing else's.
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
  /** True when some instance of this set actually exists in the live game — false with no game at all. */
  readonly inGame: boolean;
  /** Unique cards in this set, alphabetical — a reference list, not a decklist (no multiplicity). */
  readonly cards: readonly RulesCardListCard[];
}

function uniqueCardsOf(cards: Iterable<AnyCard>): readonly RulesCardListCard[] {
  const byId = new Map<string, RulesCardListCard>();
  for (const card of cards)
    if (!byId.has(card.id as string)) byId.set(card.id as string, { cardId: card.id as string, name: card.name });
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Every card in the static `pool` naming `setId` among its own `encounterSetIds`. */
function poolCardsForSet(pool: readonly AnyCard[], setId: string): readonly RulesCardListCard[] {
  return uniqueCardsOf(
    pool.filter((card) => "encounterSetIds" in card && (card.encounterSetIds as readonly string[]).includes(setId)),
  );
}

/** Every encounter-side card with at least one real instance in `game` right now (any zone — deck, discard, in play, set-aside), grouped by each of its own printed `encounterSetIds`. */
function inGameCardsBySet(game: GameState): ReadonlyMap<string, AnyCard[]> {
  const bySet = new Map<string, AnyCard[]>();
  for (const instance of Object.values(game.instances)) {
    const card = game.cardPool[instance.cardId];
    if (!card || !("encounterSetIds" in card)) continue;
    for (const setId of card.encounterSetIds as readonly string[]) {
      const list = bySet.get(setId) ?? [];
      list.push(card);
      bySet.set(setId, list);
    }
  }
  return bySet;
}

/**
 * Every encounter set the pool knows, `game`'s own sets first (populated from its live
 * instances) sorted by name, then every other set (populated from the static `pool`) sorted by
 * name — matching the task's "IN THIS GAME" / "NOT IN THIS GAME" split. With no game, every set is
 * `inGame: false` and there is only the one sorted list (nothing to split).
 */
export function rulesCardListOf(
  game: GameState | null,
  pool: readonly AnyCard[],
  encounterSets: readonly EncounterSet[],
): readonly RulesCardListGroup[] {
  const inGameCards = game ? inGameCardsBySet(game) : new Map<string, AnyCard[]>();

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
