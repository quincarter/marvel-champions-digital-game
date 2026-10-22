import { trait } from "@mc/content";
import type { AbilityRegistry, TargetQuery } from "@mc/engine";
import {
  activationIs,
  addCounters,
  addVillain,
  adjustBoostCount,
  advanceMainScheme,
  boost,
  cards,
  buildScenarioDeck,
  chosenVillain,
  constant,
  countersOn,
  defineAbilities,
  discardEncounterUntil,
  discardStatusesTokensAndAttachments,
  chosen,
  eachPlayer,
  encounterCards,
  endGame,
  enemyActivates,
  enemyScheme,
  eventAmount,
  eventPlayer,
  exists,
  find,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsAbility,
  gainsKeyword,
  ifThen,
  inMode,
  instead,
  modifyAttack,
  moveCards,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  putIntoPlayAsHost,
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
  treatAttachedVillainAsMinion,
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
/** The card Whisper in the Dark is attached to. */
const ATTACHED: TargetQuery = { hostOfSelf: true };
const ELITE = trait("ELITE");
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
 * **Whisper in the Dark (65040)**: with Shifting Corridors in play, the set-aside chosen villain enters play engaged
 * with the revealer, side A faceup, with Whisper attached (`putIntoPlayAsHost`). The constant makes it an Elite minion
 * (`treatAttachedVillainAsMinion`): never "the villain", side A's ATK and SCH, 6 printed hit points (flat: the card
 * prints no per player icon), and its own text box kept, since the card blanks nothing (RRG 1.8 "Card Types", p. 12: a
 * card whose type changes "functions as would any card of the new card type"), so side A's star ability still answers
 * its attacks. It gains Guard, Villainous and the When Defeated "Set this minion aside", in which `self` is the villain
 * card: back to the encounter set-aside area, and Whisper, discarded with its host, goes to the trap discard pile (M3).
 * Whisper leaving while the minion stays (a player card discards it) leaves a villain card in play: it is one of the
 * game's villains there, beside Shifting Corridors (rules expert; owner confirmation pending), and defeated as that
 * villain it is out of the game with no win. The minion discarded is removed from the game: a Dark Protégé villain is
 * one double-sided card (RRG v1.8 "Double-Sided Card", p. 17). With no set-aside chosen villain to put
 * into play, Whisper has nothing to attach to and is discarded (RRG 1.8 "Attach To", p. 8). Otherwise Whisper is set
 * aside and the villain schemes.
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
  // 2A. When Revealed: 1. Set Shifting Corridors aside. 2. Find the chosen Dark Protege villain wherever it is: set
  // aside, in play as Whisper in the Dark's minion or as a villain, or in a deck or discard pile. RRG v1.8 "Find" p. 19:
  // removed-from-game cards are not searched; the trap deck and trap discard pile are. Discard each status card, token
  // and attached card from it. In play as the minion, Whisper going makes it a
  // villain where it is (a status change: no leaving or entering play, and no event says so but `villainAdded
  // asStatusChange`; that it neither leaves nor enters play is an engine reading of the rules expert's verdict). 3.
  // Reveal its side A (side B instead in expert mode): out of play it enters play as the villain (`addVillain`); in
  // play it is revealed where it is (`inPlay: "reveal"`), never added twice. Nothing found (the card was removed from the
  // game: discarded as Whisper's minion, a double-sided card, or defeated as a villain): no villain is in play and the
  // game goes on, the players unable to win, 2B's completion still losing. That is the Grim Rule (RRG v1.8 p. 4), the
  // rules expert's recommended default for owner question 8, PR #355.
  "65039a.when-revealed": whenRevealed(
    setVillainAside(find(CORRIDORS)),
    ...discardStatusesTokensAndAttachments(chosenVillain),
    ifThen(
      inMode("expert"),
      [addVillain(chosenVillain, { inPlay: "reveal" }), flipCard(chosenVillain)],
      addVillain(chosenVillain, { reveal: true, inPlay: "reveal" }),
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

  // Treat attached villain as an Elite minion with 6 printed hit points. It gains: "Guard. Villainous. When Defeated:
  // Set this minion aside."
  "65040.whisper-in-the-dark-constant": constant(
    treatAttachedVillainAsMinion([ELITE], { printedHp: 6 }),
    gainsKeyword({ name: "guard" }, ATTACHED),
    gainsKeyword({ name: "villainous" }, ATTACHED),
    gainsAbility("65040.when-defeated", { to: ATTACHED }),
  ),
  // The gained When Defeated: `self` is the villain card. Whisper is discarded with it (to the trap discard pile).
  "65040.when-defeated": whenDefeated(moveCards(cards(self), "encounterSetAside")),
  // When Revealed: If Shifting Corridors is in play, put the set-aside chosen villain into play engaged with you, side A
  // faceup, with this card attached; otherwise, set this card aside and the villain schemes.
  "65040.when-revealed": whenRevealed(
    ifThen(corridorsInPlay, putIntoPlayAsHost(chosenVillain, { villainSide: "A" }), [
      moveCards(cards(self), "encounterSetAside"),
      enemyScheme(theVillain),
    ]),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_SHADOW_LABYRINTH_SKIPPED: Readonly<Record<string, string>> = {};
