import type { EffectSpec, EventPattern } from "@mc/engine";
import {
  anAttackableEnemy,
  attack,
  chooseTarget,
  chosen,
  confuse,
  constant,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  eventSource,
  exhaustThis,
  gets,
  heroAction,
  heroInterrupt,
  heroResource,
  ifThen,
  interrupt,
  modifyStat,
  paidWith,
  preventDamage,
  query,
  removeCounter,
  spend,
  stun,
  theVillain,
  varOf,
  when,
  YOUR_IDENTITY,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * "Cancel all boost icons on that card" (Preemptive Strike, 05014): the raw `cancelBoostIcons` effect (engine
 * `EffectSpec { kind: "cancelBoostIcons", bind? }`, spec.ts, `apply-effect.ts`) reports how many icons it cancelled
 * to `<bind>.amount`, but `dsl/effects.ts` has no builder sugar for it yet.
 */
const cancelBoostIcons = (bind: string): EffectSpec => ({ kind: "cancelBoostIcons", bind });

/**
 * "When a boost card is turned face up while the villain attacks" (Preemptive Strike): the `boostCardTurnedFaceup`
 * trigger event is landed, but `dsl/abilities.ts`'s `on`/`when` object has no sugar for it, so it's composed here
 * as a raw `EventPattern`.
 */
const whileTheVillainAttacks: EventPattern = {
  on: "boostCardTurnedFaceup",
  sourceIs: { categories: ["villain"] },
  activation: "attack",
  playerIs: "controller",
};

/**
 * Aggression/Justice/Protection/basic-aspect filler cards bundled in the Ms. Marvel pack, not part of her signature
 * hero-kit set (`aspect` is the generic aspect, not `hero:05001a`): Nova (05012, protection), Preemptive Strike
 * (05014, protection), Tackle (05015, protection), Energy Barrier (05017, protection), Lockjaw (05018, basic),
 * Endurance (05023, basic), Enhanced Reflexes (05024, basic), Melee (05030, aggression), Concussive Blow (05031,
 * justice), Morale Boost (05032, leadership), Down Time (05033, basic). Reprints bundled in the same physical pack
 * (Get Behind Me! 05013, The Power of Protection 05016, Energy 05019, Genius 05020, Strength 05021, Avengers
 * Mansion 05022) are aliased from Core by `../reprints.ts`, not scripted here.
 */
export const MSM_PACK_CARDS = defineAbilities({
  // Nova — Interrupt: When an enemy initiates an attack against you, spend a [energy] resource → deal 2 damage to
  // that enemy.
  "05012.nova-interrupt": interrupt(
    when.enemyAttacks(query("enemy"), { againstYou: true }),
    { cost: spend({ energy: 1 }) },
    dealDamage(2, eventSource),
  ),

  // Preemptive Strike — Hero Interrupt (defense): When a boost card is turned face up while the villain attacks,
  // cancel all boost icons ([boost]) on that card. Then deal 1 damage to the villain for each boost icon cancelled
  // this way.
  "05014.preemptive-strike-interrupt": heroInterrupt(
    whileTheVillainAttacks,
    { label: "defense" },
    cancelBoostIcons("cancelled"),
    dealDamage(varOf("cancelled.amount"), theVillain),
  ),

  // Tackle — Hero Action (attack): Stun an enemy. If you paid for this card using a [physical] resource, deal 3
  // damage to that enemy.
  "05015.tackle-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    stun(chosen("enemy")),
    ifThen(paidWith("physical"), attack(3, chosen("enemy"))),
  ),

  // Energy Barrier — Uses (3 reflection counters) (data). Interrupt: When you would take any amount of damage,
  // remove 1 reflection counter from here → prevent 1 of that damage and deal 1 damage to an enemy.
  "05017.energy-barrier-interrupt": interrupt(
    when.damage(YOUR_IDENTITY),
    { cost: removeCounter("reflection") },
    preventDamage(1),
    damageAnEnemy(1),
  ),

  // Lockjaw — You may play Lockjaw from your discard pile during your turn (paying his resource cost).
  "05018.lockjaw-constant": constant({ playableFrom: ["discard"] }),

  // Endurance — Play under any player's control. Max 1 per player (data). You get +3 hit points.
  "05023.endurance-constant": constant(gets("hp", 3, YOUR_IDENTITY)),

  // Enhanced Reflexes — Uses (3 energy counters) (data). Hero Resource: Exhaust Enhanced Reflexes and remove 1
  // energy counter from it → generate a [energy] resource.
  "05024.enhanced-reflexes-resource": heroResource({ energy: 1 }, { cost: [exhaustThis, removeCounter("energy")] }),

  // Melee — Hero Action (attack): Deal 3 damage to an enemy. Deal 3 damage to another enemy.
  "05030.melee-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy1", query("enemy", { attackableBy: yourIdentity })),
    attack(3, chosen("enemy1")),
    // "Another enemy": excludes whatever `enemy1` bound (RRG 1.8 "Different"; matches Cap's "remove 2 threat from
    // a different scheme", `cap` pack).
    chooseTarget("enemy2", query("enemy", { attackableBy: yourIdentity, excludeSlots: ["enemy1"] })),
    attack(3, chosen("enemy2")),
  ),

  // Concussive Blow — Hero Action (attack): Confuse an enemy. If you paid for this card using a [physical]
  // resource, deal 3 damage to that enemy.
  "05031.concussive-blow-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    confuse(chosen("enemy")),
    ifThen(paidWith("physical"), attack(3, chosen("enemy"))),
  ),

  // Morale Boost — Hero Action: Choose a hero. Until the end of the round, that hero gets +1 THW, +1 ATK, and +1 DEF.
  "05032.morale-boost-action": heroAction(
    chooseTarget("hero", query("hero")),
    modifyStat("thw", 1, chosen("hero"), "endOfRound"),
    modifyStat("atk", 1, chosen("hero"), "endOfRound"),
    modifyStat("def", 1, chosen("hero"), "endOfRound"),
  ),

  // Down Time — Play under any player's control. Max 1 per player (data). Your alter-ego gets +2 REC.
  "05033.down-time-constant": constant(gets("rec", 2, query("alterEgo", { controller: "you" }))),
});
