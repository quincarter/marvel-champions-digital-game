import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  activatingEnemy,
  activationIs,
  addCounters,
  after,
  andThen,
  attachCard,
  attacksGainKeywords,
  bindTargets,
  boost,
  buildScenarioDeck,
  chooseTarget,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  damagedAtLeast,
  dealEncounterCard,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  detach,
  discard,
  each,
  eachPlayer,
  eitherCost,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyAttack,
  enemyScheme,
  eventAmount,
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
  heal,
  heroAction,
  host,
  heroResponse,
  ifElse,
  ifThen,
  inMode,
  instead,
  modifyAttack,
  moveCards,
  named,
  on,
  oneCopyOf,
  perHero,
  placeDamage,
  preventAllDamageTo,
  printedCostOf,
  putIntoPlay,
  query,
  remainingHpOf,
  removeCountersFrom,
  removeThreat,
  resetHitPoints,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  statOf,
  superlative,
  thatPlayer,
  theVillain,
  threatOn,
  toScenarioDeck,
  topOfDeck,
  tuckCards,
  tuckedUnderRef,
  cards,
  valueEquals,
  varOf,
  when,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  atEndOfActivation,
} from "../../dsl/index.js";

/**
 * Wave 9 scripting module `aos/modok` (docs/phase7-wave9.md section 8.4). `card-groups.ts` maps this module to the ids
 * below; keep the two in step.
 *
 * **The reset and the "+5 hit points" attachment (owner decision Q3 = A).** M.O.D.O.K.'s interrupt resets his hit
 * points to the printed 10 (14) with `resetHitPoints(self, { to })`: with Automated Mobile Unit's +5 on him that is 10
 * of 15. Each attachment then answers "After M.O.D.O.K.'s hit points are reset" by leaving, and the +5 ending lowers
 * the dial by 5 (RRG 1.8 "Hit Points", p. 22), so he ends at 5 (9) of 10 (14). With no such attachment he ends at 10 (14).
 *
 * **Reverse Engineering (50119)**: X (the printed cost of the card tucked here) is added to both ATK and SCH
 * (provenance: the scan prints +X SCH and +X ATK); the data carries no flat modifier for it.
 *
 * **A.I.M. Jailer (50120)**: the first player picks among the Rescued allies tied for the fewest remaining hit points
 * (RRG 1.8 "First Player", p. 19); the attack is an ordinary enemy attack on that ally, answered for the ally's
 * controller (owner decision Q5 = A); the hostage below is no candidate. **Hostage Situation (50121)**: the first
 * player attaches a Rescued ally a player controls (`attachCard` with `as: "captive"`): it stays in play on the scheme
 * under no player's control, used and readied by nobody, until the defeating player takes control of it. The card's
 * constant protects M.O.D.O.K. only: the hostage can still be damaged and defeated (it then returns to the Holding
 * Cell deck by its own Forced Response).
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
const modokForcedInterrupt = (to: 10 | 14) =>
  forcedInterrupt(
    on.defeated("self"),
    { would: true },
    ifThen(
      exists(query("environment", { name: "Holding Cell" })),
      [instead(resetHitPoints(self, { to })), removeCountersFrom(HOLDING_CELL, "lock", 2)],
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

/** The card an attachment is attached to: "attached enemy", "M.O.D.O.K." (the attachments attach to him by data). */
const HOST_ENEMY = query("enemy", { hostOfSelf: true });
/**
 * The Rescued allies a player controls: a friendly-character query (identity or ally) never matches an ally no player
 * controls, such as the hostage of Hostage Situation (`isCaptiveAlly`; ruling Jun 25, 2026 (4) #5), and no identity has
 * the Rescued trait.
 */
const RESCUED_CONTROLLED = query(["identity", "ally"], { trait: trait("RESCUED") });

/** "Forced Response: After M.O.D.O.K.'s hit points are reset, discard this card." (50114, 50115, 50116, 50118, 50119) */
const discardAfterReset = () => forcedResponse(on.hitPointsReset("host"), discard(self));

/**
 * M.O.D.O.K. (MC50 p. 13; docs/phase7-wave9.md sections 2.4, 3.5, 3.15, 3.17, 3.18), first half. The villain's hit
 * points are fixed data (10, 14). The Holding Cell deck is built by 1A Setup; its top cell enters play (engine task 13)
 * and places 2[per_hero] lock counters on itself. Freeing a cell flips it to its Inhuman ally under a player the first
 * player chooses; the ally leaving play goes back under the deck as a cell (an empty deck puts it into play at once).
 */
