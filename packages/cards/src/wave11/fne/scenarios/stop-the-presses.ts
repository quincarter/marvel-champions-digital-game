import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  alterEgoAction,
  cards,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  dealEncounterCard,
  dealEncounterCardsCost,
  defineAbilities,
  draw,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  eventPlayer,
  eventTarget,
  exhaust,
  exhaustCardsCost,
  exhaustThis,
  exists,
  firstPlayer,
  forcedResponse,
  forEachPlayer,
  ifElse,
  inMode,
  interrupt,
  leavingPlayLoses,
  lookAt,
  modifyAttack,
  moveCards,
  on,
  option,
  placeThreat,
  putIntoPlay,
  query,
  removeCounter,
  removeCountersFrom,
  response,
  rule,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  thatPlayer,
  theMainScheme,
  boost,
  whenRevealed,
} from "../../../dsl/index.js";
import { cancelBoostAbility, cancelBoostIcons, onBoostCardTurnedFaceup } from "../../../wave1/bkw/local.js";

const DAILY_BUGLE = trait("DAILY BUGLE");
/** A Daily Bugle support, under any player's control. */
const BUGLE_SUPPORT = query("support", { trait: DAILY_BUGLE });
/** A Daily Bugle support you control. */
const YOUR_BUGLE_SUPPORT = query("support", { trait: DAILY_BUGLE, controller: "you" });
const DAILY_BUGLE_ENVIRONMENT = query("environment", { name: "Daily Bugle" });

/** Every Daily Bugle support spends a stamina counter to act (their Uses keyword is data). */
const spendStamina = removeCounter("stamina", 1);

/**
 * The Stop the Presses! scenario (docs/phase7-wave11-scenarios.md section S7; MC60 p. 21).
 *
 * **60151a/b Stop the Presses!**: Setup finds the Daily Bugle environment in the encounter deck and puts it into play,
 * then each player (in player order) puts a random Daily Bugle support from the set-aside area (the scenario record's
 * `setAsideCardIds`, which no encounter set sweeps in: the supports are `specificTo` this scenario) into play under
 * their control, by the game's seeded RNG; each support left is removed from the game (the removed-from-game area,
 * `GameState.removedFromGame`, which is how the campaign finds the titles to record at Victory, owner Q203 = B). The
 * encounter deck is shuffled after the search (RRG 1.8 "Search", p. 39). The stage's Forced Response is "after an enemy
 * makes an undefended attack against you" (`enemyAttacks` with `againstYou`; as a response "you" is the player whose
 * character defended, who is the attacked player when nobody defended, and an undefended attack has no defender): that
 * player chooses to place 2 threat here (3 in expert mode) or to remove 1 stamina counter from a Daily Bugle support
 * they control (offered only while they control one). "If a Daily Bugle support leaves play ... the players lose the
 * game" is `leavingPlayLoses` (a support discarded for its last stamina counter leaves play); "if this stage is
 * completed" is data (`completionLoses`).
 * **60152 Daily Bugle**: "Any player can do this" is `triggerableBy: eachPlayer`; the player exhausts a ready Daily
 * Bugle support they control (the cost picks among their own) and it gains 1 stamina counter.
 * **60153 Ben Urich**: looks at the top 2 cards of the encounter deck and may discard 1; the rest stay in the same
 * order (nothing is moved but the discard).
 * **60154 Betty Brant**: an Interrupt to a boost card turned faceup (RRG 1.8 p. 5: the interrupt precedes the card's
 * Boost ability, so the ability can be cancelled), cancelling its icons and its Boost ability, then giving the
 * activating enemy 1 additional boost card for this activation (`modifyAttack.extraBoostCards` reads either kind of
 * activation).
 * **60155 J. Jonah Jameson**: the facedown encounter card dealt to the user is part of the cost.
 * **60156 Robbie Robertson**: a Response to any player's being dealt a facedown encounter card (a deal paid as a cost
 * included): the user looks at it and may discard it, dealing that player another one.
 * **60157 Exclusive Interview**: Daily Bugle supports cannot ready (any effect, `cannotReady` with no source limit);
 * When Revealed exhausts each of them.
 * **60158 Breaking News**: When Revealed, the revealing player chooses between exhausting a Daily Bugle support, any
 * player's, and removing 1 stamina counter from it, or placing 2 threat on the main scheme. No "you" and no "choose"
 * names who picks the support, so the first player does (RRG 1.8 "First Player", p. 19). Its Boost exhausts one.
 *
 * Cards (8):
 * - 60151a Stop the Presses! (main_scheme)
 * - 60152 Daily Bugle (environment)
 * - 60153 Ben Urich (support)
 * - 60154 Betty Brant (support)
 * - 60155 J. Jonah Jameson (support)
 * - 60156 Robbie Robertson (support)
 * - 60157 Exclusive Interview (side_scheme)
 * - 60158 Breaking News (treachery)
 */
