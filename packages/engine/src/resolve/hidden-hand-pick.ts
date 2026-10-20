/**
 * `EffectSpec chooseCards.hiddenHands` (owner answer 211, docs/phase7-wave11-scenarios.md §4.1): the first player
 * selects among tied cards in another player's hand (RRG 1.8 "First Player", p. 19) without that hand being revealed
 * (p. 42, "Table Talk": players are not required to disclose the cards in their hand). Such a card is offered facedown:
 * its option id (`facedownOptionId`) and label give the owner and a position in hand order, its `ref` is
 * `facedownCard`, and nothing in the option names the card or its instance. The facedown cards are offered in an order
 * shuffled with the game's seeded RNG (`offerOrder`), not in hand order, which could tell a card apart (one returned to
 * hand in view of the table is last). The candidates as offered are kept in the effects frame under
 * `offeredSlotOf(slot)`, so the answer maps back to the instances without re-reading the hand, and a replay offers the
 * same order.
 *
 * **Redaction.** While the choice is open, that binding holds the facedown candidates' instance ids in the stack
 * (`GameState.stack`, frame `bindings`). The state is table-wide today; a future per-seat redaction of the state (a
 * server that does not send a viewer what they may not see) must strip frame bindings too, not only hands and options.
 */

import { facedownOptionId, type ChoiceOption } from "../choices.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { locateCard } from "../query.js";
import { shuffle, type RngState } from "../rng.js";
import type { GameState } from "../state.js";

/** The frame binding that holds a hidden pick's candidates, in the order their options were offered. */
export const offeredSlotOf = (slot: string): string => `${slot}#offered`;

/** The card is in a hand that is not `chooser`'s: offered facedown. */
const hiddenFrom = (state: GameState, chooser: PlayerId, id: InstanceId): boolean => {
  const zone = locateCard(state, id);
  return zone?.kind === "hand" && zone.playerId !== chooser;
};

/**
 * The order a hidden-hand pick offers its candidates in: the cards the chooser may see first, in their order, then the
 * facedown cards shuffled with `rng` (RRG 1.8 p. 42: the hand is not revealed, its order included). Returns the RNG
 * state after the shuffle; with fewer than two facedown cards nothing is drawn from it.
 */
export function offerOrder(
  state: GameState,
  chooser: PlayerId,
  candidates: readonly InstanceId[],
  rng: RngState,
): readonly [readonly InstanceId[], RngState] {
  const hidden = candidates.filter((id) => hiddenFrom(state, chooser, id));
  const shown = candidates.filter((id) => !hiddenFrom(state, chooser, id));
  if (hidden.length < 2) return [[...shown, ...hidden], rng];
  const [mixed, next] = shuffle(hidden, rng);
  return [[...shown, ...mixed], next];
}

/**
 * The options of a hidden-hand pick, one per candidate in order: facedown for a card in a hand that is not
 * `chooser`'s, `asCard` otherwise.
 */
export function hiddenHandOptions(
  state: GameState,
  chooser: PlayerId,
  candidates: readonly InstanceId[],
  asCard: (id: InstanceId) => ChoiceOption,
): readonly ChoiceOption[] {
  const seen = new Map<PlayerId, number>();
  return candidates.map((id) => {
    const zone = locateCard(state, id);
    if (zone?.kind !== "hand" || zone.playerId === chooser) return asCard(id);
    const owner = zone.playerId;
    const n = (seen.get(owner) ?? 0) + 1;
    seen.set(owner, n);
    return {
      optionId: facedownOptionId(owner, n),
      label: `Facedown card ${n} from ${owner}'s hand`,
      ref: { kind: "facedownCard", ownerId: owner },
    };
  });
}

/** True when some option is offered facedown. */
export const anyFacedown = (options: readonly ChoiceOption[]): boolean =>
  options.some((option) => option.ref.kind === "facedownCard");

/** The instances an answer selected: option `i` of `options` is `offered[i]`. An unknown id selects nothing. */
export function pickedInstances(
  options: readonly ChoiceOption[],
  offered: readonly InstanceId[],
  answer: readonly string[],
): InstanceId[] {
  return answer.flatMap((optionId) => {
    const at = options.findIndex((option) => option.optionId === optionId);
    const id = at >= 0 ? offered[at] : undefined;
    return id ? [id] : [];
  });
}
