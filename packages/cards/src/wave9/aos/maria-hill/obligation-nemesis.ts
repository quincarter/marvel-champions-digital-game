import type { AbilityRegistry } from "@mc/engine";
import { trait } from "@mc/content";
import {
  after,
  alterEgoAction,
  addCounters,
  anyOfCards,
  atMost,
  cards,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  coveredByEngineRule,
  defineAbilities,
  discard,
  each,
  encounterCards,
  encounterSetAside,
  eachPlayer,
  exhaustYourHero,
  exists,
  forcedResponse,
  gets,
  ifThen,
  inPlay,
  on,
  placeThreat,
  putIntoPlay,
  putIntoPlayFacedown,
  query,
  removeCountersFrom,
  repeatWhile,
  selectCards,
  setAside,
  shuffleEncounterDeck,
  theMainScheme,
  whenDefeated,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

const CONTROLLED = trait("CONTROLLED");
/** "Maria Hill" the identity, whoever controls it: an encounter card has no controller, so `you` is nobody there. */
const HILL_PLAYER = controllerOf(each(query("identity", { name: "Maria Hill" })));
const CONTROLLED_MINIONS = query("minion", { trait: CONTROLLED });
const FACEDOWN_CONTROLLED = query("minion", { trait: CONTROLLED, facedown: true });
/** "a support" with an all-purpose counter to take (a support without one cannot have one removed). */
const SUPPORT_WITH_COUNTER = query("support", { hasCounter: "any" });

/** "Put the top card of your deck into play facedown, engaged with you as a Controlled minion." */
const controlledFromDeck = putIntoPlayFacedown(you, { kind: "minion", traits: [CONTROLLED] });

/**
 * Wave 9 scripting module `aos/maria-hill/obligation-nemesis` (docs/phase7-wave9.md section 8.4, 3.6, 3.32).
 *
 * Cards (5):
 * - 50029 Press Conference (obligation)
 * - 50030 Controller (minion)
 * - 50031 Army of the Controlled (side_scheme)
 * - 50032 Controlled Innocents (environment)
 * - 50033 Diabolical Discs (treachery)
 *
 * **Press Conference (50029)**: "Give to the Maria Hill player" is data and engine rule. Forced Response after the
 * player phase ends: 1 all-purpose counter of any type comes off each support its holder controls (a uses support
 * emptied is discarded, RRG p. 46). Alter-Ego Action: exhaust the identity to discard it.
 *
 * **Controller (50030)**: Forced Response after it activates against you (attack or scheme): remove 1 all-purpose
 * counter from a support (any support holding one; nothing to choose is nothing to remove), then, with Controlled
 * Innocents in play, a facedown Controlled minion engaged with you.
 *
 * **Army of the Controlled (50031)**: When Revealed finds Controlled Innocents (encounter deck, discard pile or set
 * aside) and puts it into play. When Defeated: each Controlled minion is discarded (a discard is not a defeat, so
 * Controlled Innocents places no threat), and for each one the Maria Hill player places 1 all-purpose counter on a
 * support of their choice (counter by counter, so they may be spread). Written as a loop over the minions left in
 * play because the DSL has no "once per card discarded" count.
 *
 * **Controlled Innocents (50032)**: facedown Controlled minions have base SCH, ATK and hit points of 1. Forced
 * Response: "After a Controlled minion is defeated, place that card in its owner's discard pile and place 1 threat on
 * the main scheme." The defeat is matched against what the card was in play (a minion with the Controlled trait; by
 * the response it is a player card in a discard pile again, engine `characterDefeated.asDefeated`, section 3.32), once
 * per defeated minion. Only a defeat answers it: a discard (Army of the Controlled) is not one. "Place that card in
 * its owner's discard pile" is the engine's rule for a facedown top-of-deck card leaving play.
 *
 * **Diabolical Discs (50033)**: Surge is data. When Revealed: remove 1 all-purpose counter from a support (when one
 * holds any), then with Controlled Innocents in play, a facedown Controlled minion engaged with you.
 */
export const MARIA_HILL_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "50029.obligation": coveredByEngineRule(),
  "50029.press-conference-forced-response": forcedResponse(
    on.phaseEnding("player"),
    removeCountersFrom(each(query("support", { controller: "you" })), "any", 1),
  ),
  "50029.press-conference-action": alterEgoAction({ cost: exhaustYourHero }, discard({ kind: "self" })),

  "50030.controller-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    chooseTarget("support", SUPPORT_WITH_COUNTER),
    removeCountersFrom(chosen("support"), "any", 1),
    ifThen(inPlay("Controlled Innocents"), controlledFromDeck),
  ),

  "50031.when-revealed": whenRevealed(
    selectCards(
      "innocents",
      atMost(
        1,
        anyOfCards(
          encounterCards(["deck", "discard"], { name: "Controlled Innocents" }),
          setAside(eachPlayer, { name: "Controlled Innocents" }),
          encounterSetAside({ name: "Controlled Innocents" }),
        ),
      ),
    ),
    shuffleEncounterDeck(),
    putIntoPlay(chosen("innocents")),
  ),
  "50031.when-defeated": whenDefeated(
    ifThen(
      exists(CONTROLLED_MINIONS),
      repeatWhile(
        exists(CONTROLLED_MINIONS),
        selectCards("minion", atMost(1, cards(each(CONTROLLED_MINIONS)))),
        discard(chosen("minion")),
        chooseTarget("support", query("support"), { chooser: HILL_PLAYER }),
        addCounters("allPurpose", 1, chosen("support")),
      ),
    ),
  ),

  "50032.controlled-innocents-constant": constant(
    gets("sch", 1, FACEDOWN_CONTROLLED, { setBase: true }),
    gets("atk", 1, FACEDOWN_CONTROLLED, { setBase: true }),
    gets("hp", 1, FACEDOWN_CONTROLLED, { setBase: true }),
  ),
  "50032.controlled-innocents-forced-response": forcedResponse(
    on.defeated(CONTROLLED_MINIONS),
    placeThreat(1, theMainScheme),
  ),

  "50033.when-revealed": whenRevealed(
    chooseTarget("support", SUPPORT_WITH_COUNTER),
    removeCountersFrom(chosen("support"), "any", 1),
    ifThen(inPlay("Controlled Innocents"), controlledFromDeck),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MARIA_HILL_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
