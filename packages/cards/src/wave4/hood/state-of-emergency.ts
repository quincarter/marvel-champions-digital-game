import {
  bindTargets,
  boost,
  chosen,
  chooseTarget,
  defineAbilities,
  discard,
  discardEncounterUntil,
  discardFromHand,
  each,
  ifThen,
  not,
  placeThreat,
  printedCostOf,
  putIntoPlay,
  query,
  resolveWhenRevealedOf,
  selectCards,
  self,
  superlative,
  takeDamage,
  varAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../dsl/index.js";

/**
 * The State of Emergency modular set (`hood` 24055-24059, docs/phase7-wave4.md §2.3): four side schemes (Feisty
 * Heist, Disaster at the Docks, Offshore Inferno, Hot Pursuit) and a treachery (Citywide Crisis).
 *
 * Feisty Heist's "the highest-cost card from your hand" is a superlative over the hand bound as a slot (`selectCards`,
 * then `superlative` over the slot, the out-of-play pool `TargetRef.superlative` documents) and a real discard among the
 * tied cards (`discardFromHand` with `inSlot`): the player whose hand it is picks among ties, as a hidden hand is theirs
 * to show (docs/phase7-wave4.md §3.55). Citywide Crisis re-resolves each side scheme's When Revealed abilities
 * (`resolveWhenRevealedOf`, §3.56).
 */

export const STATE_OF_EMERGENCY = defineAbilities({
  // Feisty Heist (24055, side scheme; acceleration icon is data) — When Revealed: discard the highest-cost card from
  // your hand.
  "24055.when-revealed": whenRevealed(
    selectCards("hand", zone("hand", you)),
    bindTargets("highest", superlative("highest", chosen("hand"), printedCostOf(chosen("candidate")))),
    discardFromHand(1, you, { filter: { inSlot: "highest" } }),
  ),

  // Citywide Crisis (24059, treachery; starIcon is data) — When Revealed: resolve each "When Revealed" ability on each
  // side scheme in play. If no "When Revealed" ability was resolved this way, place 2 threat on each scheme. [star]
  // Boost: resolve this card's "When Revealed" ability.
  "24059.when-revealed": whenRevealed(
    resolveWhenRevealedOf(each(query("sideScheme")), { bind: "resolved" }),
    ifThen(not(varAtLeast("resolved.count")), placeThreat(2, each(query("scheme")))),
  ),
  "24059.boost": boost(resolveWhenRevealedOf(self)),

  // Disaster at the Docks (24056, side scheme; acceleration icon is data) — When Revealed: take 3 indirect damage.
  "24056.when-revealed": whenRevealed(takeDamage(3)),

  // Offshore Inferno (24057, side scheme; acceleration icon is data) — When Revealed: discard the lowest-cost card
  // you control.
  "24057.when-revealed": whenRevealed(
    bindTargets(
      "lowestCost",
      superlative(
        "lowest",
        each(query(["ally", "upgrade", "support"], { controller: "you" })),
        printedCostOf(chosen("candidate")),
      ),
    ),
    chooseTarget("pick", { inSlot: "lowestCost" }),
    discard(chosen("pick")),
  ),

  // Hot Pursuit (24058, side scheme; acceleration icon is data) — When Revealed: discard cards from the top of the
  // encounter deck until a minion is discarded. Put that minion into play engaged with you.
  "24058.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), you),
  ),
});
