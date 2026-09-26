import { trait } from "@mc/content";
import {
  andThen,
  action,
  addCounters,
  anAttackableEnemy,
  attack,
  bindTargets,
  cards,
  chosen,
  chosenPlayer,
  chooseCards,
  chooseOne,
  chooseTarget,
  choosePlayer,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterUntil,
  discardTopOfDeckCost,
  draw,
  each,
  eachTimeUntil,
  exhaustThis,
  exists,
  forcedResponse,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  modifyAttack,
  modifyStat,
  moveCards,
  ofTeamUpSet,
  on,
  option,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  removeCountersFrom,
  removeThreat,
  response,
  rule,
  self,
  teamUpCharacters,
  theMainScheme,
  theVillain,
  when,
  you,
  YOUR_HERO,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

const CHARGE = "charge";
/** Groot's own counter type, needed only for Flora and Fauna's "place 2 growth counters on Groot" branch — the
 * same counter type name `gmw/groot-kit.ts` uses for its own copy of this card. */
const GROWTH = "growth";
const TECH = trait("TECH");
/** "Rocket Raccoon" as a `countersOn`/`gets` target: his identity, whichever form it's in. */
const ROCKET = yourIdentity;

/**
 * Rocket Raccoon (16029a/b) and his hero kit (16030–16052). Reprints in this pack (none found by `../reprints.ts`
 * for this range) are aliased automatically, not scripted here.
 *
 * Four refs recorded in an earlier scripting pass as primitive gaps are now closed (docs/phase7-wave3.md
 * §3.30, §3.31, §3.33, §3.34; docs/phase7-wave3-scripting.md §6d):
 * - `16032.schadenfreude-action`: `eachTimeUntil` + `on.youDealDamage` (§3.30).
 * - `16033.salvage-response`: the existing `resourcesSpent`/`on.youSpendThis()` trigger (§3.31).
 * - `16052.booster-boots-interrupt`: the new `AbilityCost.discardFromDeck` (§3.33).
 * - `16048.flora-and-fauna-action` (Rocket's own copy of the Team-Up card, printed identically at 16020 in Groot's
 *   own card range, scripted there with the identical composition): `TargetQuery.titled`/`identitySetTitled`,
 *   DSL `teamUpCharacters(i)`/`ofTeamUpSet(i)` (§3.34).
 */
export const ROCKET_KIT = defineAbilities({
  // "Murdered You!" — Response: After you deal excess damage to an enemy, draw 1 card.
  "16029a.murdered-you": response(on.attacks("self", { excessDamage: true }), draw(1)),

  // Tinkering — Action: Choose and discard a tech upgrade you control → draw 2 cards. (Limit once per round.)
  "16029b.tinkering": action(
    { limit: { count: 1, period: "round" } },
    // The cost is modeled as the text before a "then": with no Tech upgrade to discard, nothing is drawn, and the
    // action cannot be used (RRG 1.8 "Choose (Game Element)", p. 12; "'Then'", p. 44).
    chooseTarget("discard", query("upgrade", { controller: "you", trait: TECH })),
    discard(chosen("discard")),
    andThen(draw(2)),
  ),

  // I've Got a Plan — Hero Response: After you make a basic thwart (using your THW), ready Rocket Raccoon. Rocket
  // Raccoon gets +1 THW while in hero form until the end of the phase.
  "16030.ive-got-a-plan-response": heroResponse(
    when.thwarts(YOUR_HERO, { basic: true }),
    ready(ROCKET),
    modifyStat("thw", 1, ROCKET, "endOfPhase"),
  ),

  // Reload — Hero Action: Ready each tech upgrade you control.
  "16031.reload-action": heroAction(ready(each(query("upgrade", { controller: "you", trait: TECH })))),

  // Schadenfreude — Hero Action: Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal
  // any amount of damage to an enemy. `on.youDealDamage` reads "you" as your identity, event, resource or
  // upgrade cards (RRG 1.8 "You, Your") and the event's own dealt amount, not the amount actually taken, so a
  // hit fully absorbed by the enemy's own tough status card still heals (§3.30).
  "16032.schadenfreude-action": heroAction(
    eachTimeUntil("endOfTurn", on.youDealDamage(query("enemy")), heal(2, ROCKET)),
  ),

  // Salvage — Response: After you spend this card, put a tech upgrade from your discard pile on top of your
  // deck. Fires after every cost is paid and before the paid-for card starts being played (§3.31).
  "16033.salvage-response": response(
    on.youSpendThis(),
    chooseCards("tech", zone("discard", you, { filter: query("upgrade", { trait: TECH }) }), { min: 1, max: 1 }),
    moveCards(cards(chosen("tech")), "deckTop"),
  ),

  // Battery Pack — Enters play with 2 charge counters on it. Action: Exhaust Battery Pack → move a charge counter
  // from this card to another tech upgrade you control.
  "16034.battery-pack-constant": forcedResponse(on.entersPlay("self"), addCounters(CHARGE, 2, self)),
  "16034.battery-pack-action": action(
    { cost: exhaustThis },
    bindTargets("battery", self),
    chooseTarget("target", query("upgrade", { controller: "you", trait: TECH, excludeSlots: ["battery"] })),
    removeCountersFrom(self, CHARGE, 1),
    addCounters(CHARGE, 1, chosen("target")),
  ),

  // Cybernetic Skeleton — You get +3 hit points. While in hero form, Rocket Raccoon gets +1 ATK.
  "16035.cybernetic-skeleton-constant": constant(gets("hp", 3, query("identity", { controller: "you" }))),
  "16035.cybernetic-skeleton-constant-2": constant(gets("atk", 1, YOUR_HERO)),

  // Particle Cannon — Restricted (data). Enters play with 2 charge counters on it. Hero Action (attack): Exhaust
  // Particle Cannon and remove 1 charge counter from it → deal 4 damage to an enemy. This attack gains overkill
  // and ranged.
  "16036.particle-cannon-constant": forcedResponse(on.entersPlay("self"), addCounters(CHARGE, 2, self)),
  "16036.particle-cannon-action": heroAction(
    { label: "attack", cost: [exhaustThis, removeCounter(CHARGE, 1)] },
    anAttackableEnemy(),
    attack(4, chosen("enemy"), { overkill: true, keywords: ["ranged"] }),
  ),

  // Rocket Launcher — Restricted (data). Enters play with 2 charge counters on it. Hero Action: Exhaust Rocket
  // Launcher and remove 1 charge counter from it → choose a player. Deal 2 damage to the villain and each minion
  // engaged with that player. Same shape as Hawkeye's Explosive Arrow (`trors` 04006).
  "16037.rocket-launcher-constant": forcedResponse(on.entersPlay("self"), addCounters(CHARGE, 2, self)),
  "16037.rocket-launcher-action": heroAction(
    { cost: [exhaustThis, removeCounter(CHARGE, 1)] },
    choosePlayer("player"),
    dealDamage(2, theVillain),
    dealDamage(2, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
  ),

  // Rocket's Pistol — Restricted (data). Enters play with 3 charge counters on it. Hero Action (attack): Exhaust
  // Rocket's Pistol and remove 1 charge counter from it → deal 2 damage to an enemy.
  "16038.rockets-pistol-constant": forcedResponse(on.entersPlay("self"), addCounters(CHARGE, 3, self)),
  "16038.rockets-pistol-action": heroAction(
    { label: "attack", cost: [exhaustThis, removeCounter(CHARGE, 1)] },
    anAttackableEnemy(),
    attack(2, chosen("enemy")),
  ),

  // Thruster Boots — While in hero form, Rocket Raccoon gets +1 THW and gains the aerial trait.
  "16039.thruster-boots-constant": constant(gets("thw", 1, YOUR_HERO), gainsTrait(trait("AERIAL"), YOUR_HERO)),

  // Bug — Hero Response: After your hero makes a basic attack, heal 1 damage from Bug.
  "16040.bug-response": heroResponse(when.attacks(YOUR_HERO, { basic: true }), heal(1, self)),

  // Chase Them Down (16041) reprints an earlier "Response (thwart): After your hero attacks and defeats an
  // enemy, remove 2 threat from a scheme" card verbatim — aliased by `../reprints.ts`, not scripted here.

  // Into the Fray (16042) reprints an earlier "Deal 6 damage to a minion. For each point of excess damage dealt
  // by this attack, remove 1 threat from the main scheme" card verbatim — aliased by `../reprints.ts`, not
  // scripted here (the wording docs/phase7-wave3.md §0's Jan 26, 2026 (3) ruling names is the earlier printing). That
  // ruling's "excess dealt" count is superseded by RRG 1.8 "Overkill" (p. 31): it counts what overkill would spill.

  // Looking for Trouble — Hero Action (thwart): Discard cards from the top of the encounter deck until you
  // discard a minion. Put that minion into play engaged with you → remove 3 threat from the main scheme.
  // `putIntoPlay` auto-engages a minion with its controller (`resolve/apply-effect.ts`).
  "16043.looking-for-trouble-action": heroAction(
    { label: "thwart" },
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found")),
    removeThreat(3, theMainScheme),
  ),

  // Relentless Assault (16044) reprints an earlier "Deal 5 damage to a minion; overkill if paid with [physical]"
  // card verbatim — aliased by `../reprints.ts`, not scripted here.

  // Follow Through — Hero Interrupt: When your hero's attack deals any amount of excess damage, increase that
  // amount by 1. Modeled as a constant, not the printed optional interrupt (docs/phase7-wave3.md §3.18/§4 Q10):
  // declining is never better than accepting for any `gmw` card.
  "16045.follow-through-interrupt": constant(rule({ kind: "excessDamageBonus", attacker: YOUR_HERO, amount: 1 })),

  // Hand Cannon — Restricted (data). Uses (3 charge counters) (data). Hero Interrupt: When your hero makes a
  // basic attack, exhaust Hand Cannon and remove 1 charge counter from it → your hero gets +2 ATK for that
  // attack. That attack gains overkill.
  "16046.hand-cannon-interrupt": heroInterrupt(
    when.attacks(YOUR_HERO, { basic: true }),
    { cost: [exhaustThis, removeCounter(CHARGE, 1)] },
    modifyStat("atk", 2, ROCKET, "endOfAttack"),
    modifyAttack({ overkill: true }),
  ),

  // Groot (16047, the ally) — Play only if your identity has the guardian trait (data, `playRestrictions`).
  // Response: After Groot defends against an attack, heal 2 damage from him.
  "16047.groot-response": response(when.defends(query("ally", { self: true })), heal(2, self)),

  // Flora and Fauna — Team-Up (Groot and Rocket Raccoon). Hero Action: Place 2 growth counters on Groot (to a
  // maximum of 10) and ready him, or place 2 charge counters on a Rocket Raccoon upgrade and ready that upgrade.
  // Identical composition to Groot's own 16020 (module docblock, §3.34).
  "16048.flora-and-fauna-action": heroAction(
    chooseOne(
      option(
        "Place 2 growth counters on Groot and ready him",
        addCounters(GROWTH, 2, teamUpCharacters(0), { upTo: 10 }),
        ready(teamUpCharacters(0)),
      ),
      option(
        "Place 2 charge counters on a Rocket Raccoon upgrade and ready it",
        { when: exists(query("upgrade", ofTeamUpSet(1))) },
        chooseTarget("upgrade", query("upgrade", ofTeamUpSet(1))),
        addCounters("charge", 2, chosen("upgrade")),
        ready(chosen("upgrade")),
      ),
    ),
  ),

  // Booster Boots — Hero Interrupt: When you would take any amount of damage from an attack, exhaust Booster
  // Boots and discard the top card of your deck → prevent 1 of that damage (§3.33).
  "16052.booster-boots-interrupt": heroInterrupt(
    when.damage(YOUR_IDENTITY, { fromAttack: true }),
    { cost: [exhaustThis, discardTopOfDeckCost()] },
    preventDamage(1),
  ),
});
