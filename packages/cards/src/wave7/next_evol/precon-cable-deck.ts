import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addAccelerationToken,
  after,
  aScheme,
  andThen,
  anAttackableEnemy,
  attachCard,
  attack,
  anEnemy,
  canAttachTo,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  costModifier,
  dealDamage,
  defineAbilities,
  discardDeckUntil,
  draw,
  doublesResourcesWhilePayingFor,
  each,
  eachPlayer,
  exhaustThis,
  forEachPlayer,
  forcedInterrupt,
  gets,
  giveTough,
  heal,
  heroAction,
  heroResponse,
  instead,
  moveCards,
  not,
  option,
  playOnlyIf,
  putIntoPlay,
  query,
  refMatches,
  removeThreat,
  response,
  rule,
  self,
  shuffleDeck,
  stateCheckFromEntering,
  sum,
  takesConsequentialDamage,
  teamUpCharacters,
  theVillain,
  thatPlayer,
  thwart,
  thwartTarget,
  valueAtLeast,
  varOf,
  victoryDisplayCount,
  when,
  whenDefeated,
  you,
  youHaveTrait,
  zone,
  applyRuleUntil,
  preventConsequentialDamage,
  exists,
} from "../../dsl/index.js";
import { WAR_MACHINE_PACK_CARDS } from "../../wave4/warm/war-machine-pack-cards.js";

const PSIONIC = trait("PSIONIC");
const SOLDIER = trait("SOLDIER");
const WEAPON = trait("WEAPON");
const X_FACTOR = trait("X-FACTOR");
const X_FORCE = trait("X-FORCE");
const X_MEN = trait("X-MEN");

/** "a side scheme in the victory display": player and encounter side schemes both count (docs/phase7-wave7.md §3.49). */
const SIDE_SCHEMES_IN_VICTORY_DISPLAY = victoryDisplayCount(query("sideScheme"));

const YOUR_ALLIES = query("ally", { controller: "you" });
/** "If each of your characters has the X-FORCE trait": no character you control lacks it (your identity included). */
const EACH_OF_YOUR_CHARACTERS_IS_X_FORCE = not(
  exists(query("character", { controller: "you", withoutTrait: X_FORCE })),
);

/**
 * "When Defeated: Each player may search their deck and discard pile for [a card] and put it into play. (Shuffle.)"
 * (Call for Backup, Lock and Load, Build Support). Each player in player order is asked, may pick none (a search can
 * come up empty by choice, RRG "Search", p. 39), and shuffles their deck either way. The card enters play under that
 * player's control like any put-into-play card (so the ally limit and unique rule apply), as playing it would (RRG 1.8
 * "Play, Put into Play", p. 32): an upgrade goes on its player's identity, or on the host its "attach to" text names
 * (that player chooses when several are legal; with none it stays where it was, RRG 1.8 "Attach To", p. 8).
 */
const eachPlayerMaySearchFor = (found: ReturnType<typeof query>) =>
  forEachPlayer(
    eachPlayer,
    chooseCards("found", zone(["deck", "discard"], thatPlayer, { filter: found }), {
      min: 0,
      max: 1,
      chooser: thatPlayer,
    }),
    putIntoPlay(chosen("found"), thatPlayer),
    shuffleDeck(thatPlayer),
  );

