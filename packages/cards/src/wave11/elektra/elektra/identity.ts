import type { AbilityRegistry } from "@mc/engine";
import {
  adjustBoostCount,
  andThen,
  constant,
  defineAbilities,
  interrupt,
  on,
  shuffleTopOfSeparateDeckIntoEncounterDeck,
} from "../../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/elektra/identity` (docs/phase7-elektra-iron-fist.md).
 *
 * **63001a** Villainous is a printed keyword: each basic power of her hero face gives her a boost card (RRG 1.8
 *   "Villainous", p. 47; `resolve/villainous.ts`).
 * **63001a.killer-instinct**, "Interrupt: When a boost card given to Elektra is turned faceup, cancel its 'Boost'
 *   ability. Then, that card gains [boost].": an optional interrupt (RRG 1.8 "Interrupt", p. 25) to a boost card on
 *   her turned faceup (`boostCardTurnedFaceup` whose holder is her), her held cards and her villainous card alike; not
 *   another character's (Black Cat's). Offered only for a card with a Boost ability to cancel; the icon is gained only
 *   if the cancel resolved (RRG 1.8 "'Then'", p. 44). Cancelling a Ninja card's Boost cancels its "shuffle this card
 *   into the Ninja deck" too, so the card is discarded as usual. The gained icon counts with the card's own, amplify
 *   added as for any of her boost cards.
 * **63001b.elektra-natchios-constant**, "Elektra Natchios begins the game with a Ninja deck. (See insert.)": the deck
 *   is built at setup from the identity's `separateDecks` data (owner decision 2A, 2026-11-14, provisional), so the
 *   constant has nothing left to do, as for Hercules's `59001b.hercules-constant`.
 * **63001b.ninja-training**, "Interrupt: When you change to hero form, shuffle the top card of the Ninja deck into
 *   the encounter deck.": optional, before the identity turns (`on.youWouldChangeIdentityForm("hero")`). An empty Ninja
 *   deck shuffles nothing in (ruling September 10, 2026 - Ruling 1, "do as much as you can"; engine reading).
 *
 * Cards (1):
 * - 63001a Elektra (hero_identity)
 */
export const ELEKTRA_ELEKTRA_IDENTITY: AbilityRegistry = defineAbilities({
  "63001a.killer-instinct": interrupt(
    { on: "boostCardTurnedFaceup", selfIs: "source" },
    { kind: "cancelBoostAbility" },
    andThen(adjustBoostCount(1)),
  ),
  "63001b.elektra-natchios-constant": constant(),
  "63001b.ninja-training": interrupt(
    on.youWouldChangeIdentityForm("hero"),
    shuffleTopOfSeparateDeckIntoEncounterDeck("Ninja"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None is left. */
export const ELEKTRA_ELEKTRA_IDENTITY_SKIPPED: Readonly<Record<string, string>> = {};
