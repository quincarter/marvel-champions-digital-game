import type { AbilityRegistry, TargetRef } from "@mc/engine";
import {
  action,
  chooseCards,
  chosen,
  constant,
  deckDiscardIconsCount,
  defineAbilities,
  oncePerRound,
  swapCards,
  topOfDeck,
  you,
  zone,
} from "../../../dsl/index.js";

/** "Choose a card in your hand" (min 1, max 1): the card that goes onto the deck or discard pile. */
const chooseFromHand = chooseCards("handCard", zone("hand", you), { min: 1, max: 1 });

/**
 * Domino / Neena Thurman (40037a/b): docs/phase7-wave7.md §7.1, §3.56, §3.57, §4.2 Q12.
 *
 * - **Domino (40037a), constant**: "When counting resources on cards discarded from the top of your deck, count each
 *   printed [wild] icon twice." `deckDiscardIconCount`, a rule of the hero face: off in alter-ego form and under
 *   Memories of Armageddon's blank text box. It counts, it does not change the card (MC40 p. 21).
 * - **Domino (40037a), Action**: swap a hand card with the top card of the deck, once per round. The hand card lands
 *   on top of the deck, the deck card enters the hand (RRG "'Swap'", p. 42: refused without a card in both places, so
 *   an empty deck does nothing). Neither card is discarded or drawn.
 * - **Neena Thurman (40037b), Action**: the same with the top card of the discard pile. Each face has its own limit.
 */
export const DOMINO_IDENTITY: AbilityRegistry = defineAbilities({
  "40037a.domino-constant": constant(deckDiscardIconsCount(you, "wild", 2)),

  "40037a.domino-action": action(
    { limit: oncePerRound },
    chooseFromHand,
    chooseCards("top", topOfDeck(1), { min: 1, max: 1 }),
    swapCards(chosen("handCard") as TargetRef, chosen("top")),
  ),

  "40037b.neena-thurman-action": action(
    { limit: oncePerRound },
    chooseFromHand,
    chooseCards("top", zone("discard", you, { top: 1 }), { min: 1, max: 1 }),
    swapCards(chosen("handCard") as TargetRef, chosen("top")),
  ),
});
