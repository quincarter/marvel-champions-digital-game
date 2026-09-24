import {
  boost,
  chooseOne,
  defineAbilities,
  exhaust,
  ifThen,
  modifyAttack,
  moveCards,
  not,
  option,
  placeThreat,
  putIntoPlay,
  refMatches,
  self,
  takeDamage,
  theMainScheme,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/**
 * The Badoon Headhunter modular set (16183–16185): a minion (Badoon Headhunter, victory/villainous printed as
 * data, no ability ref for either — RRG 1.8 "Victory X"/"Villainous", pp. 46/47, are both reminder text for
 * constant engine rules already enforced generically) and two treacheries.
 *
 * **Modular, not campaign-only, despite living among the campaign-numbered cards (#178–187).** RRG 1.8 FAQ
 * "Modular Encounter Sets" (p. 61) lists Badoon Headhunter as one of the eight; docs/phase7-wave3.md §1.7/§4 Q3
 * (`card-data-pipeline`, 2026-09-22) confirms `EncounterSet.campaignSpecific` is correctly `false` for it —
 * neither it nor Campaign Challenge prints the "Campaign" word RRG 1.8 p. 11 defines as the marker. So it is
 * scripted here alongside the rest of `gmw`'s modular sets, not deferred with The Market/Campaign Challenge
 * (16150–16182, still campaign-mode-deferred per `wave3/coverage.test.ts`'s own `KNOWN_SKIPPED`).
 */
export const BADOON_HEADHUNTER = defineAbilities({
  // Badoon Headhunter (16183, minion) — Victory 2, Villainous (data). [star] Boost: Put Badoon Headhunter into
  // play engaged with you.
  "16183.boost": boost(putIntoPlay(self, you)),

  // On the Hunt (16184, treachery) — Surge (data). When Revealed: Choose to either take 2 damage or discard 1
  // card at random from your hand. [star] Boost: Give the villain 1 additional boost card for this activation.
  "16184.when-revealed": whenRevealed(
    chooseOne(
      option("Take 2 damage", takeDamage(2)),
      option("Discard 1 card at random from your hand", moveCards(zone("hand", you, { random: 1 }), "discard")),
    ),
  ),
  "16184.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Dead to Rights (16185, treachery) — Surge (data). When Revealed: Exhaust your identity. If you cannot, place
  // 2 threat on the main scheme. [star] Boost: Give the villain 1 additional boost card for this activation.
  "16185.when-revealed": whenRevealed(
    ifThen(not(refMatches(yourIdentity, { exhausted: true })), exhaust(yourIdentity), placeThreat(2, theMainScheme)),
  ),
  "16185.boost": boost(modifyAttack({ extraBoostCards: 1 })),
});
