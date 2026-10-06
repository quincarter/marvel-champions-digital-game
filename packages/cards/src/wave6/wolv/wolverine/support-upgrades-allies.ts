import {
  after,
  alterEgoAction,
  anEnemy,
  attackInProgress,
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
  ifElse,
  ifThen,
  instead,
  interrupt,
  isAlterEgo,
  isHero,
  modifyAttack,
  modifyStatOf,
  moveCards,
  ofIdentitySetTitled,
  on,
  query,
  ready,
  removeCounter,
  response,
  self,
  setRemainingHitPoints,
  cards,
  chosen,
  theAffectedCard,
  titled,
  when,
  YOUR_IDENTITY,
  yourIdentity,
  zone,
  you,
} from "../../../dsl/index.js";

/**
 * Wolverine's identity-specific upgrades and supports (`wolv` 35004-35007) and Warrior Skill (35016, an aggression
 * upgrade; docs/phase7-wave6.md §6.1, §3.29, §3.44) and Jubilee (35003, an ally). His events, Wolverine's Claws,
 * obligation and nemesis set are other modules.
 *
 * - **Jubilee (35003)**: "Response: After Jubilee enters play, choose an enemy. Until the end of the phase, while
 *   Wolverine or Jubilee is making a basic attack against that enemy, they get +2 ATK for that attack." (§3.43). Ruling
 *   Jun 2, 2026 (1): it is keyed on the chosen enemy, not on card instances, so it reaches any Wolverine or Jubilee
 *   (identity or ally, one entering play later included: `titled`), and each trigger in a phase stacks (each is its own
 *   lasting effect). "They" is the character attacking: the amount is read per character (`theAffectedCard`), and only
 *   during its basic attack (`attackInProgress.basic`), never an event's or ability's attack.
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
  "35003.jubilee-response": response(
    after.entersPlay("self"),
    anEnemy("enemy"),
    modifyStatOf(
      "atk",
      ifElse(attackInProgress({ attacker: theAffectedCard, target: { inSlot: "enemy" }, basic: true }), 2, 0),
      titled("Wolverine", "Jubilee"),
      "endOfPhase",
    ),
  ),

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
    { would: true },
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
