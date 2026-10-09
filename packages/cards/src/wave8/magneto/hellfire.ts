import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  applyRuleUntil,
  boost,
  chooseTarget,
  chosen,
  constant,
  countOf,
  defineAbilities,
  discard,
  enemyActivates,
  activatingEnemy,
  exists,
  forcedResponse,
  giveBoostCard,
  giveTough,
  ifThen,
  on,
  placeThreat,
  product,
  query,
  rule,
  self,
  theVillain,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import { WAVE7_ABILITIES } from "../../wave7/index.js";

const HELLFIRE_TRAIT = trait("HELLFIRE");

/**
 * Modular encounter set `hellfire` (the Magneto pack's modular set, docs/phase7-wave8.md §7.5, §3.79, §8.4). Waits on
 * no engine work.
 *
 * Hellfire Pawn 49040 is Mutant Genesis 32058 with a reminder text added and is not marked a duplicate in the data, so
 * its Boost registers the very same definition object as 32058's (found by ability id in the wave 7 registry). The
 * data keeps the card text as "Forced Response" for Sebastian Shaw, whose scan misprints the header as "Forced
 * Respone".
 *
 * Cards (5):
 * - 49038 Sebastian Shaw (minion)
 * - 49039 Selene (minion)
 * - 49040 Hellfire Pawn (minion)
 * - 49041 The Inner Circle (side_scheme)
 * - 49042 Power and Decadence (treachery)
 */
const pawnBoost = WAVE7_ABILITIES["32058.boost"];
if (!pawnBoost) throw new Error("reprint source 32058.boost is not scripted");

export const HELLFIRE: AbilityRegistry = defineAbilities({
  // Sebastian Shaw — Toughness. Villainous. (data) Forced Response: After Sebastian Shaw is attacked, give him a
  // facedown boost card. He cannot be attacked again this phase. (Any player's attack, basic or labeled, damaged or
  // not: the boost card waits on him and is turned up with the villainous card at his next activation.)
  "49038.sebastian-shaw-forced-response": forcedResponse(
    on.attacks(query(["hero", "ally"]), { target: { self: true } }),
    giveBoostCard(self),
    applyRuleUntil({ kind: "cannotAttack", target: query("minion", { name: "Sebastian Shaw" }) }, "endOfPhase"),
  ),

  // Selene — Quickstrike. Villainous. (data) Allies cannot attack Selene.
  "49039.selene-constant": constant(
    rule({ kind: "cannotAttack", target: query("minion", { name: "Selene" }), attacker: query("ally") }),
  ),
  // [star] Boost: Discard an ally you control.
  "49039.boost": boost(
    chooseTarget("ally", query("ally", { controller: "you" })),
    ifThen(exists(query("ally", { controller: "you" })), discard(chosen("ally"))),
  ),

  // Hellfire Pawn — Guard. Patrol. Surge. (data) [star] Boost: Put Hellfire Pawn into play engaged with you. The same
  // object as 32058's (Mutant Genesis, Shadowcat's nemesis set).
  "49040.boost": pawnBoost,

  // The Inner Circle — When Revealed: Place 2 additional threat here for each Hellfire card in play.
  "49041.when-revealed": whenRevealed(placeThreat(product(2, countOf(query([], { trait: HELLFIRE_TRAIT }))), self)),

  // Power and Decadence — When Revealed: Give the villain a tough status card. Give this card to that villain as a
  // facedown boost card. (The card being revealed goes onto the villain instead of the discard pile, §3.79; it waits
  // there for the villain's next activation, in addition to that activation's own boost card.)
  "49042.when-revealed": whenRevealed(giveTough(theVillain), giveBoostCard(theVillain, { card: self })),
  // [star] Boost: After this activation, the activating enemy activates against you again. Do not give it a boost card
  // for that activation.
  "49042.boost": boost(enemyActivates(activatingEnemy, { against: you, afterCurrentActivation: true, noBoost: true })),
});

/** Refs of this set left unscripted, each with its reason. */
export const HELLFIRE_SKIPPED: Readonly<Record<string, string>> = {};
