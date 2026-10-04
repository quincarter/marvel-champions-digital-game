import {
  anyOfCards,
  cards,
  chooseCards,
  chosen,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  each,
  encounterCards,
  eachPlayer,
  exists,
  forcedResponse,
  hasAttachment,
  ifThen,
  inHand,
  moveCards,
  moveCardsInto,
  on,
  placeThreat,
  query,
  self,
  setAside,
  shuffleEncounterDeck,
  surge,
  theMainScheme,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

/** "Touched": Rogue's identity-specific upgrade (`identity.ts`). */
const TOUCHED = query("upgrade", { name: "Touched" });
/** "A friendly character": an identity or an ally (Q30: another player's identity counts). */
const FRIENDLY_CHARACTER = query(["identity", "ally"], hasAttachment(TOUCHED));
const MISLED = query("treachery", { name: "Misled" });

/**
 * Deadly Touch (38024), Rogue's obligation, and her Mystique nemesis set (`rogue_nemesis`): Mystique (38025, nemesis
 * minion), Mystique's Manipulations (38026, side scheme) and Misled x3 (38027, treachery). docs/phase7-wave6.md §6.2.
 *
 * - **Deadly Touch**: a one-shot When Revealed, read from where Touched is as it resolves (a character it is attached
 *   to is "friendly" when it is an identity or an ally; Touched in the set-aside area, or on a minion or the villain,
 *   is not); both bullets end by discarding the card. "Give to the Anna Marie player" is the engine's obligation default.
 * - **Mystique**: the search reads the encounter deck, its discard pile and the set-aside area (the nemesis sets of all
 *   players sit there); the found Misled is shuffled into the engaged player's deck, then the encounter deck is
 *   shuffled (RRG 1.8 "Search", p. 39).
 * - **Mystique's Manipulations**: RRG 1.8 erratum p. 69, "The defeating player searches the encounter deck and discard
 *   pile for a copy of the Misled treachery and shuffles it into their deck": the defeating player chooses and
 *   receives it. It names no set-aside area, so a Misled still set aside is not found.
 * - **Misled**: When Revealed shuffles itself into the revealing player's deck and gains surge (Infiltration's shape,
 *   `../../mut_gen/mystique.ts`); drawn, its Forced Response is active in the hand.
 */
export const ROGUE_OBLIGATION_NEMESIS = defineAbilities({
  // Deadly Touch — Give to the Anna Marie player.
  // • If Touched is attached to a friendly character, deal 2 damage to that character. Discard this card.
  // • If Touched is not attached to a friendly character, place 2 threat on the main scheme. Discard this card.
  "38024.obligation": whenRevealed(
    ifThen(exists(FRIENDLY_CHARACTER), dealDamage(2, each(FRIENDLY_CHARACTER)), placeThreat(2, theMainScheme)),
    moveCards(cards(self), "discard"),
  ),

  // Mystique — Toughness. Villainous. (data)
  // Forced Response: After Mystique engages you, search the encounter deck, discard pile, and set-aside area for a copy
  // of the Misled treachery and shuffle it into your deck.
  "38025.mystique-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    chooseCards("found", anyOfCards(encounterCards(["deck", "discard"], MISLED), setAside(eachPlayer, MISLED)), {
      min: 1,
      max: 1,
    }),
    moveCardsInto(cards(chosen("found")), "deckShuffle", you),
    shuffleEncounterDeck(),
  ),

  // Mystique's Manipulations — When Defeated: The defeating player searches the encounter deck and discard pile for a
  // copy of the Misled treachery and shuffles it into their deck. (RRG 1.8 erratum p. 69.)
  "38026.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], MISLED), {
      min: 1,
      max: 1,
      chooser: defeatingPlayer,
    }),
    moveCardsInto(cards(chosen("found")), "deckShuffle", defeatingPlayer),
    shuffleEncounterDeck(),
  ),

  // Misled — When Revealed: Shuffle this card into your deck. This card gains surge.
  "38027.when-revealed": whenRevealed(moveCardsInto(cards(self), "deckShuffle", you), surge()),
  // Forced Response: After this card enters your hand, place 2 threat on the main scheme.
  "38027.misled-forced-response": inHand(forcedResponse(on.thisEntersYourHand(), placeThreat(2, theMainScheme))),
});
