import {
  after,
  attachCard,
  boost,
  chosen,
  defineAbilities,
  each,
  encounterCards,
  forcedResponse,
  giveTough,
  hasStatus,
  ifThen,
  inPlay,
  isAttached,
  oneCopyOf,
  query,
  searchAndReveal,
  selectCards,
  self,
  shuffleEncounterDeck,
  stun,
  surge,
  takeDamage,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";

const HOST_MINION = query("minion", { hostOfSelf: true });

/**
 * The Zero Tolerance encounter set (`zero_tolerance`, `mut_gen` 32101-32104, MC32 pp. 9 and 12, docs/phase7-wave6.md
 * §2.2): Sentinel Mark II, Sentinel Mark III, Energy Barrier and the Operation Zero Tolerance side scheme. The side
 * scheme (32104) is scripted in `project-wideawake.ts`, beside every card that puts cards under it. Required in
 * Project Wideawake, modular in Master Mold.
 *
 * **Searches** shuffle the encounter deck afterwards even where the card prints no "(Shuffle.)" (RRG 1.8 "Search",
 * p. 40: a deck that is searched is shuffled when the card ability completes).
 */
export const ZERO_TOLERANCE_ABILITIES = defineAbilities({
  // Sentinel Mark II (32101) — When Revealed: If Operation Zero Tolerance is in play, Sentinel Mark II gains surge.
  // Otherwise, search the encounter deck and discard pile for the Operation Zero Tolerance side scheme and reveal it.
  "32101.when-revealed": whenRevealed(
    ifThen(inPlay("Operation Zero Tolerance"), surge(), searchAndReveal("Operation Zero Tolerance")),
  ),

  // Sentinel Mark III (32102, Toughness is data) — When Revealed: Search the encounter deck and discard pile for the
  // Energy Barrier attachment and attach it to this minion.
  "32102.when-revealed": whenRevealed(
    selectCards("barrier", oneCopyOf(encounterCards(["deck", "discard"], { name: "Energy Barrier" }))),
    attachCard(chosen("barrier"), self),
    shuffleEncounterDeck(),
  ),
  // [star] Boost: You are stunned. If you are already stunned, take 2 damage.
  "32102.boost": boost(ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2), stun(yourIdentity))),

  // Energy Barrier (32103; attaches to a Sentinel minion without Energy Barrier, +2 ATK: data) — Attach to a Sentinel
  // minion without Energy Barrier attached and give it a tough status card. Otherwise, this card gains surge.
  "32103.energy-barrier-constant": whenRevealed(ifThen(isAttached(self), giveTough(each(HOST_MINION)), surge())),
  // [star] Forced Response: After attached minion attacks, give it a tough status card.
  "32103.energy-barrier-forced-response": forcedResponse(after.enemyAttacks("host"), giveTough(each(HOST_MINION))),
});