/**
 * The aspect and basic cards printed with Cable's precon (40014-40030), docs/phase7-wave7.md §7.1, §3.61.
 *
 * - **Caliban (40014)**, **Fantomex (40015)**: "After this enters play" responses (a put-into-play counts). Caliban
 *   discards from the deck until an ally of one of the three X-teams, then adds it (nothing found: nothing added).
 *   Fantomex searches the deck and discard pile for E.V.A. (may find none), puts it into play and shuffles.
 * - **Sunspot (40016)**: "After you play Sunspot from your hand": the chosen player; 1 damage (not an attack) to the
 *   villain and each minion engaged with them per [energy] used. A wild resource is generated as the type its player
 *   names, even when overpaying (ruling January 17, 2026, Ruling 4), so wilds spent count as energy.
 * - **Mission Planning (40017)**: play only if a side scheme is in the victory display (a constant, §7.1); Hero Action:
 *   until the end of the phase, your allies take no consequential damage.
 * - **Call for Backup, Establish Perimeter, Build Support (40018, 40020, 40027)**: Victory 0 is data; the starting
 *   threat per player is data. When Defeated resolves as the scheme leaves the limit (owner rulings,
 *   docs/phase7-wave7.md §4.1); a scheme discarded by the limit, or never defeated, never resolves it.
 * - **Lock and Load (40019)**: its When Defeated finds a WEAPON upgrade costing 3 or less. Psimitar and Plasma Rifle
 *   go on the finder's identity; Sidearm ("attach to an ally") on an ally, and stays in the deck when no ally is in
 *   play. Restricted is checked as the upgrade enters play.
 * - **E.V.A. (40021)**: discarded when Fantomex is not in play, a standing condition (RRG 1.8 "Ability", p. 4, constant
 *   abilities), so an E.V.A. that enters play with no Fantomex is discarded immediately, before any interrupt or
 *   response to her entering play is offered (`stateCheckFromEntering`; owner ruling, docs/phase7-wave7.md §4.1).
 *   Action, exhaust: remove 1 threat from a scheme (not a thwart), 1 damage to an enemy (not an attack), or heal 1
 *   from Fantomex.
 * - **Uncanny X-Force (40022)**: "Play under any player's control" and "Max 1 TEAM card per player" are data. While
 *   every character you control is X-FORCE (your identity included), each ally you control gets +1 THW, and takes 1
 *   less consequential damage after a thwart that thwarted a side scheme (player or encounter): the thwart reports its
 *   scheme (`thwartTarget`), read `anywhere` because a defeated side scheme has left play. A thwart divided across
 *   schemes counts when any of them is a side scheme.
 * - **Mission Leader (40023)**: costs 1 less while your identity has SOLDIER; after any side scheme is defeated, exhaust
 *   it: each player draws 1.
 * - **Deadpool (40024)**: replacement of a defeat by consequential damage: heal 3 from him instead, and an acceleration
 *   token goes on the main scheme. Damage that is not consequential defeats him as usual.
 * - **Deathlok (40025)**: Hero Response after he enters play: an upgrade costing 1 or less in any player's discard
 *   pile whose own "attach to" text allows him (`canAttachTo`: an "attach to an ally" upgrade, not an identity
 *   upgrade), attached to him. An upgrade another player owns is then controlled by Deathlok's controller (RRG 1.8
 *   "Ownership and Control", p. 31). With no such upgrade the response is not offered.
 * - **Frenemies (40026)**: Team-Up is data. Hero Action (thwart): 1 damage each to Cable and Deadpool, then 3 threat
 *   from a scheme and 3 from a different one, both thwarts by the identity.
 * - **The Power of the Mind (40028)**: its [mental] counts double while paying for a PSIONIC card.
 * - **Psimitar (40029)**: Restricted is data. After you play another PSIONIC card, exhaust: 2 damage to an enemy, an
 *   attack (so Guard, Retaliate and Toughness apply).
 * - **Sidearm (40030)**: a reprint of War Machine's Sidearm (`warm` 23035), the same definition object.
 */
