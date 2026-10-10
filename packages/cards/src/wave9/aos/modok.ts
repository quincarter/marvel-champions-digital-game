import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  after,
  attacksGainKeywords,
  boost,
  buildScenarioDeck,
  chooseTarget,
  choosePlayer,
  chosen,
  chosenPlayer,
  constant,
  defineAbilities,
  eachPlayer,
  eitherCost,
  encounterCards,
  encounterSetAside,
  endGame,
  eventTarget,
  excludedFromAllyLimit,
  exists,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  gets,
  heroAction,
  heroResponse,
  ifElse,
  ifThen,
  inMode,
  instead,
  moveCards,
  named,
  on,
  oneCopyOf,
  perHero,
  putIntoPlay,
  query,
  removeCountersFrom,
  removeThreat,
  resetHitPoints,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  thatPlayer,
  threatOn,
  toScenarioDeck,
  cards,
  valueEquals,
  varOf,
  when,
  whenDefeated,
  atEndOfActivation,
} from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/modok` (docs/phase7-wave9.md section 8.4). Not started: the registry is empty and nothing is
 * skipped. `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * Cards (26):
 * - 50103a M.O.D.O.K. (villain)
 * - 50104a Upgrading Adaptoids (main_scheme)
 * - 50105a Holding Cell (environment)
 * - 50105b Flying Inhuman (ally)
 * - 50106a Holding Cell (environment)
 * - 50106b Psionic Inhuman (ally)
 * - 50107a Holding Cell (environment)
 * - 50107b Sarah Garza (ally)
 * - 50108a Holding Cell (environment)
 * - 50108b Strong Inhuman (ally)
 * - 50109 Flying Upgrade (environment)
 * - 50110 Psionic Upgrade (environment)
 * - 50111 Sarah Garza Upgrade (environment)
 * - 50112 Strong Upgrade (environment)
 * - 50113 Adaptoid (minion)
 * - 50114 Automated Mobile Unit (attachment)
 * - 50115 Focusing Crystal (attachment)
 * - 50116 Nanobots (attachment)
 * - 50117 Psionic Force Field (attachment)
 * - 50118 Psionic Machetes (attachment)
 * - 50119 Reverse Engineering (attachment)
 * - 50120 A.I.M. Jailer (minion)
 * - 50121 Hostage Situation (side_scheme)
 * - 50122 Psionic Enhancement (side_scheme)
 * - 50123 "It's Alive!" (treachery)
 * - 50124 Psionic Blast (treachery)
 */

const HOLDING_CELL = named("Holding Cell");
const HOLDING_CELL_DECK = "Holding Cell";
/** "Each Adaptoid": every minion titled Adaptoid (the upgrade environments carry the Adaptoid trait, not the title). */
const ADAPTOID = query("minion", { name: "Adaptoid" });
/** "Adaptoid environment": the four upgrade environments, which have the Adaptoid trait. */
const ADAPTOID_ENVIRONMENT = query("environment", { trait: trait("ADAPTOID") });

/**
 * "Forced Interrupt: When M.O.D.O.K. would be defeated, if a Holding Cell is in play, remove 2 lock counters from it and
 * reset M.O.D.O.K.'s hit points to N instead. Otherwise, the players win the game." The villain is never defeated while
 * a cell is in play (MC50 p. 4, "Non-Scaling Villain HP"); with no cell in play the defeat stands and the players win.
 */
const modokForcedInterrupt = () =>
  forcedInterrupt(
    on.defeated("self"),
    { would: true },
    ifThen(
      exists(query("environment", { name: "Holding Cell" })),
      [instead(resetHitPoints(self)), removeCountersFrom(HOLDING_CELL, "lock", 2)],
      endGame("win"),
    ),
  );

/** Holding Cell, all four: "Enters play with 2[per_hero] lock counters on it." (put into play, never revealed) */
const cellEntersPlay = () => forcedResponse(after.entersPlay("self"), addCounters("lock", perHero(2)));
/** Holding Cell, all four: the first player chooses who controls the freed ally (MC50 p. 13: "any player's control"). */
const cellFreed = () =>
  forcedInterrupt(
    when.lastCounterRemoved("lock"),
    choosePlayer("freer", firstPlayer),
    flipCard(self, { controller: chosenPlayer("freer") }),
  );
