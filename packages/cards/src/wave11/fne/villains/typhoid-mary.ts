import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  andThen,
  boost,
  cannotActivate,
  chooseTarget,
  chosen,
  confuse,
  constant,
  damageOn,
  damagedAtLeast,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  endGame,
  enemyAttack,
  enemyScheme,
  eventAmount,
  exhaust,
  exists,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeywordX,
  giveTough,
  heroAction,
  ifThen,
  inMode,
  instead,
  modifyAttack,
  named,
  on,
  perHero,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  resetHitPoints,
  self,
  setVillainSide,
  setup,
  spend,
  stateCheck,
  stun,
  sum,
  thatPlayer,
  theVillain,
  threatOn,
  valueAtLeast,
  when,
  whenRevealed,
  you,
  yourIdentity,
} from "../../../dsl/index.js";

const PSYCHE = named("Disturbed Psyche");
const MARY_WALKER = query("attachment", { name: "Mary Walker" });
/** "If Typhoid Mary is activating": the activating enemy is the villain on her Typhoid face (the face's own name). */
const TYPHOID_ACTIVATING = refMatches(activatingEnemy, query("villain", { name: "Typhoid Mary" }));
/** "If Bloody Mary is activating": the villain on her Bloody face. */
const BLOODY_ACTIVATING = refMatches(activatingEnemy, query("villain", { name: "Bloody Mary" }));

/**
 * "Forced Interrupt: When [she] would be defeated, place 1 damage token on Disturbed Psyche instead and reset her hit
 * points to N[per_hero]." (60110a/b, 60111a/b.) She is never defeated (`instead`), so nothing that reads a defeat
 * answers; the reset sets the printed number (Baron Zemo / Batroc precedent, docs/phase7-wave9.md section 4.1 Q3 = A).
 */
const maryForcedInterrupt = (hp: 10 | 13) =>
  forcedInterrupt(
    on.defeated("self"),
    { would: true },
    instead(resetHitPoints(self, { to: perHero(hp) })),
    placeDamage(1, PSYCHE),
  );

/** "If the Mary Walker attachment is in play, flip it and reveal Establish Trust." (60115, 60118.) */
const unmaskMary = () => ifThen(exists(MARY_WALKER), flipCard(each(MARY_WALKER), { reveal: true }));

/**
 * Typhoid Mary villain set (docs/phase7-wave11-scenarios.md section S6, S3.4).
 *
 * **60110a/b, 60111a/b Typhoid Mary / Bloody Mary**: one villain card with two faces per stage. Forced Interrupt (both
 * names, both stages): a defeat becomes 1 damage token on Disturbed Psyche and a reset to 10 (stage I) or 13 (stage II)
 * hit points per hero. 60111b (Bloody Mary II) When Revealed deals 1 damage to each identity; the Toughness on 60111a
 * is data, given to a face a flip reveals (MC60 p. 26 FAQ; engine E4).
 * **60112 Disturbed Psyche**: Setup draws the villain's side from the seed (no flip); the villain phase's end flips her
 * (the new face is revealed: Toughness, When Revealed); 3 or more damage and threat tokens here win the game.
 * **60113a/b Establish Trust / Mary Walker**: one permanent card, scheme face and attachment face. Defeating the scheme
 * puts a threat token on Disturbed Psyche and flips it onto the villain; the attachment then stops her activating
 * until she takes damage or the round ends, when each player is dealt a facedown encounter card and it flips back.
 * **60114 Telekinesis**, **60117 Assembled Armor**: attachments to the villain (Armor soaks her damage, "would take"
 * so after a tough status card, RRG 1.8 "Damage", p. 14). **60115/60118** flip Mary Walker back to Establish Trust.
 *
 * Cards (11):
 * - 60110b Bloody Mary (villain)
 * - 60112 Disturbed Psyche (environment)
 * - 60113a Establish Trust (side_scheme)
 * - 60113b Mary Walker (attachment)
 * - 60114 Telekinesis (attachment)
 * - 60115 Psionic Slash (treachery)
 * - 60116 Psi Nova (treachery)
 * - 60117 Assembled Armor (attachment)
 * - 60118 Hail of Blades (treachery)
 * - 60119 Scavenged Bulwark (treachery)
 * - 60120 Hand Lookout (minion)
 */
