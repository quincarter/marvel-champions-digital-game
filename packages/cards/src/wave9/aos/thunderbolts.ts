import { trait } from "@mc/content";
import type { AbilityRegistry, TargetRef } from "@mc/engine";
import {
  after,
  bindTargets,
  cancelIt,
  cards,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  damageOn,
  defineAbilities,
  discard,
  exists,
  each,
  eachPlayer,
  encounterCards,
  encounterSetAside,
  engage,
  engagedPlayerOf,
  enemyActivates,
  eventPlayer,
  eventTarget,
  exhaustYourHero,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  giveStatus,
  heal,
  heroAction,
  heroResponse,
  holdMinion,
  ifElse,
  ifThen,
  inMode,
  made,
  max,
  moveCards,
  named,
  not,
  addCounters,
  allOf,
  on,
  option,
  perHero,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  remainingHpOf,
  removeCountersFrom,
  repeatTimes,
  revealCard,
  rotateEngagement,
  rule,
  selectCards,
  self,
  setAsideModularSetCount,
  setup,
  shuffleEncounterDeck,
  shuffleInSetAsideModularSet,
  spend,
  spendResources,
  sum,
  superlative,
  surge,
  andThen,
  thatPlayer,
  theMainScheme,
  theVillain,
  valueAtLeast,
  varAtLeast,
  victoryDisplayCards,
  victoryDisplayCount,
  whenDefeated,
  whenRevealed,
  countersOn,
  you,
} from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/thunderbolts` (docs/phase7-wave9.md sections 2.5, 3.21 to 3.24; MC50 p. 15): the
 * Thunderbolts scenario, Citizen V, the main scheme, the Justice, Like Lightning environment and the set's cards.
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **Setup (50130a).** The scenario builder sets 1 + 1[per_hero] modular sets aside whole (`setAsideModularSets`, from
 * the ten sets with an Elite, Thunderbolt minion). The Setup shuffles every one of them into the encounter deck, then
 * takes each Elite, Thunderbolt minion back out to the set-aside area (a shuffled-in set cannot leave its minion
 * behind: the engine shuffles whatever is still set aside) and reveals Justice, Like Lightning. Jolt is not Elite and
 * stays in the deck.
 *
 * **Justice, Like Lightning (50131a).** Each player reveals a random set-aside Thunderbolt minion (it engages them);
 * the remaining one is held by the environment: it is in play, engaged with nobody (owner questions 25 to 27 of the
 * wave 9 spec: a held minion that leaves engagement is engaged like any other, its When Revealed does not resolve
 * when it is attached, the minion is discarded undefeated if the environment leaves play). In expert mode each of
 * them gets a tough status card.
 *
 * **Thunderbolt Backup (50131b), the end-of-round swap.** "When the round ends" is the villain phase ending, after
 * step five has already passed the first player token, so "the first player chooses" among tied minions is the NEW
 * first player (MC50 p. 22 FAQ: ties, including no damage, are the first player's choice).
 *
 * **Citizen V (50129a/b).** The engine checks a stun or confuse status before "would activate", so a stunned or
 * confused Citizen V discards the status and the interrupt never runs: he does not heal (owner decision Q2 = A, MC50
 * p. 22). Step two is `gameStep enemyActivations`; Citizen V's Sword and Tap In activate him outside it, so he
 * activates normally.
 *
 * **Apprehending Rogue Agents 1B (50130b).** The "engages that player" response checks the attacked minion is still in
 * play: one the attack defeated is in the victory display and engages nobody.
 *
 * **Citizen V's Sword (50132).** The data's `attachesTo` is `{ namedCard, "Citizen V. He activates against you" }` (the
 * sentence's tail is in the name), so the card finds no host and is discarded when revealed until the content package
 * says `{ kind: "villain" }`; the tests run on the card with that one field corrected. Tap In (50138): the revealing
 * player breaks a tie for "the least damage" (the Backup's FAQ names the first player for 131B only).
 *
 * **Down but Not Out (50137).** The random Thunderbolt minion is revealed by the player who revealed the treachery, so
 * it enters play engaged with them like any revealed minion (RRG 1.8 "Reveal", p. 38, step 2), its When Revealed and
 * quickstrike included; it is not held by the environment. It comes back with no damage and takes placed damage
 * (not dealt: a tough status card stays) down to 5 remaining hit points, none if it has 5 or fewer. It leaves the
 * victory display, so Citizen V's count drops with it. "Then, remove this card from the game" is a printed Then (RRG
 * 1.8 "'Then'", p. 44): with no Thunderbolt minion in the display the reveal did not happen, the treachery is not
 * removed, gains surge and is discarded as usual.
 *
 * Cards (10):
 * - 50129a Citizen V (villain)
 * - 50130a Apprehending Rogue Agents (main_scheme)
 * - 50131a Justice, Like Lightning (environment)
 * - 50132 Citizen V's Sword (attachment)
 * - 50133 Jolt (minion)
 * - 50134 Innocent Bystanders (obligation)
 * - 50135 The Coming Storm (side_scheme)
 * - 50136 Rumbling Thunder (side_scheme)
 * - 50137 Down but Not Out (treachery)
 * - 50138 Tap In (treachery)
 */

const THUNDERBOLT = trait("THUNDERBOLT");
/** "Thunderbolt minion": a minion in play with the trait, a held one included. */
const THUNDERBOLT_MINIONS = query("minion", { trait: THUNDERBOLT });
const ELITE_THUNDERBOLT_MINIONS = query("minion", { trait: trait("ELITE"), anyTrait: [THUNDERBOLT] });
const CITIZEN_V = "Citizen V";
const JUSTICE = "Justice, Like Lightning";

/** The minion attached here (the environment's held minion). */
const HELD_HERE: TargetRef = { kind: "attachmentsOf", of: self, filter: query("minion") };
/** The minion attached here, other than the one chosen as the most damaged. */
const HELD_HERE_OTHER_THAN_MOST: TargetRef = {
  kind: "attachmentsOf",
  of: self,
  filter: query("minion", { excluding: chosen("most") }),
};

/** "During step two of the villain phase" (activate the villain against each player, then their minions). */
const duringStepTwo = { kind: "gameStep", phase: "villain", step: "enemyActivations" } as const;

/**
 * Citizen V, both faces: "cannot be defeated unless there are at least 1[per_hero] Thunderbolt minions in the victory
 * display" (a rule that holds while the count is short), and the interrupt that gives up a step-two activation against
 * a player engaged with a Thunderbolt minion to heal instead (4, or 6 on the B face).
 */
const citizenVConstant = () =>
  constant(
    rule({
      kind: "cannotBeDefeated",
      target: { self: true },
      while: not(valueAtLeast(victoryDisplayCount(THUNDERBOLT_MINIONS), perHero(1))),
    }),
  );
const citizenVInterrupt = (healed: number) =>
  forcedInterrupt(
    on.enemyActivating("self"),
    ifThen(allOf(duringStepTwo, exists(query("minion", { trait: THUNDERBOLT, engagedWithPlayer: eventPlayer }))), [
      cancelIt(),
      heal(healed, self),
    ]),
  );

/** The 50135 / 50136 When Revealed. */
const rotate = () => whenRevealed(rotateEngagement());

export const THUNDERBOLTS: AbilityRegistry = defineAbilities({
  "50129a.citizen-v-constant": citizenVConstant(),
  "50129a.citizen-v-forced-interrupt": citizenVInterrupt(4),
  "50129b.citizen-v-constant": citizenVConstant(),
  "50129b.citizen-v-forced-interrupt": citizenVInterrupt(6),

  // 1A Setup (see the module header).
  "50130a.setup": setup(
    repeatTimes(setAsideModularSetCount, shuffleInSetAsideModularSet()),
    moveCards(encounterCards(["deck"], ELITE_THUNDERBOLT_MINIONS), "encounterSetAside"),
    shuffleEncounterDeck(),
    selectCards("environment", encounterCards(["deck"], { name: JUSTICE })),
    revealCard(chosen("environment"), firstPlayer),
  ),
  // 1B: every Thunderbolt minion gains guard; a minion a player attacks engages that player (a held one included).
  "50130b.apprehending-rogue-agents-constant": constant(gainsKeyword({ name: "guard" }, THUNDERBOLT_MINIONS)),
  "50130b.apprehending-rogue-agents-forced-response": forcedResponse(
    { on: "characterAttacked", targetIs: THUNDERBOLT_MINIONS },
    // A minion the attack defeated is no longer in play and engages nobody.
    ifThen(refMatches(eventTarget, THUNDERBOLT_MINIONS), engage(eventTarget, eventPlayer)),
  ),

  "50131a.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      selectCards("minion", encounterSetAside(THUNDERBOLT_MINIONS, { random: 1 })),
      revealCard(chosen("minion"), thatPlayer),
      ifThen(inMode("expert"), giveStatus(chosen("minion"), "tough")),
    ),
    selectCards("held", encounterSetAside(THUNDERBOLT_MINIONS, { random: 1 })),
    holdMinion(chosen("held")),
    ifThen(inMode("expert"), giveStatus(chosen("held"), "tough")),
    flipCard(self),
  ),
  "50131b.thunderbolt-backup-forced-interrupt": forcedInterrupt(
    on.phaseEnding("villain"),
    bindTargets("tied", superlative("highest", each(THUNDERBOLT_MINIONS), damageOn(chosen("candidate")))),
    chooseTarget("most", { inSlot: "tied" }, { chooser: firstPlayer }),
    engage(HELD_HERE_OTHER_THAN_MOST, engagedPlayerOf(chosen("most"))),
    holdMinion(chosen("most")),
    heal(perHero(1), HELD_HERE),
    ifThen(inMode("expert"), [heal(perHero(1), HELD_HERE), giveStatus(HELD_HERE, "tough")]),
  ),

  // Attach to Citizen V is data (`attachesTo`); he then activates against the player who revealed it.
  "50132.when-revealed": whenRevealed(enemyActivates(theVillain, { against: you })),
  "50132.citizen-vs-sword-response": heroResponse(
    after.attacks(query(["identity", "ally"]), { byYou: true, target: { hostOfSelf: true }, damages: true }),
    { cost: spend({ physical: 2 }) },
    discard(self),
  ),

  // Jolt: Villainous is data.
  "50133.when-defeated": whenDefeated(placeThreat(3, theMainScheme)),
  "50133.jolt-action": heroAction(
    { cost: exhaustYourHero },
    addCounters("parley", 1),
    ifThen(valueAtLeast(countersOn(self, "parley"), 3), moveCards(cards(self), "removedFromGame")),
  ),

  // Innocent Bystanders: Uses (4 bystander counters) is data, which also discards it after the last counter.
  "50134.innocent-bystanders-constant": constant(),
  "50134.innocent-bystanders-forced-response": forcedResponse(
    on.either(
      after.attacks(query(["identity", "ally"]), { byYou: true, target: query("enemy") }),
      after.enemyAttacks(query("enemy"), { againstYou: true }),
    ),
    chooseOne(
      option("Spend 1 resource of any type", spendResources({ generic: 1 }, "spent")),
      option("Place threat on the main scheme", placeThreat(ifElse(inMode("expert"), 2, 1), theMainScheme)),
    ),
    removeCountersFrom(self, "bystander", 1),
  ),

  "50135.when-revealed": rotate(),
  "50136.when-revealed": rotate(),

  // Down but Not Out (see the module header). "This way": a minion was picked, and a picked minion is revealed.
  "50137.when-revealed": whenRevealed(
    selectCards("minion", victoryDisplayCards(THUNDERBOLT_MINIONS, { random: 1 })),
    revealCard(chosen("minion"), you),
    placeDamage(max(0, sum(remainingHpOf(chosen("minion")), -5)), chosen("minion")),
    andThen(moveCards(cards(self), "removedFromGame")),
    ifThen(not(varAtLeast("minion.count")), surge()),
  ),

  // Tap In: the revealing player breaks a tie among the least damaged minions not engaged with them.
  "50138.when-revealed": whenRevealed(
    bindTargets(
      "least",
      superlative(
        "lowest",
        each(query("minion", { trait: THUNDERBOLT, not: query("minion", { engagedWith: "you" }) })),
        damageOn(chosen("candidate")),
      ),
    ),
    chooseTarget("minion", { inSlot: "least" }),
    engage(chosen("minion"), you),
    enemyActivates(chosen("minion"), { against: you, bind: "activated" }),
    ifThen(not(made("activated")), enemyActivates(named(CITIZEN_V), { against: you })),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason: none. */
export const THUNDERBOLTS_SKIPPED: Readonly<Record<string, string>> = {};
