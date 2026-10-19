import type { AbilityRegistry, TargetQuery, TargetRef, ValueSpec } from "@mc/engine";
import {
  attachCard,
  bindTargets,
  boost,
  cannotAttach,
  chooseTarget,
  chosen,
  constant,
  dealIndirectDamage,
  defineAbilities,
  discard,
  exists,
  firstPlayer,
  forEachPlayer,
  eachPlayer,
  gainsKeyword,
  gets,
  ifThen,
  moveCards,
  placeThreat,
  printedCostOf,
  query,
  self,
  superlative,
  surge,
  theMainScheme,
  thatPlayer,
  topOfDeck,
  whenDefeated,
  whenRevealed,
  you,
  each,
} from "../../../dsl/index.js";

/** "For each different card type discarded this way": the engine's `distinctCardTypes` over the milled cards. */
const distinctTypesOf = (cardsRef: TargetRef): ValueSpec => ({ kind: "distinctCardTypes", cards: cardsRef });
const HOST_MINION = query("minion", { hostOfSelf: true });
/** "A card you control" with a cost: an ally, support or upgrade of yours in play (Burn Notice's pool shape). */
// Permanent cards are out of the pool: a leave-play effect targets the non-permanent card that fits (RRG 1.8
// "Permanent", p. 32). Player side schemes are left out too (rare).
const CARD_YOU_CONTROL: TargetQuery = {
  categories: ["ally", "support", "upgrade"],
  controller: "you",
  withoutKeyword: "permanent",
};
const UPGRADE_YOU_CONTROL: TargetQuery = query("upgrade", { controller: "you", withoutKeyword: "permanent" });
// None of these says "choose", so with several eligible targets the first player selects (RRG 1.8 "First Player",
// p. 19).

/**
 * Modular set `deadly_duo` (Registration side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Hinder 1[per_hero] on Deadly Duo is a data keyword.
 *
 * **Jester (57027)**: When Revealed: discard the top 3 cards of your deck (a shorter deck discards what it has, RRG 1.8
 * "Player Deck", p. 33), then take 1 indirect damage per different card type discarded. The revealer divides it among
 * the characters they control (RRG 1.8 "Indirect Damage").
 *
 * **Jack O'Lantern (57028)**: the same mill, then 1 threat on the main scheme per different card type.
 *
 * **Mad Jack's Platform (57029)**: twin of Civil War's Resistance Fighter 56191. The attach sentence is the data host
 * (`attachesTo`: a minion; `hostChosenBy: "enemyTeam"`, several hosts being the first player's choice in a prompt
 * marked as the enemy team's); with no minion in play the card gains surge (`cannotAttach`). The attached minion gets
 * +4 hit points and gains stalwart; its +1 ATK and +1 SCH are data. Boost: it is attached to a minion engaged with you.
 *
 * **Jester's Yo-Yo (57030)**: When Revealed: discard the highest-cost card you control, an ally, support or upgrade
 * (a tie is the first player's choice, RRG 1.8 "First Player" p. 19); with no non-permanent one the card gains surge
 * ("Otherwise" fires when the first sentence cannot resolve, RRG 1.8 p. 31). Boost: discard a non-permanent upgrade you
 * control, if any.
 *
 * **Deadly Duo (57031)**: When Defeated: each player discards the top 8 cards of their deck.
 *
 * Cards (5):
 * - 57027 Jester (minion)
 * - 57028 Jack O'Lantern (minion)
 * - 57029 Mad Jack's Platform (attachment)
 * - 57030 Jester's Yo-Yo (treachery)
 * - 57031 Deadly Duo (side_scheme)
 */
export const SYNTHEZOID_MODULAR_DEADLY_DUO: AbilityRegistry = defineAbilities({
  "57027.when-revealed": whenRevealed(
    moveCards(topOfDeck(3, you), "discard", "milled"),
    dealIndirectDamage(you, distinctTypesOf(chosen("milled"))),
  ),

  "57028.when-revealed": whenRevealed(
    moveCards(topOfDeck(3, you), "discard", "milled"),
    placeThreat(distinctTypesOf(chosen("milled")), theMainScheme),
  ),

  "57029.mad-jacks-platform-constant": cannotAttach(surge()),
  "57029.mad-jacks-platform-constant-2": constant(
    gets("hp", 4, HOST_MINION),
    gainsKeyword({ name: "stalwart" }, HOST_MINION),
  ),
  "57029.boost": boost(
    chooseTarget("host", query("minion", { engagedWithPlayer: you }), { chooser: firstPlayer }),
    attachCard(self, chosen("host")),
  ),

  "57030.when-revealed": whenRevealed(
    ifThen(
      exists(CARD_YOU_CONTROL),
      [
        bindTargets(
          "costly",
          superlative("highest", each(CARD_YOU_CONTROL), printedCostOf({ kind: "slot", slot: "candidate" })),
        ),
        chooseTarget("lost", { inSlot: "costly" }, { chooser: firstPlayer }),
        discard(chosen("lost")),
      ],
      surge(),
    ),
  ),
  "57030.boost": boost(chooseTarget("lost", UPGRADE_YOU_CONTROL, { chooser: firstPlayer }), discard(chosen("lost"))),

  "57031.when-defeated": whenDefeated(forEachPlayer(eachPlayer, moveCards(topOfDeck(8, thatPlayer), "discard"))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_DEADLY_DUO_SKIPPED: Readonly<Record<string, string>> = {};
