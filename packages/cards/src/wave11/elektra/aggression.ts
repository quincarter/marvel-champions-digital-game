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
  option,
  query,
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
 * **63018 Chain Reaction**: each hit is its own attack by your identity (guard, retaliate and "after you attack" apply
 * to each), and "if that enemy is defeated" is the attack's `<bind>.defeated`, so a target that survives ends the chain.
 * The second and third targets are different enemies. Not ruled whether the chained damage is one attack or three;
 * read as three, so guard is respected for each target.
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

  "63018.chain-reaction-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("first"),
    attack(2, chosen("first"), { bind: "hit1" }),
    ifThen(varAtLeast("hit1.defeated"), [
      anotherAttackableEnemy("second", "first"),
      attack(2, chosen("second"), { bind: "hit2" }),
      ifThen(varAtLeast("hit2.defeated"), [
        anotherAttackableEnemy("third", "first", "second"),
        attack(3, chosen("third")),
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
