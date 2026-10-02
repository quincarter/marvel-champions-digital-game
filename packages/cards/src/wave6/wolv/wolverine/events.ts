import {
  action,
  allowUnlabeledAttack,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  chooseOne,
  chosen,
  dealDamage,
  defineAbilities,
  draw,
  heal,
  heroAction,
  hasStatus,
  ifThen,
  option,
  anyOf,
  removeStatus,
  repeatWhile,
  thwart,
  threatOn,
  valueAtLeast,
  valueEquals,
  varAtLeast,
  yourIdentity,
  aScheme,
  damageOn,
} from "../../../dsl/index.js";

/**
 * Wolverine's identity-specific events (`wolv` 35008-35012), docs/phase7-wave6.md §6.1. Lunging Strike (35010) is not
 * here: "If you exhausted Wolverine's Claws to play this card" reads what paid for the play (§3.42, not built).
 *
 * - **Berserker Barrage (35008)**, erratum RRG 1.8 p. 68: "If this attack defeats an enemy, you may take 2 damage to
 *   repeat this ability." A `repeatWhile` over the whole ability (a fresh enemy is chosen each time); the optional
 *   damage is the player's choice, and the loop continues only if it was taken. The 2 damage is damage Wolverine
 *   takes, so a card bonus such as Aggressive Energy must not add to it (ruling Jul 9, 2026 (3) #4, §3.41, §4.1 Q21):
 *   it is a plain `dealDamage` to his identity until §3.41's `taken` flag lands.
 * - **Slice and Dice (35009)**: two attacks in order, each choosing its own enemy (the Dance of Death shape, FAQ p. 59).
 * - **Track by Scent (35011)**: "removes the last threat" reads the scheme's threat after the thwart (Fly Over shape).
 * - **Regenerative Healing (35012)**: a player card cannot choose an option it cannot at least partially resolve (RRG
 *   1.8 "Choose (Option)", p. 12), so each option is offered only while it can change something.
 */
export const WOLVERINE_EVENTS = defineAbilities({
  "35008.berserker-barrage-action": heroAction(
    { label: "attack" },
    repeatWhile(
      varAtLeast("took.made"),
      anAttackableEnemy("enemy"),
      attack(4, chosen("enemy"), { bind: "hit" }),
      ifThen(
        varAtLeast("hit.defeated"),
        chooseOne(
          option("Take 2 damage to repeat this ability", dealDamage(2, yourIdentity, { bind: "took" })),
          option("Do not repeat"),
        ),
      ),
    ),
  ),

  "35009.slice-and-dice-action": allowUnlabeledAttack(
    heroAction(attackAnEnemy(3, { slot: "enemy1" }), attackAnEnemy(3, { slot: "enemy2" })),
    {
      citation:
        'FAQ "Dance of Death (#4)" (RRG 1.8 p. 59): each damage-dealing effect is an individual attack; a stun cancels only the first.',
    },
  ),

  "35011.track-by-scent-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    thwart(3, chosen("scheme")),
    ifThen(valueEquals(threatOn(chosen("scheme")), 0), draw(2)),
  ),

  "35012.regenerative-healing-action": action(
    chooseOne(
      option(
        "Heal 4 damage from your identity",
        { when: valueAtLeast(damageOn(yourIdentity), 1) },
        heal(4, yourIdentity),
      ),
      option(
        "Discard each stunned and confused status card from your identity",
        { when: anyOf(hasStatus(yourIdentity, "stunned"), hasStatus(yourIdentity, "confused")) },
        removeStatus(yourIdentity, "stunned"),
        removeStatus(yourIdentity, "confused"),
      ),
    ),
  ),
});