export const FNE_VILLAINS_TYPHOID_MARY: AbilityRegistry = defineAbilities({
  "60110b.bloody-mary-forced-interrupt": maryForcedInterrupt(10),
  "60110a.typhoid-mary-forced-interrupt": maryForcedInterrupt(10),
  "60111b.bloody-mary-forced-interrupt": maryForcedInterrupt(13),
  "60111a.typhoid-mary-forced-interrupt": maryForcedInterrupt(13),
  "60111b.when-revealed": whenRevealed(dealDamage(1, each(query("identity")))),

  "60112.setup": setup(setVillainSide(theVillain, "random")),
  // MC60 p. 26 FAQ: when she flips, "the ability or keyword on her new faceup side resolves", so her Toughness does,
  // where a villain's flip otherwise gives no tough status card (docs/phase7-shadowland.md §5.1 question 10 = B). The
  // owner confirmed this exception (Quin, 2026-10-22, PR #355 question 10 follow-up: Typhoid Mary keeps the FAQ).
  "60112.disturbed-psyche-forced-interrupt": forcedInterrupt(
    on.phaseEnding("villain"),
    flipCard(theVillain, { resolveToughness: true }),
  ),
  "60112.disturbed-psyche-constant": stateCheck(
    valueAtLeast(sum(damageOn(self), threatOn(self)), 3),
    endGame("win", "cardAbility"),
  ),

  "60113a.establish-trust-constant": constant(
    gainsKeywordX("hinder", perHero(3), { self: true }, { while: inMode("expert") }),
  ),
  // Printed "When Defeated". Permanent (RRG 1.8 p. 32; MC60 Permanent, "cannot be defeated ... except by card abilities in
  // the same set") keeps the scheme from being defeated at no threat (wave 7 ruling, docs/phase7-wave7.md section 4.1),
  // and the MC60 Typhoid Mary notes say players gain tokens "by removing all the threat from Establish Trust": so the
  // text answers the last threat removed, as the wave 7 ruling directs for a Permanent scheme.
  "60113a.when-defeated": forcedResponse(on.lastThreatRemoved("self"), placeThreat(1, PSYCHE), flipCard(self)),
  "60113b.mary-walker-constant": constant(cannotActivate(query("villain", { hostOfSelf: true }))),
  "60113b.mary-walker-forced-response": forcedResponse(
    on.either(on.damage({ hostOfSelf: true }, { taken: true }), on.roundEnding()),
    forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer)),
    flipCard(self),
  ),

  "60114.telekinesis-action": heroAction({ cost: spend({ mental: 2 }) }, discard(self)),
  "60114.boost": boost(
    ifThen(TYPHOID_ACTIVATING, [dealIndirectDamage(you, 3, { bind: "tk" }), exhaust(chosen("tk.damaged"))]),
  ),

  "60115.when-revealed": whenRevealed(unmaskMary(), enemyScheme(theVillain)),
  "60115.boost": boost(
    ifThen(TYPHOID_ACTIVATING, [
      // No "choose": an encounter card targeting one of several eligible cards; the first player selects
      // (RRG 1.8 "First Player", p. 19).
      chooseTarget("victim", query("ally", { controller: "you" }), { chooser: firstPlayer }),
      dealDamage(3, chosen("victim")),
    ]),
  ),

  "60116.when-revealed": whenRevealed(
    dealDamage(1, each(query("character", { controller: "you" }))),
    stun(yourIdentity),
  ),
  "60116.boost": boost(ifThen(TYPHOID_ACTIVATING, stun(yourIdentity))),

  "60117.assembled-armor-forced-interrupt": forcedInterrupt(
    when.damage(query("villain", { hostOfSelf: true })),
    instead(placeDamage(eventAmount, self)),
    andThen(
      ifThen(
        inMode("expert"),
        ifThen(damagedAtLeast(self, 8), discard(self)),
        ifThen(damagedAtLeast(self, 5), discard(self)),
      ),
    ),
  ),
  "60117.boost": boost(ifThen(BLOODY_ACTIVATING, confuse(yourIdentity))),

  "60118.when-revealed": whenRevealed(unmaskMary(), enemyAttack(theVillain, { against: you })),
  "60118.boost": boost(ifThen(BLOODY_ACTIVATING, dealDamage(2, yourIdentity))),

  "60119.when-revealed": whenRevealed(giveTough(theVillain)),
  "60119.boost": boost(ifThen(BLOODY_ACTIVATING, giveTough(theVillain))),

  "60120.boost": boost(modifyAttack({ extraBoostCards: 1 })),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_TYPHOID_MARY_SKIPPED: Readonly<Record<string, string>> = {};
