import { trait } from "@mc/content";
import {
  addCounters,
  attachCard,
  buildScenarioDeck,
  cards,
  changeVillainForm,
  chooseCards,
  chosen,
  constant,
  countersOn,
  dealAsEncounterCard,
  defineAbilities,
  each,
  eachPlayer,
  encounterCards,
  encounterSetOf,
  enemyAttack,
  enemyScheme,
  eventPlayer,
  eventTarget,
  exists,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gets,
  hasTrait,
  heroAction,
  ifThen,
  instead,
  lookAtTopOfScenarioDeckThenPlace,
  moveCards,
  not,
  on,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  removeCountersFrom,
  removeThreat,
  revealCard,
  rule,
  scenarioDeck,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  spendResources,
  stateCheck,
  takeDamageCost,
  thatPlayer,
  theVillain,
  threatOn,
  toScenarioDeck,
  uncancellable,
  valueAtLeast,
  varAtLeast,
  whenRevealed,
  you,
  firstPlayer,
} from "../../dsl/index.js";

const ESCAPED = trait("ESCAPED");
const CORNERED = trait("CORNERED");
const SHOW = trait("SHOW");

const SHOW_ENVIRONMENT = query("environment", { trait: SHOW });
const SPIRALS_SWORDS = query("attachment", { name: "Spiral's Swords" });

/** ESCAPED: "Spiral cannot take damage or be stunned. Threat cannot be removed from the main scheme." */
const escapedConstant = () =>
  constant(
    rule({ kind: "cannotTakeDamage", target: { self: true } }),
    rule({ kind: "cannotHaveStatus", target: { self: true }, statuses: ["stunned"] }),
    rule({ kind: "threatCannotBeRemoved", target: query("mainScheme") }),
  );

/**
 * ESCAPED: "[star] Forced Interrupt: When Spiral would attack, she schemes instead." Replaces every attack, whether the
 * villain phase's or a card's, before the dashed-ATK skip.
 */
const escapedForcedInterrupt = () => forcedInterrupt(on.enemyAttacks("self"), instead(enemyScheme(self)));

/** CORNERED: "If there are at least N[per_hero] teleport counters here, remove all of them and flip Spiral." */
const corneredConstant = (n: number) =>
  stateCheck(
    valueAtLeast(countersOn(self, "teleport"), perHero(n)),
    removeCountersFrom(self, "teleport", countersOn(self, "teleport")),
    flipCard(self),
  );

/** CORNERED: "[star] Forced Response: After Spiral activates, place 1 teleport counter here." */
const corneredForcedResponse = () => forcedResponse(on.enemyActivates("self"), addCounters("teleport", 1, self));

/**
 * MojoMania (`mojo`), the Spiral scenario's own encounter set (`spiral` 39012-39021, MojoMania insert pp. 11-12,
 * docs/phase7-wave6.md §7.2): Spiral I-III (ESCAPED and CORNERED faces), Across the Mojoverse, The Search for Spiral,
 * Cornered!, Spiral's Swords, Erratic Teleportation, The Show Must Go On and Well-Armed.
 *
 * The show deck (`ScenarioSeparateDeck` "show", built by 1A's Setup) holds the other SHOW environments and Cornered!;
 * only The Search for Spiral, Cornered! and Erratic Teleportation touch it, and a SHOW environment that would be
 * discarded is placed on its bottom instead (1B).
 */
