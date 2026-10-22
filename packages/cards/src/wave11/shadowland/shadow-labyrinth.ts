import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  activationIs,
  addCounters,
  addVillain,
  adjustBoostCount,
  advanceMainScheme,
  boost,
  buildScenarioDeck,
  chosenVillain,
  constant,
  countersOn,
  defineAbilities,
  discardEncounterUntil,
  chosen,
  eachPlayer,
  encounterCards,
  endGame,
  enemyActivates,
  eventAmount,
  eventPlayer,
  exists,
  find,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  ifThen,
  inMode,
  instead,
  modifyAttack,
  moveCards,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  removeCountersFrom,
  removeThreat,
  revealCard,
  revealTopOfScenarioDeck,
  scenarioDeck,
  self,
  setVillainAside,
  setup,
  stateCheck,
  theMainScheme,
  theVillain,
  thatPlayer,
  toScenarioDeck,
  valueAtMost,
  whenDefeated,
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
/** "(Limit once per round per player.)": counted for the player the thwart belongs to, not whoever resolves it. */
const oncePerRoundPerEventPlayer = { count: 1, period: "round", per: "eventPlayer" } as const;

/**
 * Shadow Labyrinth (Shadowland, MC65; docs/phase7-shadowland.md section 6 rules briefs M3 to M6). The trap deck is
 * declared by the scenario (`traitEncounterDeck`); these cards only reveal from it and shuffle into it.
 *
 * **Into the Labyrinth (65038a, one pool card: stage 1 = printed 65038, stage 2 Chamber of Vile Secrets = printed
 * 65039)**: 1A's Setup builds the trap deck (the choice of the Dark Protégé villain and its linked cards is the
 * scenario setup's, `GameSetupConfig.villainChoice`). 1B places the passage counters and turns damage to Shifting
 * Corridors into threat removed from the scheme; the last threat removed advances the scheme (the card's gloss
 * "the players win by advancing" is flavor: the game continues at 2A and 2B against the chosen villain). 2A sets Shifting Corridors aside and reveals the chosen villain
 * ("side B instead in expert mode" is a flip of the freshly added villain, which reveals the face it turns to). 2B is
 * the lose-by-completion stage (`completionLoses` is data).
 *
 * **Shifting Corridors (65037)**: infinite hit points and Stalwart are data (M4). The Forced Interrupt replaces each
 * activation ("instead", RRG 1.8 "Replacement Effect"): remove a passage counter and the player the activation was
 * against reveals the top of the trap deck. The players lose when none remain (M5, a state check).
 *
 * **Lord Deathstrike (65041)**, **Dead End (65042)**: "If Shifting Corridors is in play" is a villain by that name.
 * Dead End's Assault is data (M6).
 *
 * **Hall of Hidden Doors (65043)**: "discard cards from the encounter deck until a minion or side scheme is discarded,
 * then reveal it" is `discardEncounterUntil` then `revealCard`.
 *
 * **No Time to Think! (65044)**: the villain activates against the revealer. Its boost adds two icons to its own count
 * and, for an attack, overkill.
 *
 * **Sudden Shift (65045)**: shuffles the trap discard pile and encounter cards into the trap deck.
 *
 * **Whisper in the Dark (65040)** is skipped: an engine primitive is missing (see the skip reason). While it is
 * unscripted a revealed Whisper is placed as a plain attachment and later discarded, so the stage-2 branch "otherwise,
 * set this card aside and the villain schemes" is lost, and the villain never appears as a minion before 2A.
 *
 * Cards (8):
 * - 65037 Shifting Corridors (villain)
 * - 65038a Into the Labyrinth / Chamber of Vile Secrets (main_scheme)
 * - 65040 Whisper in the Dark (attachment)
 * - 65041 Lord Deathstrike (minion)
 * - 65042 Dead End (side_scheme)
 * - 65043 Hall of Hidden Doors (side_scheme)
 * - 65044 No Time to Think! (treachery)
 * - 65045 Sudden Shift (treachery)
 */