/** Holding Cell, all four: "Hero Action: Spend [two of a type] resources or 3 resources of any type -> remove 1 lock counter." */
const cellAction = (twoOfAType: "energy" | "mental" | "physical" | "wild") =>
  heroAction(
    {
      cost: eitherCost(spend(twoOfAType === "wild" ? { wild: 1 } : { [twoOfAType]: 2 }), spend(3)),
    },
    removeCountersFrom(self, "lock", 1),
  );

/** The Inhuman allies: "Does not count against your ally limit." */
const inhumanLimit = () => constant(excludedFromAllyLimit({ self: true }));
/** The Inhuman allies: "Forced Response: After this card leaves play, flip it and place it on the bottom of the Holding Cell deck." */
const inhumanLeaves = () =>
  forcedResponse(after.leavesPlay("self"), moveCards(cards(self), toScenarioDeck(HOLDING_CELL_DECK, "bottom")));

/**
 * M.O.D.O.K. (MC50 p. 13; docs/phase7-wave9.md sections 2.4, 3.5, 3.15, 3.17, 3.18), first half. The villain's hit
 * points are fixed data (10, 14). The Holding Cell deck is built by 1A Setup; its top cell enters play (engine task 13)
 * and places 2[per_hero] lock counters on itself. Freeing a cell flips it to its Inhuman ally under a player the first
 * player chooses; the ally leaving play goes back under the deck as a cell (an empty deck puts it into play at once).
 */