export const NEXT_EVOL_PRECON_CABLE_DECK: AbilityRegistry = defineAbilities({
  "40014.caliban-response": response(
    after.entersPlay("self"),
    discardDeckUntil(query("ally", { anyTrait: [X_FACTOR, X_FORCE, X_MEN] }), "found"),
    andThen(moveCards(cards(chosen("found")), "hand")),
  ),

  "40015.fantomex-response": response(
    after.entersPlay("self"),
    chooseCards("found", zone(["deck", "discard"], you, { filter: query("support", { name: "E.V.A." }) }), {
      min: 0,
      max: 1,
    }),
    putIntoPlay(chosen("found")),
    shuffleDeck(),
  ),

  "40016.sunspot-response": response(
    after.youPlayThis(),
    choosePlayer("player"),
    dealDamage(sum(varOf("paid.energy"), varOf("paid.wild")), theVillain),
    dealDamage(
      sum(varOf("paid.energy"), varOf("paid.wild")),
      each(query("minion", { engagedWithPlayer: chosenPlayer("player") })),
    ),
  ),

  "40017.mission-planning-constant": constant(playOnlyIf(valueAtLeast(SIDE_SCHEMES_IN_VICTORY_DISPLAY, 1))),
  "40017.mission-planning-action": heroAction(
    applyRuleUntil(preventConsequentialDamage(query("ally", { controller: "you" })), "endOfPhase"),
  ),

  "40018.when-defeated": whenDefeated(eachPlayerMaySearchFor(query("ally"))),
  "40019.when-defeated": whenDefeated(eachPlayerMaySearchFor(query("upgrade", { trait: WEAPON, maxPrintedCost: 3 }))),
  "40020.when-defeated": whenDefeated(giveTough(each(query("identity")))),
  "40027.when-defeated": whenDefeated(eachPlayerMaySearchFor(query("support", { maxPrintedCost: 3 }))),

  "40021.eva-constant": stateCheckFromEntering(
    not(exists(query("ally", { name: "Fantomex" }))),
    moveCards(cards(self), "discard"),
  ),
  "40021.eva-action": action(
    { cost: exhaustThis },
    chooseOne(
      option("Remove 1 threat from a scheme", aScheme(), removeThreat(1, chosen("scheme"))),
      option("Deal 1 damage to an enemy", anEnemy(), dealDamage(1, chosen("enemy"))),
      option("Heal 1 damage from Fantomex", heal(1, each(query("ally", { name: "Fantomex" })))),
    ),
  ),

  "40022.uncanny-x-force-constant": constant(
    gets("thw", 1, YOUR_ALLIES, { while: EACH_OF_YOUR_CHARACTERS_IS_X_FORCE }),
    rule(
      takesConsequentialDamage(YOUR_ALLIES, -1, {
        from: "thwart",
        while: EACH_OF_YOUR_CHARACTERS_IS_X_FORCE,
        if: refMatches(thwartTarget(), query("sideScheme"), { anywhere: true }),
      }),
    ),
  ),

  "40023.mission-leader-constant": constant(
    costModifier({ delta: -1, appliesTo: { self: true }, while: youHaveTrait(SOLDIER), activeIn: "hand" }),
  ),
  "40023.mission-leader-response": heroResponse(
    after.schemeDefeated(query("sideScheme")),
    { cost: exhaustThis },
    forEachPlayer(eachPlayer, draw(1, thatPlayer)),
  ),

  "40024.deadpool-forced-interrupt": forcedInterrupt(
    when.defeated("self", { consequential: true }),
    instead(heal(3, self), addAccelerationToken()),
  ),

  "40025.deathlok-response": heroResponse(
    after.entersPlay("self"),
    chooseCards(
      "upgrade",
      zone("discard", eachPlayer, { filter: query("upgrade", { maxPrintedCost: 1, ...canAttachTo(self) }) }),
      { min: 1, max: 1 },
    ),
    attachCard(chosen("upgrade"), self),
  ),

  "40026.frenemies-action": heroAction(
    { label: "thwart" },
    dealDamage(1, teamUpCharacters()),
    chooseTarget("first", query("scheme")),
    thwart(3, chosen("first")),
    chooseTarget("second", query("scheme", { excludeSlots: ["first"] })),
    thwart(3, chosen("second")),
  ),

  "40028.the-power-of-the-mind-constant": constant(doublesResourcesWhilePayingFor({ trait: PSIONIC })),

  "40029.psimitar-response": heroResponse(
    after.youPlayedCard(query(["ally", "event", "upgrade", "support"], { trait: PSIONIC, excluding: self })),
    { label: "attack", cost: exhaustThis },
    anAttackableEnemy(),
    attack(2, chosen("enemy")),
  ),

  "40030.sidearm-constant": WAR_MACHINE_PACK_CARDS["23035.sidearm-constant"]!,
});