export const MODOK: AbilityRegistry = defineAbilities({
  "50103a.modok-forced-interrupt": modokForcedInterrupt(10),
  "50103b.modok-forced-interrupt": modokForcedInterrupt(14),

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

  // Second half. The attachments ("Attach to M.O.D.O.K." is data); each leaves when his hit points are reset (Q3 = A).
  "50114.automated-mobile-unit-constant": constant(gets("hp", 5, HOST_ENEMY)),
  "50114.automated-mobile-unit-forced-response": discardAfterReset(),
  "50115.focusing-crystal-forced-response": discardAfterReset(),
  // Nanobots: the star Forced Response (heal) first, the reset one second; the heal is the host's own.
  "50116.nanobots-forced-response": forcedResponse(on.enemyActivates("host"), heal(1, host)),
  "50116.nanobots-forced-response-2": discardAfterReset(),
  "50117.psionic-force-field-constant": constant(gainsKeyword({ name: "stalwart" }, HOST_ENEMY)),
  // "Then" is the printed word: the discard is read after the damage is placed, so a hit that brings it to 5 is absorbed.
  "50117.psionic-force-field-forced-interrupt": forcedInterrupt(
    when.damage("host"),
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 5), discard(self)))),
  ),
  "50117.boost": boost(attachCard(self, activatingEnemy)),
  "50118.psionic-machetes-constant": constant(attacksGainKeywords(["piercing"], { attacker: HOST_ENEMY })),
  "50118.psionic-machetes-forced-response": discardAfterReset(),
  "50118.boost": boost(ifThen(activationIs("attack"), modifyAttack({ keywords: ["piercing"] }))),
  // Reverse Engineering: X is the tucked card's printed cost, added to ATK and SCH. Tuck an upgrade you control,
  // otherwise the top card of your deck (the player chooses among several upgrades).
  "50119.reverse-engineering-constant": constant(
    gets("atk", printedCostOf(tuckedUnderRef(self)), HOST_ENEMY),
    gets("sch", printedCostOf(tuckedUnderRef(self)), HOST_ENEMY),
  ),
  "50119.when-revealed": whenRevealed(
    ifThen(
      exists(query("upgrade", { controller: "you" })),
      [chooseTarget("upgrade", query("upgrade", { controller: "you" })), tuckCards(cards(chosen("upgrade")), self)],
      tuckCards(topOfDeck(1, you), self),
    ),
  ),
  "50119.reverse-engineering-forced-response": discardAfterReset(),

  // A.I.M. Jailer: Guard is data. The Rescued ally with the fewest remaining hit points (the first player breaks a
  // tie) is attacked; with none, a lock counter goes on the Holding Cell. An enemy attack is made against a player
  // (RRG 1.8 "Attack (Enemy Activation)", p. 8), so the hostage of Hostage Situation, which no player controls, is not
  // a candidate (docs/phase7-wave9.md section 3.19, as read): with only the hostage in play the "Otherwise" applies.
  "50120.when-revealed": whenRevealed(
    ifThen(
      exists(RESCUED_CONTROLLED),
      [
        bindTargets("fewest", superlative("lowest", each(RESCUED_CONTROLLED), remainingHpOf(chosen("candidate")))),
        chooseTarget("victim", { inSlot: "fewest" }, { chooser: firstPlayer }),
        enemyAttack(self, { targetCharacter: chosen("victim") }),
      ],
      addCounters("lock", 1, HOLDING_CELL),
    ),
  ),

  // Hostage Situation. The text names no chooser, so the first player picks the ally (RRG 1.8 "First Player", p. 19);
  // with no Rescued ally in play nothing is attached and the scheme stays, still stopping the damage (the card prints
  // no alternative). `as: "captive"` leaves the ally in play on the scheme under no player's control.
  "50121.hostage-situation-constant": constant(preventAllDamageTo(query("villain", { name: "M.O.D.O.K." }))),
  "50121.when-revealed": whenRevealed(
    chooseTarget("hostage", RESCUED_CONTROLLED, { chooser: firstPlayer }),
    attachCard(chosen("hostage"), self, { as: "captive" }),
  ),
  "50121.when-defeated": whenDefeated(detach(each(query("ally", { host: self })), defeatingPlayer)),

  "50122.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // "It's Alive!": each player searches the deck and discard pile for an Adaptoid and reveals it, the deck is shuffled,
  // and a player who found none is dealt a facedown encounter card (nobody is left to find one after the first miss).
  "50123.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      selectCards("found", oneCopyOf(encounterCards(["deck", "discard"], ADAPTOID))),
      ifThen(
        valueEquals(varOf("found.count"), 0),
        [shuffleEncounterDeck(), dealEncounterCard(thatPlayer)],
        [revealCard(chosen("found"), thatPlayer), shuffleEncounterDeck()],
      ),
    ),
  ),

  // Psionic Blast.
  "50124.when-revealed-alter-ego": whenRevealedAlterEgo(confuse(yourIdentity), enemyScheme(theVillain)),
  "50124.when-revealed-hero": whenRevealedHero(
    dealIndirectDamage(you, statOf(theVillain, "sch"), { bind: "blast" }),
    andThen(confuse(chosen("blast.damaged"))),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const MODOK_SKIPPED: Readonly<Record<string, string>> = {};