export const MODOK: AbilityRegistry = defineAbilities({
  "50103a.modok-forced-interrupt": modokForcedInterrupt(),
  "50103b.modok-forced-interrupt": modokForcedInterrupt(),

  // 1A Setup: the deck, the random upgrade(s) (the others are already set aside by the builder), then each player
  // searches for a copy of Adaptoid and reveals it (the upgrades are in play first, so they apply as it enters).
  "50104a.setup": setup(
    buildScenarioDeck(HOLDING_CELL_DECK),
    selectCards("upgrades", encounterSetAside(ADAPTOID_ENVIRONMENT, { random: ifElse(inMode("expert"), 2, 1) })),
    putIntoPlay(chosen("upgrades"), firstPlayer),
    forEachPlayer(
      eachPlayer,
      selectCards("found", oneCopyOf(encounterCards(["deck"], ADAPTOID))),
      revealCard(chosen("found"), thatPlayer),
    ),
    shuffleEncounterDeck(),
  ),
  // 1B: completion is replaced by the next upgrade; none left set aside afterwards loses the game.
  "50104b.upgrading-adaptoids-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(
      selectCards("upgrade", encounterSetAside(ADAPTOID_ENVIRONMENT, { random: 1 })),
      putIntoPlay(chosen("upgrade"), firstPlayer),
    ),
    selectCards("left", encounterSetAside(ADAPTOID_ENVIRONMENT)),
    ifThen(valueEquals(varOf("left.count"), 0), endGame("loss"), [
      removeThreat(threatOn(self), self),
      moveCards(encounterCards(["discard"], ADAPTOID), "encounterDeckShuffle"),
    ]),
  ),

  // The four Holding Cells and their allies. The "constant" refs of the cells are the enters-play text (printed
  // without a timing word, resolved as a forced response to the card entering play).
  "50105a.holding-cell-constant": cellEntersPlay(),
  "50105a.holding-cell-forced-interrupt": cellFreed(),
  "50105a.holding-cell-action": cellAction("energy"),
  "50105b.flying-inhuman-constant": inhumanLimit(),
  "50105b.flying-inhuman-response": heroResponse(
    after.thwarts("self"),
    chooseTarget("scheme", query("scheme", { excluding: eventTarget })),
    removeThreat(1, chosen("scheme")),
  ),
  "50105b.flying-inhuman-forced-response": inhumanLeaves(),

  "50106a.holding-cell-constant": cellEntersPlay(),
  "50106a.holding-cell-forced-interrupt": cellFreed(),
  "50106a.holding-cell-action": cellAction("mental"),
  "50106b.psionic-inhuman-constant": inhumanLimit(),
  "50106b.psionic-inhuman-response": heroResponse(after.thwarts("self"), removeCountersFrom(HOLDING_CELL, "lock", 1)),
  "50106b.psionic-inhuman-forced-response": inhumanLeaves(),

  "50107a.holding-cell-constant": cellEntersPlay(),
  "50107a.holding-cell-forced-interrupt": cellFreed(),
  "50107a.holding-cell-action": cellAction("wild"),
  "50107b.sarah-garza-constant": inhumanLimit(),
  "50107b.sarah-garza-constant-2": constant(attacksGainKeywords(["overkill", "ranged"], { attacker: { self: true } })),
  "50107b.sarah-garza-forced-response": inhumanLeaves(),

  "50108a.holding-cell-constant": cellEntersPlay(),
  "50108a.holding-cell-forced-interrupt": cellFreed(),
  "50108a.holding-cell-action": cellAction("physical"),
  // Toughness is data.
  "50108b.strong-inhuman-constant": inhumanLimit(),
  "50108b.strong-inhuman-forced-response": inhumanLeaves(),

  // The Adaptoid upgrades: every Adaptoid minion, in play or being revealed.
  "50109.flying-upgrade-constant": constant(
    gets("sch", 1, ADAPTOID),
    gainsKeyword({ name: "incite", value: 1 }, ADAPTOID),
    gainsTrait(trait("AERIAL"), ADAPTOID),
  ),
  "50110.psionic-upgrade-constant": constant(
    gainsKeyword({ name: "villainous" }, ADAPTOID),
    gainsTrait(trait("PSIONIC"), ADAPTOID),
  ),
  "50111.sarah-garza-upgrade-constant": constant(gainsTrait(trait("ELITE"), ADAPTOID)),
  "50111.sarah-garza-upgrade-constant-2": constant(
    gets("atk", 1, ADAPTOID),
    attacksGainKeywords(["overkill", "ranged"], { attacker: ADAPTOID }),
  ),
  "50112.strong-upgrade-constant": constant(
    gets("atk", 1, ADAPTOID),
    gainsKeyword({ name: "toughness" }, ADAPTOID),
    gainsTrait(trait("BRUTE"), ADAPTOID),
  ),

  // Adaptoid: the printed star line is a reminder (no ability). The environment is the first player's choice.
  "50113.when-defeated": whenDefeated(
    chooseTarget("environment", query("environment", { hasCounter: "any" }), { chooser: firstPlayer }),
    removeCountersFrom(chosen("environment"), "any", 1),
  ),
  "50113.boost": boost(atEndOfActivation(moveCards(cards(self), "encounterDeckShuffle"))),
});

const SECOND_HALF = "second half of the module, not started";

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const MODOK_SKIPPED: Readonly<Record<string, string>> = Object.fromEntries(
  [
    "50114.automated-mobile-unit-constant",
    "50114.automated-mobile-unit-forced-response",
    "50115.focusing-crystal-forced-response",
    "50116.nanobots-forced-response",
    "50116.nanobots-forced-response-2",
    "50117.psionic-force-field-constant",
    "50117.psionic-force-field-forced-interrupt",
    "50117.boost",
    "50118.psionic-machetes-constant",
    "50118.psionic-machetes-forced-response",
    "50118.boost",
    "50119.reverse-engineering-constant",
    "50119.when-revealed",
    "50119.reverse-engineering-forced-response",
    "50120.when-revealed",
    "50121.hostage-situation-constant",
    "50121.when-revealed",
    "50121.when-defeated",
    "50122.boost",
    "50123.when-revealed",
    "50124.when-revealed-alter-ego",
    "50124.when-revealed-hero",
  ].map((ref) => [ref, SECOND_HALF]),
);
