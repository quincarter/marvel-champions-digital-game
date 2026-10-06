import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  attachCard,
  blanksTextBox,
  boost,
  cards,
  confuse,
  constant,
  damageOn,
  defineAbilities,
  discard,
  forcedResponse,
  heal,
  ifThen,
  moveCards,
  named,
  not,
  on,
  placeThreat,
  query,
  reportFact,
  rule,
  schemeThreatOn,
  self,
  spend,
  threatOn,
  titled,
  valueAtLeast,
  varAtLeast,
  yourIdentity,
} from "../../dsl/index.js";

const YOUR_ALLIES = query("ally", { controller: "you" });

/**
 * Deadpool's obligation and nemesis set (44032-44036), docs/phase7-wave7.md §7.3, §3.78, §3.83.
 *
 * - **The Merc with the Mouth (44032)**: "Give to the Wade Wilson player" is engine data (it stays in that player's play
 *   area, §3.70). The card prints no When Revealed header, so (owner ruling, 2026-10-05; RRG 1.8 "Ability", p. 4) its
 *   three plain sentences are one standing constant and the data keeps them in one `-constant` ref. "Exhaust each ally
 *   you control" is therefore a STANDING instruction, not a one-time reveal effect (contrast Sowing Discord 40161,
 *   "When Revealed: Exhaust each ally you control"): allies already in play are exhausted while the obligation is in
 *   play, and so is an ally that enters play or comes under your control; the next sentence stops them readying. The
 *   ref carries what the engine can express: allies you control cannot ready, and enter play exhausted. NOT SCRIPTED,
 *   three engine gaps (two pinned with `it.fails` in the test file): (a) "Other players cannot resolve player card
 *   abilities during your turn" needs a predicate for whose turn it is (`Predicate` has `gameStep` but no active
 *   player), so the ban (`cannotResolveTriggeredAbilities` on other players' player cards, `while` it is the holder's
 *   turn) cannot be written; (b) the standing exhaust of allies ALREADY in play when the Merc enters, and of an ally
 *   that changes control to you while it is in play: `entersPlayExhausted` covers neither (a card that changes
 *   controller has not entered play), a `stateCheckFromEntering` (ready ally you control -> exhaust it) needs its own
 *   ref and a ref carries one ability, and no rule kind keeps a card exhausted the way `keepsGivingStatus` keeps a
 *   status. Needed: a rule such as `keepsExhausted { target, while? }` applied between frames beside
 *   `applyKeptStatuses` (a level check: every matching ready character in play becomes exhausted, logged as a
 *   constant's doing), or a data ref for a standing check. The Forced Response: after the player phase ends, the Merc
 *   player is asked (`reportFact`, spec Q50: online a text message or an open microphone counts, otherwise, and
 *   always on one device or solo, the client asks) whether they talked; "no" discards this card.
 * - **Butler (44033)**: his scheme threat goes on Involuntary Procedures while it is in play, else on the main scheme
 *   ("if able"; the same rule as Dark Phoenix, 34029). Boost: you are confused. Only the villain and villainous
 *   minions draw boost cards, so the Boost is for a card the engine deals as a boost to such an activation.
 * - **Involuntary Procedures (44034)**: after Deadpool (the hero face or the ally 40024, never Wade Wilson, RRG
 *   "Identity", p. 23) takes any amount of damage, 1 threat goes here; then at 10 or more it is removed from the game.
 * - **Tabula Rasa 16 (44035)**: attaches to your identity (data). Both faces' text boxes are blank (Q12 = A), so the
 *   Regeneratin' Degenerate does not apply: Deadpool at 0 hit points is eliminated. Alter-Ego Action: spend [mental]
 *   [mental] -> discard it. Boost: attach it to your identity.
 * - **Mutated Soldier (44036)**: Toughness is data; heals all damage from itself after it activates.
 */
export const DEADPOOL_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "44032.the-merc-with-the-mouth-constant": constant(
    rule({ kind: "cannotReady", target: YOUR_ALLIES }),
    rule({ kind: "entersPlayExhausted", target: YOUR_ALLIES }),
  ),
  "44032.the-merc-with-the-mouth-forced-response": forcedResponse(
    on.phaseEnding("player"),
    reportFact("talkedThisPhase", "talked"),
    ifThen(not(varAtLeast("talked.amount")), discard(self)),
  ),

  "44033.butler-forced-interrupt": constant(schemeThreatOn({ self: true }, named("Involuntary Procedures"))),
  "44033.boost": boost(confuse(yourIdentity)),

  "44034.involuntary-procedures-forced-response": forcedResponse(
    on.damage(titled("Deadpool"), { taken: true }),
    placeThreat(1, self),
    ifThen(valueAtLeast(threatOn(self), 10), moveCards(cards(self), "removedFromGame")),
  ),

  "44035.tabula-rasa-16-constant": constant(blanksTextBox(query("identity", { hostOfSelf: true }))),
  "44035.tabula-rasa-16-action": alterEgoAction({ cost: spend({ mental: 2 }) }, discard(self)),
  "44035.boost": boost(attachCard(self, yourIdentity)),

  "44036.mutated-soldier-forced-response": forcedResponse(on.enemyActivates("self"), heal(damageOn(self), self)),
});
