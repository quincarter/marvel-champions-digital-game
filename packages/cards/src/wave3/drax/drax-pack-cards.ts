import {
  confuse,
  coveredByEngineRule,
  countOf,
  defineAbilities,
  draw,
  forcedInterrupt,
  heroAction,
  moveCards,
  on,
  query,
  self,
  takeDamage,
  theVillain,
  cards,
} from "../../dsl/index.js";

/**
 * `basic`/`aggression`/`justice`/`leadership`-aspect filler cards bundled in the Drax pack, not part of his
 * signature hero-kit set (`aspect` is the generic aspect, not `hero:19001a`): "Bring It!" (19030, aggression),
 * "Think Fast!" (19031, justice), Regroup (19032, leadership) — the wave1 `cap/pack-cards.ts` convention. Gamora
 * (19020, `basic`) and Athletic Conditioning (19021, `basic`, reprint) are scripted in
 * `drax-obligation-nemesis.ts`/aliased by `../reprints.ts` respectively; Enhanced Physique (19033, `basic`) is
 * also a reprint, aliased automatically.
 *
 * **Genuine primitive gap, `KNOWN_SKIPPED`:**
 * - `19032.regroup-interrupt` ("Interrupt: When an ally is defeated by an enemy attack, return it to its owner's
 *   hand instead of discarding it.") — needs a defeat-destination redirect to *hand*, conditioned on the defeat
 *   coming specifically from an enemy's attack. The one existing precedent, `RuleSpec defeatedIntoEncounterDeck`
 *   (Time Portal, `wave2/toafk/kang-encounter-set.ts` 11033), is narrowly built for a side scheme going to the
 *   encounter deck, unconditionally — it has no "to hand" destination and no "only if defeated by an attack"
 *   condition. `defeatFromPlay`/`leavePlay` (`packages/engine/src/effects.ts`) know how to redirect a defeated
 *   card to the victory display (Victory X) or a scenario area (`discardFromPlayDestination`, §3.14), but not to a
 *   player's hand. A genuinely new primitive, flagged for `game-rules-architect` rather than approximated (a plain
 *   `instead()` on the `characterDefeated` event would cancel the defeat outright — no "When Defeated" would fire,
 *   which is a different card).
 */
export const DRAX_PACK_CARDS = defineAbilities({
  // "Bring It!" — Max 1 per phase (data gap, the Maximum Velocity precedent, `wave2/qsv/kit.ts` 14005: `@mc/
  // content`'s own 19030 record carries no `playRestrictions.maxPerPhase`, so this is `coveredByEngineRule()`, not
  // scripted around here). Hero Action: Draw 1 card for each minion engaged with you.
  "19030.bring-it-constant": coveredByEngineRule(),
  "19030.bring-it-action": heroAction(draw(countOf(query("minion", { engagedWith: "you" })))),

  // "Think Fast!" — Play only if your identity has the guardian trait (data, `playRestrictions`). Hero Action:
  // Take 1 damage. Confuse the villain.
  "19031.think-fast-action": heroAction(takeDamage(1), confuse(theVillain)),

  // Regroup — Forced Interrupt: When the round ends, discard this card. The villain phase's end *is* the round's
  // end (RRG 1.8 "Villain Phase", p. 47 step 6b; docs/phase7-wave3.md §3.2).
  "19032.regroup-forced-interrupt": forcedInterrupt(on.phaseEnding("villain"), moveCards(cards(self), "discard")),
});
