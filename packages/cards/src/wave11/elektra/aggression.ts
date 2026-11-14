import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  anAttackableEnemy,
  anEnemy,
  attack,
  attackExcessAsDealt,
  chooseOne,
  chooseTarget,
  chosen,
  confuse,
  dealDamage,
  defineAbilities,
  discardThis,
  divide,
  draw,
  forcedResponse,
  heroAction,
  heroResponse,
  ifThen,
  not,
  option,
  query,
  refMatches,
  removeCounter,
  stun,
  valueAtMost,
  varAtLeast,
  youHaveTrait,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

const MARTIAL_ARTIST = trait("MARTIAL ARTIST");

/** An enemy this player's identity may attack, other than the enemies already chosen under `others`. */
const anotherAttackableEnemy = (slot: string, ...others: string[]) =>
  chooseTarget(slot, query("enemy", { attackableBy: yourIdentity, excludeSlots: others }));

/**
 * Wave 11 scripting module `elektra/aggression` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (7):
 * - 63015 Shang-Chi (ally)
 * - 63016 Black Cat (ally): Villainous is data (a keyword), no ability of her own.
 * - 63017 Combo Move (event)
 * - 63018 Chain Reaction (event)
 * - 63019 Nerve Strike (event)
 * - 63020 Flow of Battle (upgrade)
 * - 63021 Shuriken (upgrade)
 *
 * **63015 Shang-Chi**: "enters play with 10 ring counters" is a forced response, not the Uses keyword, because he stays
 * in play when they run out (Hawkeye, 01066). The action is limited to twice a round.
 *
 * **63017 Combo Move**: "deal 2 damage among enemies in play" is the divided damage of Wasp Sting (13006); the player
 * divides it as they choose.
 *
 * **63018 Chain Reaction**: one attack with up to three damage instances (RRG 1.8 "Attack (Player Ability Type)", p. 10;
 * owner Q47/Q48/Q49/Q53, docs/phase7-wave8.md §4.1): guard is checked per enemy as it is attacked, retaliate once per
 * attacked enemy still in play afterwards, "after you attack" once. The second and third targets are different enemies.
 *
 * **63020 Flow of Battle**: "you" is your identity's own attack (an ally's is not, RRG 1.8 "You, Your", p. 49); "exactly
 * defeat" is no excess damage dealt (ruling August 3, 2026 - Ruling 6), the Shakedown (61035) shape.
 */
export const ELEKTRA_AGGRESSION: AbilityRegistry = defineAbilities({
  "63015.shang-chi-constant": forcedResponse(after.entersPlay("self"), addCounters("ring", 10)),
  "63015.shang-chi-action": action(
    { cost: removeCounter("ring"), limit: { count: 2, period: "round" } },
    anEnemy(),
    dealDamage(1, chosen("enemy")),
  ),

  "63017.combo-move-action": heroAction(
    { label: "attack" },
    ifThen(youHaveTrait(MARTIAL_ARTIST), divide("damage", 3, query("enemy")), divide("damage", 2, query("enemy"))),
  ),

  // One attack, several instances: RRG 1.8 "Attack (Player Ability Type)" p. 10; owner Q47/Q49/Q53 (docs/phase7-wave8.md §4.1).
  // The first instance is the `attack`; the later ones are plain `dealDamage`, which the engine makes the same attack's
  // (one retaliate per enemy still in play after it, "after you attack" once). Each later target is chosen when its
  // instance happens and must be attackable then (guard is checked per enemy as it is attacked).
  "63018.chain-reaction-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("first"),
    attack(2, chosen("first"), { bind: "hit1" }),
    ifThen(varAtLeast("hit1.defeated"), [
      anotherAttackableEnemy("second", "first"),
      dealDamage(2, chosen("second")),
      // "That enemy is defeated": it has left play (a dealDamage does not bind `.defeated`).
      ifThen(not(refMatches(chosen("second"), query("enemy"))), [
        anotherAttackableEnemy("third", "first", "second"),
        dealDamage(3, chosen("third")),
      ]),
    ]),
  ),

  "63019.nerve-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(2, chosen("enemy")),
    chooseOne(option("Stun that enemy", stun(chosen("enemy"))), option("Confuse that enemy", confuse(chosen("enemy")))),
  ),

  "63020.flow-of-battle-response": heroResponse(
    after.attacks(YOUR_IDENTITY, { target: query("enemy"), defeats: true }),
    { cost: discardThis, while: valueAtMost(attackExcessAsDealt, 0) },
    draw(3),
  ),

  "63021.shuriken-action": heroAction({ cost: removeCounter("shuriken") }, anEnemy(), dealDamage(1, chosen("enemy"))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const ELEKTRA_AGGRESSION_SKIPPED: Readonly<Record<string, string>> = {};