export const SHADOWLAND_SHADOW_LABYRINTH: AbilityRegistry = defineAbilities({
  // 1A. Setup: Create the trap deck (MC65 p. 12). The deck is declared by the scenario; this gathers its cards (a
  // second gathering, if the record already builds it at setup, finds nothing more).
  "65038a.setup": setup(buildScenarioDeck(TRAP_DECK)),
  // 1B. Place 10[per_hero] passage counters on Shifting Corridors (7[per_hero] instead in expert mode).
  "65038b.when-revealed": whenRevealed(
    ifThen(
      inMode("expert"),
      addCounters("passage", perHero(7), theVillain),
      addCounters("passage", perHero(10), theVillain),
    ),
  ),
  // 1B. Forced Interrupt: When Shifting Corridors would take any amount of damage, remove that much threat from here
  // instead.
  "65038b.into-the-labyrinth-forced-interrupt": forcedInterrupt(
    on.damage(CORRIDORS),
    instead(removeThreat(eventAmount, self)),
  ),
  // 1B. Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A. Heard as the response
  // to `on.lastThreatRemoved` rather than an interrupt: an interrupt would advance first, and the pending removal
  // would then hit stage 2's threat instead of stage 1's.
  "65038b.into-the-labyrinth-forced-interrupt-2": forcedResponse(on.lastThreatRemoved("self"), advanceMainScheme()),

  // Expert side B is a flip of the freshly added villain: `flipCard` logs a flip for what the card calls a reveal
  // (`setVillainSide` is setup-only). The flip reveals side B, so side A's When Revealed never runs.
  // 2A. When Revealed: 1. Set Shifting Corridors aside. 2. Find the chosen Dark Protege villain; discard each status
  // card, token and attached card from it (a set-aside card is a new copy with none: `setVillainAside` and
  // `addVillain` leave it clean; once Whisper in the Dark is scripted the villain may instead be in play as a minion
  // here, and this must discard its tokens, statuses and attachments). 3. Reveal its side A (side B instead in expert mode).
  "65039a.when-revealed": whenRevealed(
    setVillainAside(find(CORRIDORS)),
    ifThen(
      inMode("expert"),
      [addVillain(chosenVillain), flipCard(chosenVillain)],
      addVillain(chosenVillain, { reveal: true }),
    ),
  ),
  // 2B. When Revealed: In expert mode, the villain activates against each player.
  // The data lists three constants on 2A for the numbered steps of its When Revealed (a parse artifact, as The Getaway
  // 60128b's): empty, the steps are in 65039a.when-revealed.
  "65039a.chamber-of-vile-secrets-constant": constant(),
  "65039a.chamber-of-vile-secrets-constant-2": constant(),
  "65039a.chamber-of-vile-secrets-constant-3": constant(),
  "65039b.when-revealed": whenRevealed(
    ifThen(inMode("expert"), forEachPlayer(eachPlayer, enemyActivates(theVillain, { against: thatPlayer }))),
  ),
  // 2B. Forced Response: After you or an ally you control thwarts this scheme, reveal the top card of the trap deck.
  // (Limit once per round per player.) "You" is the player the thwart belongs to (the event player); an ally is
  // thwarting for its controller.
  "65039b.chamber-of-vile-secrets-forced-response": forcedResponse(
    {
      ...on.thwarts({ categories: ["identity", "ally"] }),
      selfIs: "target",
    },
    { limit: oncePerRoundPerEventPlayer },
    revealTopOfScenarioDeck(TRAP_DECK, eventPlayer),
  ),

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

  // When Defeated: The defeating player removes 5 threat from the main scheme. They discard cards from the encounter
  // deck until a minion or side scheme is discarded, then reveal it.
  "65043.when-defeated": whenDefeated(
    removeThreat(5, theMainScheme),
    discardEncounterUntil(query(["minion", "sideScheme"]), "found"),
    revealCard(chosen("found"), you),
  ),
  "65043.boost": boost(placeThreat(3, theMainScheme)),

  "65044.when-revealed": whenRevealed(enemyActivates(theVillain, { against: you })),
  "65044.boost": boost(ifThen(activationIs("attack"), [adjustBoostCount(2), modifyAttack({ overkill: true })])),

  "65045.when-revealed": whenRevealed(
    shuffleTrapDiscardIntoTraps(),
    shuffleEncounterIntoTraps(3),
    revealTopOfScenarioDeck(TRAP_DECK, you),
  ),
  "65045.boost": boost(shuffleTrapDiscardIntoTraps(), shuffleEncounterIntoTraps(2)),
});

const WHISPER_GAP =
  'needs an engine primitive that does not exist: a VILLAIN card put into play as an Elite minion engaged with a player (6 printed hit points, gaining Guard, Villainous and a When Defeated that sets it aside) and the attachment that makes it so; the engine\'s treat-as-minion rules (treatAsMinion, treatHostAsMinion) change allies only, and addVillain would make it an additional villain, not a minion, which is a wrong game, not an approximation. While it is unscripted a revealed Whisper is placed as a plain attachment and then discarded, so the stage-2 branch "otherwise, set this card aside and the villain schemes" is lost.';

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOW_LABYRINTH_SKIPPED: Readonly<Record<string, string>> = {
  "65040.whisper-in-the-dark-constant": `Whisper in the Dark, "Treat attached villain as an Elite minion with 6 printed hit points. It gains Guard. Villainous...": ${WHISPER_GAP}`,
  "65040.when-defeated": `Whisper in the Dark, "When Defeated: Set this minion aside" (granted to the villain it treats as a minion): ${WHISPER_GAP}`,
  "65040.when-revealed": `Whisper in the Dark, "put the set-aside chosen villain into play engaged with you, side A faceup, with this card attached": ${WHISPER_GAP}`,
};
