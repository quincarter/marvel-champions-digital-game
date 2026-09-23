import {
  confuse,
  countOf,
  defineAbilities,
  draw,
  forcedInterrupt,
  heroAction,
  interrupt,
  moveCards,
  on,
  query,
  self,
  setDefeatDestination,
  takeDamage,
  theVillain,
  cards,
  when,
} from "../../dsl/index.js";

/**
 * `basic`/`aggression`/`justice`/`leadership`-aspect filler cards bundled in the Drax pack, not part of his
 * signature hero-kit set (`aspect` is the generic aspect, not `hero:19001a`): "Bring It!" (19030, aggression),
 * "Think Fast!" (19031, justice), Regroup (19032, leadership) — the wave1 `cap/pack-cards.ts` convention. Gamora
 * (19020, `basic`) and Athletic Conditioning (19021, `basic`, reprint) are scripted in
 * `drax-obligation-nemesis.ts`/aliased by `../reprints.ts` respectively; Enhanced Physique (19033, `basic`) is
 * also a reprint, aliased automatically.
 *
 * **`19032.regroup-interrupt`** ("Interrupt: When an ally is defeated by an enemy attack, return it to its
 * owner's hand instead of discarding it.") — docs/phase7-wave3.md §3.45: `EffectSpec setDefeatDestination`
 * redirects a pending defeat's own discard, and `characterDefeated.fromAttack` (set when the defeating damage was
 * attack damage) lets `on.defeated(…, { byAttackFrom })` read "defeated by an enemy attack". The ally is still
 * defeated — When Defeated, Victory X and "after … is defeated" all still apply; only the discard is replaced.
 * Any player's ally, since the printed card does not say "your" (§4 Q17: an open reading against the Collector's
 * own discard redirect, `gmw/museum.ts`).
 */
export const DRAX_PACK_CARDS = defineAbilities({
  // "Bring It!" — Max 1 per phase (data: `playRestrictions.maxPerPhase` on the 19030 record, engine-enforced —
  // same shape as Maximum Velocity, `wave2/qsv/kit.ts` 14005). Hero Action: Draw 1 card for each minion engaged
  // with you.
  "19030.bring-it-action": heroAction(draw(countOf(query("minion", { engagedWith: "you" })))),

  // "Think Fast!" — Play only if your identity has the guardian trait (data, `playRestrictions`). Hero Action:
  // Take 1 damage. Confuse the villain.
  "19031.think-fast-action": heroAction(takeDamage(1), confuse(theVillain)),

  // Regroup — Interrupt: When an ally is defeated by an enemy attack, return it to its owner's hand instead of
  // discarding it (module docblock, docs/phase7-wave3.md §3.45).
  "19032.regroup-interrupt": interrupt(
    when.defeated(query("ally"), { byAttackFrom: query("enemy") }),
    setDefeatDestination("hand"),
  ),
  // Regroup — Forced Interrupt: When the round ends, discard this card. The villain phase's end *is* the round's
  // end (RRG 1.8 "Villain Phase", p. 47 step 6b; docs/phase7-wave3.md §3.2).
  "19032.regroup-forced-interrupt": forcedInterrupt(on.phaseEnding("villain"), moveCards(cards(self), "discard")),
});
