import { trait } from "@mc/content";
import {
  action,
  addCounters,
  anAttackableEnemy,
  attack,
  bindTargets,
  chosen,
  chosenPlayer,
  chooseTarget,
  choosePlayer,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterUntil,
  draw,
  each,
  exhaustThis,
  forcedResponse,
  gainsTrait,
  gets,
  heal,
  heroAction,
  heroInterrupt,
  heroResponse,
  modifyAttack,
  modifyStat,
  on,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  removeCountersFrom,
  removeThreat,
  response,
  rule,
  self,
  theMainScheme,
  theVillain,
  when,
  YOUR_HERO,
  yourIdentity,
} from "../../dsl/index.js";

const CHARGE = "charge";
const TECH = trait("TECH");
/** "Rocket Raccoon" as a `countersOn`/`gets` target: his identity, whichever form it's in. */
const ROCKET = yourIdentity;

/**
 * Rocket Raccoon (16029a/b) and his hero kit (16030–16052). Reprints in this pack (none found by `../reprints.ts`
 * for this range) are aliased automatically, not scripted here.
 *
 * **Four documented skips, all genuine primitive gaps, not guesses:**
 * - `16032.schadenfreude-action` ("Until the end of the turn, heal 2 damage from Rocket Raccoon each time you deal
 *   any amount of damage to an enemy") needs a "grant a standing triggered ability for a duration" primitive.
 *   `RuleSpec applyRuleUntil` only carries a `RuleSpec` (a static restriction/modifier), not an arbitrary reactive
 *   ability, so there's no way to express "each time X happens, do Y" as something that itself expires.
 * - `16033.salvage-response` ("Response: After you spend this card, …") needs a trigger event for a card being
 *   spent as a resource payment — no such `TriggerEvent` kind exists; `cardBeingPlayed`/`cardPlayed` are about the
 *   card *being played*, not a different card being spent to pay for one.
 * - `16048.flora-and-fauna-constant`/`-action` (Rocket's own copy of the Team-Up card, printed identically at
 *   16020 in Groot's own card range) — "place 2 charge counters on **a Rocket Raccoon upgrade**" needs a
 *   `TargetQuery` field for "an upgrade belonging to a specific named character's card pool, independent of who
 *   controls it" (a Team-Up card can be played across two different players' hands). `TargetQuery.identitySetOf`
 *   only reaches "the current *player's* own identity-specific cards" (`PlayerRef`, not a fixed character name),
 *   which doesn't fit. Groot's own 16020 has the identical gap.
 * - `16052.booster-boots-interrupt` ("… discard the top card of your deck →") needs an `AbilityCost` component for
 *   discarding from your own deck as a cost — no such component exists (only `EffectSpec`-level deck discards,
 *   which resolve as an effect, not a payable, refusable cost). The closest precedent, `AbilityCost.
 *   dealEncounterCards` (docs/phase7-wave3.md §3.20), is a different zone; extending the cost vocabulary again
 *   deserves `game-rules-architect` input on the empty-deck-reshuffle question RRG 1.8 "Deck" (p. 15) raises for a
 *   cost specifically (a cost that can't be paid should refuse the ability, not force a reshuffle mid-payment),
 *   which is more than this pass's time allows to settle correctly.
 */
export const ROCKET_KIT = defineAbilities({
  // "Murdered You!" — Response: After you deal excess damage to an enemy, draw 1 card.
  "16029a.murdered-you": response(on.attacks("self", { excessDamage: true }), draw(1)),

  // Tinkering — Action: Choose and discard a tech upgrade you control → draw 2 cards. (Limit once per round.)
  "16029b.tinkering": action(
    { limit: { count: 1, period: "round" } },
    chooseTarget("discard", query("upgrade", { controller: "you", trait: TECH })),
    discard(chosen("discard")),
    draw(2),
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

  // Schadenfreude (16032) — see module docblock.

  // Salvage (16033) — see module docblock.

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
  // scripted here (the wording docs/phase7-wave3.md §0's Jan 26, 2026 (3) ruling names is the earlier printing).

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

  // Flora and Fauna (16048) — see module docblock.

  // Booster Boots (16052) — see module docblock.
});
