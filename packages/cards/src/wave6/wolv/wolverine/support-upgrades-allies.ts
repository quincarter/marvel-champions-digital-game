import {
  after,
  alterEgoAction,
  attacksGainKeywords,
  chooseCards,
  constant,
  defineAbilities,
  discard,
  draw,
  exhaustThis,
  forcedResponse,
  gets,
  heroInterrupt,
  heroResponse,
  ifThen,
  instead,
  interrupt,
  isAlterEgo,
  isHero,
  modifyAttack,
  moveCards,
  ofIdentitySetTitled,
  on,
  query,
  ready,
  removeCounter,
  self,
  setRemainingHitPoints,
  cards,
  chosen,
  when,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
  you,
} from "../../../dsl/index.js";

/**
 * Wolverine's identity-specific upgrades and supports (`wolv` 35004-35007) and Warrior Skill (35016, an aggression
 * upgrade; docs/phase7-wave6.md §6.1, §3.29, §3.44). Jubilee (35003) is not here: her basic-attack bonus is §3.43
 * (`attackInProgress` has no basic filter yet), so `coverage.test.ts` lists her in `KNOWN_SKIPPED`. His events,
 * Wolverine's Claws, obligation and nemesis set are other modules.
 *
 * - **Adamantium Skeleton (35004)**: "You get +4 hit points" is the identity's, either form; "Wolverine gets +1 ATK and his
 *   basic attacks gain piercing" is his hero face's (`isHero`), the grant matching how the attack is made (`basicOnly`).
 * - **Berserker Frenzy (35005)**: a hero response to enemy attack damage Wolverine actually took (`taken`), and the
 *   Forced Response discards it when you flip to alter-ego form.
 * - **"I Got Better" (35006)**: Rise from the Ashes' shape (`wave6/phoenix`): an `instead` on the defeat, restricted to
 *   a defeat by an enemy attack (`byAttackFrom`, Regroup `drax` 19032).
 * - **Logan's Cabin (35007)**: "a Wolverine card" is his identity set (RRG 1.8 "Identity-Specific Card", p. 23).
 * - **Warrior Skill (35016)**: any attack by your hero, basic or an ability or event's (§3.29 `extraDamage`); the
 *   counter is the cost, paid on use. Uses and "Max 1 per player" are card data.
 */
export const WOLVERINE_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "35004.adamantium-skeleton-constant": constant(gets("hp", 4, YOUR_IDENTITY)),
  "35004.adamantium-skeleton-constant-2": constant(
    gets("atk", 1, YOUR_IDENTITY, { while: isHero() }),
    attacksGainKeywords(["piercing"], { attacker: YOUR_IDENTITY, basicOnly: true, while: isHero() }),
  ),

  "35005.berserker-frenzy-response": heroResponse(
    after.damage(YOUR_IDENTITY, { fromAttack: true, taken: true }),
    draw(1),
  ),
  "35005.berserker-frenzy-forced-response": forcedResponse(
    { ...on.youChangeIdentityForm(), eventIs: { change: "identity", to: "alterEgo" } },
    ifThen(isAlterEgo(), discard(self)),
  ),

  "35006.i-got-better-interrupt": interrupt(
    when.defeated("host", { byAttackFrom: query("enemy") }),
    instead(setRemainingHitPoints(5, yourIdentity), ready(yourIdentity), discard(self)),
  ),

  "35007.logans-cabin-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards(
      "found",
      zone("discard", you, {
        filter: query(["ally", "event", "upgrade", "support", "resource"], { ...ofIdentitySetTitled("Wolverine") }),
      }),
      {
        min: 1,
        max: 1,
      },
    ),
    moveCards(cards(chosen("found")), "deckShuffle"),
  ),

  "35016.warrior-skill-interrupt": heroInterrupt(
    on.attacks(YOUR_IDENTITY),
    { cost: removeCounter("warrior", 1) },
    modifyAttack({ extraDamage: 1 }),
  ),
});
