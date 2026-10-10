import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addAccelerationToken,
  advanceMainScheme,
  after,
  bindTargets,
  cannotLeavePlay,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  chosenPlayer,
  choosePlayer,
  constant,
  dealEncounterCard,
  defineAbilities,
  each,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  encounterCards,
  encounterSetAside,
  endGame,
  excludedFromAllyLimit,
  exists,
  exhaust,
  exhaustThis,
  firstPlayer,
  flipCard,
  forEachCard,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  hasTrait,
  heroAction,
  ifElse,
  ifThen,
  inMode,
  instead,
  named,
  not,
  on,
  option,
  perHero,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  removeThreat,
  resetHitPoints,
  removeCountersFrom,
  remainingHpOf,
  retargetAttack,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  stateCheck,
  stateCheckFromEntering,
  superlative,
  surge,
  theMainScheme,
  theVillain,
  threatAtLeast,
  threatOn,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  boost,
  you,
  attachCard,
} from "../../dsl/index.js";

const ALERT_LEVEL = named("Alert Level");
const RESCUED_CAPTIVE = query("ally", { name: "Rescued Captive" });
const BATROC_VILLAIN = query("villain", { name: "Batroc" });
/** "If Alert Level is on its High side": false with no Alert Level in play. */
const alertIsHigh = () => hasTrait(ALERT_LEVEL, trait("HIGH"));

/**
 * "Forced Interrupt: When Batroc would be defeated, reset his hit points to N instead. Then, remove 6 threat from the
 * main scheme." The villain is never defeated (MC50 p. 4, "Non-Scaling Villain HP": the interrupt replaces the defeat),
 * so nothing that reads a defeat answers. The removal is the villain's own (not a thwart, no crisis check) and can take
 * the last threat of a stage (the stage's own "last threat removed" answer then advances it).
 */
const batrocForcedInterrupt = () =>
  forcedInterrupt(on.defeated("self"), { would: true }, instead(resetHitPoints(self)), removeThreat(6, theMainScheme));

/** "[star] Forced Response: After Batroc attacks, place 1 threat on Alert Level." */
const batrocForcedResponse = () => forcedResponse(after.enemyAttacks("self"), placeThreat(1, ALERT_LEVEL));

/** Both faces of Alert Level: "Forced Response: After a character is defeated except by consequential damage, place 1 threat here." */
const alertForcedResponse = () =>
  forcedResponse(on.defeated({ categories: ["ally", "minion"] }, { consequential: false }), placeThreat(1, self));

/** Both faces of Alert Level: "Hero Action: Spend 1 resource of any type -> remove 1 threat from here." */
const alertAction = () => heroAction({ cost: spend(1) }, removeThreat(1, self));

/** "At least 4[per_hero] threat here": the threshold of both faces. */
const atAlertThreshold = () => threatAtLeast(self, perHero(4));

/**
 * Batroc (MC50 p. 11; docs/phase7-wave9.md section 2.3, 3.5, 3.13 to 3.16), first half: the villain 50086a (standard,
 * 8 hit points) and 50086b (expert, 12; hit points are fixed, not per player), the three main scheme stages
 * 50087a/b to 50089a/b and the Alert Level environment 50090a/b. Second half: see "Second half" below.
 *
 * **Stage advances.** "When the last threat is removed from this scheme" is scripted as a forced response to the
 * removal (`on.lastThreatRemoved`), the reading `gmw/escape-the-museum.ts` documents: the removal must have applied
 * before "the last threat" is true. Stage 1 and 2 are left that way, never by completion (`completionLoses` is data).
 * Stage 2B puts a set-aside Rescued Captive into play exhausted under a player the first player chooses, then the
 * first player chooses between advancing and 3[per_hero] threat more. With no captive left set aside none enters.
 * Stage 3B redirects every enemy attack to a Rescued Captive the first player chooses (a state check ends the game
 * with none in play, and a win at no threat).
 *
 * **Alert Level.** Threat on an environment is only tokens (section 3.7 (a)). Both faces hold threat, flip at 4
 * [per_hero] (Low) or lose the game at it (High), and gain threat from any ally or minion defeated except by its own
 * consequential damage. The flip keeps every token (RRG "Flip", p. 20) and is not a reveal.
 *
 * **Second half** (50091 to 50097). Vulnerable on the Embassy Guard / Patrol is the engine's keyword rule (section 3.1),
 * so a stun or a confuse discards them without a defeat: their When Defeated and Alert Level do not answer. Their
 * High-side surge / incite 1 is a constant keyword grant to the card itself, `while` Alert Level shows its High trait
 * (a revealed minion has it before it enters play). Rescued Captive does not count against the ally limit and no card
 * ability removes it (damage still defeats it, Victory -1). Heightened Reflexes: the interrupt to damage Batroc would
 * take prevents 2 and removes a leap counter; its boost attaches it to Batroc, and a card attached from out of play
 * enters play by it, so it arrives with its 4 leap counters. Leaping Kick: the first player picks among the allies tied
 * for the most remaining hit points (RRG "First Player", p. 19); the attack is an ordinary enemy attack on that ally,
 * so Batroc's own "After Batroc attacks" answers it (owner decision Q5 = A). Security Cameras (Hero) resolves once per
 * character the player controls (`forEachCard`), each exhausted or paid for with threat on Alert Level.
 *
 * Cards (10):
 * - 50086a Batroc (villain)
 * - 50087a Infiltrate A.I.M. Island Embassy (main_scheme)
 * - 50090a Alert Level (environment)
 * - 50091 Rescued Captive (ally)
 * - 50092 Heightened Reflexes (attachment)
 * - 50093 Embassy Guard (minion)
 * - 50094 Embassy Patrol (minion)
 * - 50095 Commandeer Security Office (side_scheme)
 * - 50096 Leaping Kick (treachery)
 * - 50097 Security Cameras (treachery)
 */
