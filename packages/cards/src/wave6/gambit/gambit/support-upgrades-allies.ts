import type { EventPattern } from "@mc/engine";
import {
  addCounters,
  after,
  alterEgoResponse,
  allOf,
  anEnemy,
  chooseTarget,
  chosen,
  confuse,
  constant,
  costModifier,
  countersOn,
  defineAbilities,
  dealDamage,
  draw,
  eventSource,
  exhaustThis,
  heroInterrupt,
  heroResponse,
  ifThen,
  interrupt,
  modifyThwart,
  on,
  query,
  ready,
  removeCounter,
  removeThreat,
  response,
  scaled,
  threatOn,
  valueAtLeast,
  valueEquals,
  varOf,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../../dsl/index.js";
import { COLOSSUS_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/colossus/support-upgrades-allies.js";
import { SHADOWCAT_SUPPORT_UPGRADES_ALLIES } from "../../mut_gen/shadowcat/support-upgrades-allies.js";
import { PHOENIX_PRECON_PLAYER_CARDS } from "../../phoenix/precon-player-cards.js";

/** "After you resolve your 'Thief Extraordinaire' ability": the `abilityResolved` event, read by the ability's id. */
const thiefExtraordinaireResolved: EventPattern = {
  on: "abilityResolved",
  playerIs: "controller",
  eventIs: { abilityId: "37001b.thief-extraordinaire" },
};

/**
 * Gambit's allies, supports, upgrades and resources (`gambit` 37002-37005, 37010-37013, 37016-37018, 37030),
 * docs/phase7-wave6.md §6.2, §3.55, §3.58. His events are `events.ts`.
 *
 * - **Reprints, aliased**: Professor X 37017 (`mut_gen` 32019), X-Mansion 37018 (32049) and Passion for Justice 37016
 *   (`phoenix` 34020), each printed with the same text.
 * - **Rogue (37002)**: costs 1 less for each charge counter on your identity, read in hand (the Knife Leap shape); the
 *   cost cannot go below 0.
 * - **The Thieves Guild (37003)**: heard after Remy's Thief Extraordinaire resolves (`abilityResolved` by ability id), the
 *   exhaust is the cost. Removing threat is not a thwart. "The last threat" is read after the removal: something was
 *   removed and the scheme holds none (a crisis-blocked or empty scheme draws nothing).
 * - **Gambit's Staff (37004)**: any enemy's attack, on any player; 1 damage to that attacker.
 * - **Gambit's Guild Armor (37005)**: Gambit's own defense with no damage taken, part of the trigger (`takingNoDamage`), so
 *   the exhaust is never paid when he took damage.
 * - **Molecular Acceleration (37010)**: when spent for any purpose, a charge counter on Gambit.
 * - **Bishop (37011)**: only the response. "Attacks you" is the player, so an attack on your ally counts (ruling Dec 17,
 *   2025 (3)). His interrupt ("remove each energy counter from him") is not scripted: no counter cost removes every
 *   counter; `removeUpToCounters` lets the player pick fewer.
 * - **Dazzler (37012)**: any enemy, the villain included.
 * - **Operative Skill (37013)**: "When you thwart" is Gambit's own thwart, never an ally's (`YOUR_IDENTITY`); the extra
 *   threat joins the one removal (`modifyThwart`, so a crisis icon still stops all of it).
 * - **War Room (37030)**: any ally's attack that defeats a minion, whoever controls the ally.
 */
export const GAMBIT_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "37002.rogue-constant": constant(
    costModifier({
      delta: scaled(countersOn(yourIdentity, "charge"), { times: -1 }),
      appliesTo: { self: true },
      activeIn: "hand",
    }),
  ),

  "37003.the-thieves-guild-response": alterEgoResponse(
    thiefExtraordinaireResolved,
    { cost: exhaustThis },
    chooseTarget("scheme", query("scheme")),
    removeThreat(1, chosen("scheme"), { bind: "removed" }),
    ifThen(allOf(valueAtLeast(varOf("removed.amount"), 1), valueEquals(threatOn(chosen("scheme")), 0)), draw(1)),
  ),

  "37004.gambits-staff-interrupt": heroInterrupt(
    on.enemyAttacks(query("enemy")),
    { cost: exhaustThis },
    dealDamage(1, eventSource),
  ),

  "37005.gambits-guild-armor-response": heroResponse(
    after.defends(YOUR_IDENTITY, { takingNoDamage: true }),
    { cost: exhaustThis },
    ready(yourIdentity),
  ),

  "37010.molecular-acceleration-interrupt": heroInterrupt(on.youSpendThis(), addCounters("charge", 1, yourIdentity)),

  "37011.bishop-response": response(after.enemyAttacks(query("enemy"), { againstYou: true }), addCounters("energy", 1)),

  "37012.dazzler-response": response(after.entersPlay("self"), anEnemy(), confuse(chosen("enemy"))),

  "37013.operative-skill-interrupt": interrupt(
    on.thwarts(YOUR_IDENTITY),
    { cost: removeCounter("operative") },
    modifyThwart({ extraThreat: 1 }),
  ),

  "37030.war-room-response": response(
    after.attacks(query("ally"), { defeats: true, target: query("minion") }),
    { cost: exhaustThis },
    chooseTarget("scheme", query("scheme")),
    removeThreat(1, chosen("scheme")),
  ),

  // Reprints.
  "37016.passion-for-justice-interrupt": PHOENIX_PRECON_PLAYER_CARDS["34020.passion-for-justice-interrupt"]!,
  "37017.professor-x-forced-response": COLOSSUS_SUPPORT_UPGRADES_ALLIES["32019.professor-x-forced-response"]!,
  "37018.x-mansion-action": SHADOWCAT_SUPPORT_UPGRADES_ALLIES["32049.x-mansion-action"]!,
});
