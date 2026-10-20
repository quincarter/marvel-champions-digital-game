import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  activationIs,
  adjustBoostCount,
  boost,
  countersOn,
  defineAbilities,
  encounterCards,
  endGame,
  enemyActivates,
  eventPlayer,
  exists,
  forcedInterrupt,
  ifThen,
  instead,
  modifyAttack,
  moveCards,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  removeCountersFrom,
  revealTopOfScenarioDeck,
  scenarioDeck,
  self,
  stateCheck,
  theVillain,
  toScenarioDeck,
  valueAtMost,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/** The scenario's trap deck (`traitEncounterDeck("trap", ...)` in the scenario setup; MC65 pp. 12-13). */
const TRAP_DECK = "trap";
const CORRIDORS: TargetQuery = query("villain", { name: "Shifting Corridors" });
/** "If Shifting Corridors is in play". */
const corridorsInPlay = exists(CORRIDORS);
/** "Shuffle the top N cards of the encounter deck into the trap deck." */
const shuffleEncounterIntoTraps = (n: number) =>
  moveCards(encounterCards(["deck"], undefined, n), toScenarioDeck(TRAP_DECK, "shuffle"));
/** "Shuffle the trap discard pile into the trap deck." */
const shuffleTrapDiscardIntoTraps = () =>
  moveCards(scenarioDeck(TRAP_DECK, { zones: ["discard"] }), toScenarioDeck(TRAP_DECK, "shuffle"));

/**
 * Shadow Labyrinth (Shadowland, MC65; docs/phase7-shadowland.md section 6 rules briefs M3 to M6). The trap deck is
 * declared by the scenario (`traitEncounterDeck`); these cards only reveal from it and shuffle into it.
 *
 * **Shifting Corridors (65037)**: infinite hit points and Stalwart are data (M4). The Forced Interrupt replaces each
 * activation ("instead", RRG 1.8 "Replacement Effect"): remove a passage counter and the player the activation was
 * against reveals the top of the trap deck. The players lose when none remain (M5, a state check).
 *
 * **Lord Deathstrike (65041)**, **Dead End (65042)**: "If Shifting Corridors is in play" is a villain by that name.
 * Dead End's Assault is data (M6).
 *
 * **No Time to Think! (65044)**: the villain activates against the revealer. Its boost adds two icons to its own count
 * and, for an attack, overkill.
 *
 * **Sudden Shift (65045)**: shuffles the trap discard pile and encounter cards into the trap deck.
 *
 * Cards (5):
 * - 65037 Shifting Corridors (villain)
 * - 65041 Lord Deathstrike (minion)
 * - 65042 Dead End (side_scheme)
 * - 65044 No Time to Think! (treachery)
 * - 65045 Sudden Shift (treachery)
 */
export const SHADOWLAND_SHADOW_LABYRINTH: AbilityRegistry = defineAbilities({
  "65037.shifting-corridors-forced-interrupt": forcedInterrupt(
    on.enemyActivating("self"),
    instead(removeCountersFrom(self, "passage", 1), revealTopOfScenarioDeck(TRAP_DECK, eventPlayer)),
  ),
  "65037.shifting-corridors-constant": stateCheck(valueAtMost(countersOn(self, "passage"), 0), endGame("loss")),

  "65041.when-revealed": whenRevealed(
    ifThen(corridorsInPlay, shuffleEncounterIntoTraps(2), revealTopOfScenarioDeck(TRAP_DECK, you)),
  ),
  "65041.boost": boost(putIntoPlay(self, you)),

  "65042.when-revealed": whenRevealed(
    ifThen(corridorsInPlay, removeCountersFrom(theVillain, "passage", 1), placeThreat(perHero(1), self)),
  ),

  "65044.when-revealed": whenRevealed(enemyActivates(theVillain, { against: you })),
  "65044.boost": boost(ifThen(activationIs("attack"), [adjustBoostCount(2), modifyAttack({ overkill: true })])),

  "65045.when-revealed": whenRevealed(
    shuffleTrapDiscardIntoTraps(),
    shuffleEncounterIntoTraps(3),
    revealTopOfScenarioDeck(TRAP_DECK, you),
  ),
  "65045.boost": boost(shuffleTrapDiscardIntoTraps(), shuffleEncounterIntoTraps(2)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOW_LABYRINTH_SKIPPED: Readonly<Record<string, string>> = {};