export const BATROC: AbilityRegistry = defineAbilities({
  // Batroc (A / B): the same two abilities; the fixed hit points are data.
  "50086a.batroc-forced-response": batrocForcedResponse(),
  "50086a.batroc-forced-interrupt": batrocForcedInterrupt(),
  "50086b.batroc-forced-response": batrocForcedResponse(),
  "50086b.batroc-forced-interrupt": batrocForcedInterrupt(),

  // 1A Setup: the Rescued Captives are set aside by the scenario builder (`SETASIDE_BY_SCENARIO` in wave9/setup.ts);
  // put Alert Level into play on its Low (front) face, and in expert mode place 2[per_hero] threat on it.
  "50087a.setup": setup(
    selectCards("alert", encounterCards(["deck"], { name: "Alert Level" })),
    putIntoPlay(chosen("alert"), firstPlayer),
    shuffleEncounterDeck(),
    ifThen(inMode("expert"), placeThreat(perHero(2), ALERT_LEVEL)),
  ),
  // 1B: advance to stage 2A when the last threat is removed.
  "50087b.infiltrate-aim-island-embassy-forced-interrupt": forcedResponse(
    on.lastThreatRemoved("self"),
    advanceMainScheme({ to: { stageNumber: 2 } }),
  ),

  // 2B: a captive enters exhausted under a player the first player chooses; the first player chooses to advance or not.
  "50088b.locate-missing-person-forced-interrupt": forcedResponse(
    on.lastThreatRemoved("self"),
    selectCards("captive", encounterSetAside({ name: "Rescued Captive" }, { random: 1 })),
    choosePlayer("controller", firstPlayer),
    putIntoPlay(chosen("captive"), chosenPlayer("controller")),
    exhaust(chosen("captive")),
    chooseOneBy(
      firstPlayer,
      option("Advance to stage 3A", advanceMainScheme({ to: { stageNumber: 3 } })),
      option("Do not advance: place 3[per_hero] threat here", placeThreat(perHero(3), self)),
    ),
  ),

  // 3A When Revealed: on High, deal each player a facedown encounter card; otherwise remove all threat from Alert
  // Level and flip it to High. In either case, in expert mode, place 2[per_hero] threat on Alert Level.
  "50089a.when-revealed": whenRevealed(
    ifThen(hasTrait(ALERT_LEVEL, trait("HIGH")), dealEncounterCard(eachPlayer), [
      removeThreat(threatOn(ALERT_LEVEL), ALERT_LEVEL),
      flipCard(ALERT_LEVEL),
    ]),
    ifThen(inMode("expert"), placeThreat(perHero(2), ALERT_LEVEL)),
  ),
  // 3B: "In expert mode, each minion gains quickstrike."
  "50089b.extract-captives-constant": constant(
    gainsKeyword({ name: "quickstrike" }, query("minion"), { while: inMode("expert") }),
  ),
  // 3B Forced Interrupt: when an enemy attacks, it attacks a Rescued Captive instead (the first player chooses which).
  "50089b.extract-captives-forced-interrupt": forcedInterrupt(
    { on: "enemyAttack" },
    ifThen(exists(RESCUED_CAPTIVE), [
      chooseTarget("captive", RESCUED_CAPTIVE, { chooser: firstPlayer }),
      retargetAttack(chosen("captive")),
    ]),
  ),
  // 3B: "If there is no threat here, the players win the game."
  "50089b.extract-captives-constant-2": stateCheck(not(threatAtLeast(self, 1)), endGame("win")),
  // 3B: "If this stage is completed [`completionLoses`, data] or there are no Rescued Captive allies in play, the players lose."
  // `stateCheckFromEntering`: a 3B that turns up with no captive in play is lost at once ("will need at least 1 Rescued
  // Captive to survive"), not only when the last one goes.
  "50089b.extract-captives-constant-3": stateCheckFromEntering(not(exists(RESCUED_CAPTIVE)), endGame("loss")),

  // Alert Level, Low side (50090a): at the threshold remove all threat and flip.
  "50090a.alert-level-constant": stateCheck(atAlertThreshold(), removeThreat(threatOn(self), self), flipCard(self)),
  "50090a.alert-level-forced-response": alertForcedResponse(),
  "50090a.alert-level-action": alertAction(),

  // Alert Level, High side (50090b): Batroc gets +1 SCH and +1 ATK; at the threshold the players lose.
  "50090b.alert-level-constant": constant(gets("sch", 1, BATROC_VILLAIN), gets("atk", 1, BATROC_VILLAIN)),
  "50090b.alert-level-constant-2": stateCheck(atAlertThreshold(), endGame("loss")),
  "50090b.alert-level-forced-response": alertForcedResponse(),
  "50090b.alert-level-action": alertAction(),

  // Rescued Captive: "Does not count against your ally limit. Card abilities cannot remove this ally from play."
  "50091.rescued-captive-constant": constant(
    excludedFromAllyLimit({ self: true }),
    cannotLeavePlay({ self: true }, { by: "cardAbilities" }),
  ),
  // "Hero Action: Exhaust Rescued Captive -> remove 1[per_hero] threat from the main scheme."
  "50091.rescued-captive-action": heroAction({ cost: exhaustThis }, removeThreat(perHero(1), theMainScheme)),

  // Heightened Reflexes: prevent 2 of the damage Batroc would take, remove 1 leap counter (the Uses 4 keyword is data).
  "50092.heightened-reflexes-forced-interrupt": forcedInterrupt(
    on.damage("host"),
    preventDamage(2),
    removeCountersFrom(self, "leap", 1),
  ),
  "50092.boost": boost(attachCard(self, theVillain)),

  // Embassy Guard / Patrol: High side adds surge / incite 1 to the card itself; When Defeated: 1 threat on Alert Level.
  "50093.embassy-guard-constant": constant(gainsKeyword({ name: "surge" }, { self: true }, { while: alertIsHigh() })),
  "50093.when-defeated": whenDefeated(placeThreat(1, ALERT_LEVEL)),
  "50094.embassy-patrol-constant": constant(
    gainsKeyword({ name: "incite", value: 1 }, { self: true }, { while: alertIsHigh() }),
  ),
  "50094.when-defeated": whenDefeated(placeThreat(1, ALERT_LEVEL)),

  // Commandeer Security Office.
  "50095.when-revealed": whenRevealed(ifThen(alertIsHigh(), addAccelerationToken(self))),
  "50095.when-defeated": whenDefeated(removeThreat(perHero(1), ALERT_LEVEL)),

  // Leaping Kick.
  "50096.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain)),
  "50096.when-revealed-hero": whenRevealedHero(
    ifThen(
      exists(query("ally")),
      [
        bindTargets("mostHp", superlative("highest", each(query("ally")), remainingHpOf(chosen("candidate")))),
        chooseTarget("victim", { inSlot: "mostHp" }, { chooser: firstPlayer }),
        enemyAttack(theVillain, { targetCharacter: chosen("victim"), keywords: ["overkill"] }),
      ],
      enemyAttack(theVillain, { against: you }),
    ),
  ),

  // Security Cameras. Hero: one pass per character the player controls as the card is revealed, that character bound;
  // the player picks which is next while several wait (the Low side can flip between two passes, RRG 1.8 "'For
  // Each'", p. 20). An exhausted character cannot be exhausted again (RRG 1.8 "Exhausted", p. 19), so its pass offers
  // only the threat, which then resolves without a prompt.
  "50097.when-revealed-alter-ego": whenRevealedAlterEgo(removeThreat(1, ALERT_LEVEL), surge()),
  "50097.when-revealed-hero": whenRevealedHero(
    forEachCard(
      "character",
      each(query("character", { controller: "you" })),
      chooseOne(
        option(
          "Exhaust that character",
          { when: exists(query("character", { inSlot: "character", exhausted: false })) },
          exhaust(chosen("character")),
        ),
        option(
          "Place 1 threat on Alert Level (2 on its High side)",
          placeThreat(ifElse(alertIsHigh(), 2, 1), ALERT_LEVEL),
        ),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const BATROC_SKIPPED: Readonly<Record<string, string>> = {};