export const SPIRAL_ABILITIES = defineAbilities({
  // Spiral I (39012a ESCAPED / 39012b CORNERED), II (39013), III (39014).
  "39012a.spiral-constant": escapedConstant(),
  "39012a.spiral-forced-interrupt": escapedForcedInterrupt(),
  "39013a.spiral-constant": escapedConstant(),
  "39013a.spiral-forced-interrupt": escapedForcedInterrupt(),
  "39014a.spiral-constant": escapedConstant(),
  "39014a.spiral-forced-interrupt": escapedForcedInterrupt(),

  "39012b.spiral-constant": corneredConstant(3),
  "39012b.spiral-forced-response": corneredForcedResponse(),
  "39013b.spiral-constant": corneredConstant(2),
  "39013b.spiral-forced-response": corneredForcedResponse(),
  "39014b.spiral-constant": corneredConstant(3),
  "39014b.spiral-forced-response": corneredForcedResponse(),
  // Spiral III CORNERED — When Revealed: Spiral attacks each player in player order (even in alter-ego form).
  "39014b.when-revealed": whenRevealed(forEachPlayer(eachPlayer, enemyAttack(self, { against: thatPlayer }))),

  // Across the Mojoverse 1A — Setup: Put The Search for Spiral and 1 random SHOW environment into play (not revealed).
  // Shuffle each other SHOW environment together with the Cornered! treachery to create the show deck (the scenario's
  // `separateDecks`). Flip Spiral to her ESCAPED side (where she starts, so nothing changes).
  "39015a.setup": setup(
    selectCards("search", encounterCards(["deck"], { name: "The Search for Spiral" })),
    putIntoPlay(chosen("search"), firstPlayer),
    selectCards("firstShow", encounterCards(["deck"], SHOW_ENVIRONMENT, { topmostOnly: true })),
    putIntoPlay(chosen("firstShow"), firstPlayer),
    buildScenarioDeck("show"),
    changeVillainForm(theVillain, ESCAPED),
    shuffleEncounterDeck(),
  ),
  // 1B — Forced Interrupt: When a SHOW environment would be discarded, place it on the bottom of the show deck instead.
  "39015b.across-the-mojoverse-forced-interrupt": forcedInterrupt(
    on.encounterCardDiscardedFromPlay(SHOW_ENVIRONMENT),
    instead(moveCards(cards(eventTarget), toScenarioDeck("show", "bottom"))),
  ),

  // The Search for Spiral (39016) — Permanent (data). Forced Response: After the last threat is removed from here, the
  // player who removed that threat reveals the top card of the show deck and places 3[per_hero] threat here. "The
  // player who removed that threat" is the removal's own player (`eventPlayer`): the thwarting player, or the player
  // who used the ability that removed it, this scheme's own Hero Action included.
  "39016.the-search-for-spiral-forced-response": forcedResponse(
    { on: "removeThreat", selfIs: "target" },
    ifThen(not(valueAtLeast(threatOn(self), 1)), [
      selectCards("top", scenarioDeck("show", { top: 1 })),
      revealCard(chosen("top"), eventPlayer),
      placeThreat(perHero(3), self),
    ]),
  ),
  // Hero Action: Take 2 damage → remove 3 threat from here (errata RRG 1.8 p. 69: the damage is a cost).
  "39016.the-search-for-spiral-action": heroAction({ cost: takeDamageCost(2) }, removeThreat(3, self)),

  // Cornered! (39017) — When Revealed: Flip Spiral to her CORNERED side (her new face is revealed). Reveal the top card
  // of the show deck. Shuffle this card into the show deck. This effect cannot be canceled.
  "39017.when-revealed": uncancellable(
    whenRevealed(
      changeVillainForm(theVillain, CORNERED),
      selectCards("top", scenarioDeck("show", { top: 1 })),
      revealCard(chosen("top")),
      moveCards(cards(self), toScenarioDeck("show")),
    ),
  ),

  // Spiral's Swords (39018) — Attach to Spiral, Uses (3 sword counters) (data). [star] Spiral gets +1 ATK for each sword
  // counter on this card.
  "39018.spirals-swords-constant": constant(gets("atk", countersOn(self, "sword"), query("villain"))),
  // Hero Action: If Spiral is on her CORNERED side, spend [physical][physical] → remove 1 sword counter from this card.
  "39018.spirals-swords-action": heroAction(
    { while: hasTrait(theVillain, CORNERED), cost: spend({ physical: 2 }) },
    removeCountersFrom(self, "sword", 1),
  ),

  // Erratic Teleportation (39019) — Surge (data). When Revealed: If Spiral is CORNERED, place 1 teleport counter on her.
  // If she is ESCAPED, you may spend a [mental] resource to look at the top card of the show deck and put it on the top
  // or bottom of that deck.
  "39019.when-revealed": whenRevealed(
    ifThen(hasTrait(theVillain, CORNERED), addCounters("teleport", 1, theVillain)),
    ifThen(hasTrait(theVillain, ESCAPED), [
      spendResources({ mental: 1 }, "spent"),
      ifThen(varAtLeast("spent.made"), lookAtTopOfScenarioDeckThenPlace("show")),
    ]),
  ),

  // The Show Must Go On (39020) — When Revealed: Each player searches the encounter deck and discard pile for a card
  // from the same encounter set as the current SHOW environment and deals that card to themself as a facedown
  // encounter card. (Shuffle.)
  "39020.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseCards("found", encounterCards(["deck", "discard"], encounterSetOf(each(SHOW_ENVIRONMENT))), {
        min: 1,
        max: 1,
        chooser: thatPlayer,
      }),
      dealAsEncounterCard(chosen("found"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),

  // Well-Armed (39021) — When Revealed: If a copy of Spiral's Swords is attached to Spiral, she attacks you (even if
  // you are in alter-ego form). Otherwise, search the encounter deck and discard pile for a copy of Spiral's Swords and
  // attach it to her. (Shuffle.)
  "39021.when-revealed": whenRevealed(
    ifThen(exists(SPIRALS_SWORDS), enemyAttack(theVillain, { against: you }), [
      selectCards("sword", encounterCards(["deck", "discard"], { name: "Spiral's Swords" }, { topmostOnly: true })),
      putIntoPlay(chosen("sword"), you),
      attachCard(chosen("sword"), theVillain),
    ]),
    shuffleEncounterDeck(),
  ),
});
