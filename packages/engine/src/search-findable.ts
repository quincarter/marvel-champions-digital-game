/**
 * What a card's search of the discard pile could find if the player paid with a card from hand: a read-only query for
 * the payment step (#966). "Search your deck and discard pile for a Team-Up card …" (Dynamic Duo) is legal to play with
 * nothing to find (RRG 1.8 "Target", p. 43: a search is not a target), and a card spent to pay is in its owner's
 * discard pile before the effect resolves (RRG 1.8 "Initiating Abilities", p. 24, steps 3 and 5; "Resources", p. 36),
 * so paying with the card the search wants lets the search find it. The engine already resolves that; this tells the
 * client which cards in hand it applies to, so the payment can say so.
 *
 * Only the ability's first card choice over its player's discard pile is read: later choices usually depend on what
 * the first one chose ("an ally named by that card's Team-Up keyword"), and cannot be judged before it. Any deterministic
 * card choice over the discard pile counts, not only text that says "Search" ("choose an ally in your discard pile"):
 * paying with the card it wants is the same advice. Only hand cards are tried; a card spent from under its host
 * (`spendableFromTucked`) is not.
 */
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { createCtx, moveCard } from "./ctx.js";
import type { AbilityId } from "@mc/content";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf, discardZoneFor, getPlayer } from "./query.js";
import { selectCards } from "./resolve/cards.js";
import { flattenEffects } from "./resolve/target-validity.js";
import { printedAbilityRefs, type EffectContext } from "./select.js";
import type { CardSelector, EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";

export interface SearchFindableIfSpent {
  /** Whether the search's first choice has at least one candidate as things stand. True when there is no such search. */
  readonly found: boolean;
  /** Cards in the player's hand (the played card aside) that the choice would find once spent to pay, in hand order. */
  readonly findableIfSpent: readonly InstanceId[];
}

const NOTHING_TO_SAY: SearchFindableIfSpent = { found: true, findableIfSpent: [] };

/** Whether this selector reads a player's discard pile, deterministically (a random pick is no search to hint at). */
function searchesDiscard(selector: CardSelector): boolean {
  switch (selector.kind) {
    case "zone": {
      const zones = typeof selector.zone === "string" ? [selector.zone] : selector.zone;
      return zones.includes("discard") && selector.random === undefined;
    }
    case "anyOf":
      return selector.of.some(searchesDiscard);
    case "atMost":
      return searchesDiscard(selector.of);
    default:
      return false;
  }
}

type CardChoice = Extract<EffectSpec, { kind: "chooseCards" }>;

/** The ability's first `chooseCards` over a player's discard pile, branches and options included, or undefined. */
function firstDiscardSearch(definition: AbilityDefinition): CardChoice | undefined {
  return flattenEffects(definition.effects).find(
    (effect): effect is CardChoice => effect.kind === "chooseCards" && searchesDiscard(effect.from),
  );
}

/**
 * For the card `playerId` is playing (`playedCardInstanceId`): whether its search of the discard pile finds anything
 * now, and which other cards in their hand it would find if spent to pay for it.
 *
 * The ability read is `abilityId` when given, else the first ability printed on an event that has such a search (an
 * event's Action, Interrupt or Response: the text playing it resolves). Any other card, or an ability with no such
 * search, answers `{ found: true, findableIfSpent: [] }`.
 *
 * Pure: each "as if spent" state is a throwaway copy with that one card moved to its discard pile the way a payment
 * moves it; `state` is never changed. Candidates come from `selectCards`, the same reader the choice uses as it
 * resolves (`executeChooseCards`) and as initiation judges it (`choiceCandidates`). The played card itself is never a
 * candidate: it is out of play while it resolves (RRG 1.8 "Event", p. 18).
 */
export function searchFindableIfSpent(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  playedCardInstanceId: InstanceId,
  abilityId?: AbilityId,
): SearchFindableIfSpent {
  const player = getPlayer(state, playerId);
  const card = cardOf(state, playedCardInstanceId);
  if (!player || !card) return NOTHING_TO_SAY;
  let choice: CardChoice | undefined;
  if (abilityId !== undefined) {
    const definition = deps.abilities[abilityId];
    choice = definition ? firstDiscardSearch(definition) : undefined;
  } else if (card.type === "event") {
    for (const ref of printedAbilityRefs(card)) {
      const definition = deps.abilities[ref.id];
      choice = definition ? firstDiscardSearch(definition) : undefined;
      if (choice) break;
    }
  }
  if (!choice) return NOTHING_TO_SAY;
  const search = choice;
  const context: EffectContext = {
    selfInstanceId: playedCardInstanceId,
    controllerId: playerId,
    event: null,
    bindings: {},
    vars: {},
    deps,
  };
  const candidates = (s: GameState): readonly InstanceId[] =>
    selectCards(createCtx(s, deps), search.from, context).filter((id) => id !== playedCardInstanceId);
  const found = candidates(state).length > 0;
  const findableIfSpent = player.hand.filter((id) => {
    if (id === playedCardInstanceId) return false;
    const ctx = createCtx(state, deps);
    moveCard(ctx, id, discardZoneFor(state, id), "top");
    return candidates(ctx.state).includes(id);
  });
  return { found, findableIfSpent };
}