export const FNE_SCENARIOS_STOP_THE_PRESSES: AbilityRegistry = defineAbilities({
  "60151a.setup": setup(
    selectCards("environment", encounterCards(["deck"], DAILY_BUGLE_ENVIRONMENT)),
    putIntoPlay(chosen("environment"), firstPlayer),
    forEachPlayer(
      eachPlayer,
      selectCards("support", encounterSetAside(BUGLE_SUPPORT, { random: 1 })),
      putIntoPlay(chosen("support"), thatPlayer),
    ),
    selectCards("unused", encounterSetAside(BUGLE_SUPPORT)),
    moveCards(cards(chosen("unused")), "removedFromGame"),
    shuffleEncounterDeck(),
  ),
  "60151b.stop-the-presses-forced-response": forcedResponse(
    on.enemyAttacks(query("enemy"), { againstYou: true, undefended: true }),
    chooseOne(
      option("Place 2 threat here (3 threat in expert mode)", placeThreat(ifElse(inMode("expert"), 3, 2), self)),
      option(
        "Remove 1 stamina counter from a Daily Bugle support you control",
        { when: exists(YOUR_BUGLE_SUPPORT) },
        // No "choose": an encounter card targeting one of several eligible cards; the first player selects
        // (RRG 1.8 "First Player", p. 19).
        chooseTarget("support", YOUR_BUGLE_SUPPORT, { chooser: firstPlayer }),
        removeCountersFrom(chosen("support"), "stamina", 1),
      ),
    ),
  ),
  "60151b.stop-the-presses-constant": constant(leavingPlayLoses(BUGLE_SUPPORT)),

  "60152.daily-bugle-action": alterEgoAction(
    { cost: exhaustCardsCost(YOUR_BUGLE_SUPPORT, { bind: "exhausted" }), triggerableBy: eachPlayer },
    addCounters("stamina", 1, chosen("exhausted")),
  ),

  "60153.ben-urich-action": action(
    { cost: [exhaustThis, spendStamina] },
    selectCards("looked", encounterCards(["deck"], undefined, 2)),
    chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 1 }),
    moveCards(cards(chosen("discarded")), "discard"),
  ),

  "60154.betty-brant-interrupt": interrupt(
    onBoostCardTurnedFaceup(),
    { cost: [exhaustThis, spendStamina] },
    cancelBoostIcons(),
    cancelBoostAbility(),
    modifyAttack({ extraBoostCards: 1 }),
  ),

  "60155.j-jonah-jameson-action": action({ cost: [exhaustThis, spendStamina, dealEncounterCardsCost(1)] }, draw(2)),

  "60156.robbie-robertson-response": response(
    on.aPlayerIsDealtAnEncounterCard(),
    { cost: [exhaustThis, spendStamina] },
    lookAt(cards(eventTarget)),
    chooseOne(
      option(
        "Discard it and deal that player another facedown encounter card",
        moveCards(cards(eventTarget), "discard"),
        dealEncounterCard(eventPlayer),
      ),
      option("Keep it"),
    ),
  ),

  "60157.exclusive-interview-constant": constant(rule({ kind: "cannotReady", target: BUGLE_SUPPORT })),
  "60157.when-revealed": whenRevealed(exhaust(each(BUGLE_SUPPORT))),

  "60158.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Exhaust a Daily Bugle support and remove 1 stamina counter from it",
        { when: exists(BUGLE_SUPPORT) },
        chooseTarget("support", BUGLE_SUPPORT, { chooser: firstPlayer }),
        exhaust(chosen("support")),
        removeCountersFrom(chosen("support"), "stamina", 1),
      ),
      option("Place 2 threat on the main scheme", placeThreat(2, theMainScheme)),
    ),
  ),
  "60158.boost": boost(chooseTarget("support", BUGLE_SUPPORT, { chooser: firstPlayer }), exhaust(chosen("support"))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_SCENARIOS_STOP_THE_PRESSES_SKIPPED: Readonly<Record<string, string>> = {};
