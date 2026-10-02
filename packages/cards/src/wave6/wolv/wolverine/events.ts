import type { EffectSpec } from "@mc/engine";
import {
  action,
  allowUnlabeledAttack,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  chooseOne,
  chosen,
  defineAbilities,
  draw,
  heal,
  heroAction,
  hasStatus,
  ifThen,
  option,
  playedVia,
  query,
  anyOf,
  removeStatus,
  repeatWhile,
  takeDamage,
  thwart,
  threatOn,
  valueAtLeast,
  valueEquals,
  varAtLeast,
  yourIdentity,
  aScheme,
  damageOn,
} from "../../../dsl/index.js";

/** "Take 2 damage" (no card-effect bonus, §3.41), its result bound as `took` for the repeat's `while`. */
const TAKE_TWO: EffectSpec = { ...(takeDamage(2) as Extract<EffectSpec, { kind: "dealDamage" }>), bind: "took" };

/**
 * Wolverine's identity-specific events (`wolv` 35008-35012), docs/phase7-wave6.md §6.1.
 *
 * - **Berserker Barrage (35008)**, erratum RRG 1.8 p. 68: "If this attack defeats an enemy, you may take 2 damage to
 *   repeat this ability." A `repeatWhile` over the whole ability (a fresh enemy is chosen each time); the optional
 *   damage is the player's choice, and the loop continues only if it was taken. The 2 damage is damage Wolverine
 *   takes, so a card bonus such as Aggressive Energy must not add to it (ruling Jul 9, 2026 (3) #4, §3.41, §4.1 Q21):
 *   it is `takeDamage` (`dealDamage.taken`, §3.41).
 * - **Lunging Strike (35010)**: "If you exhausted Wolverine's Claws to play this card, this attack gains overkill" reads
 *   how the card was played (`playedVia`, §3.42): the Claws' action records itself on the play. Played any other way
 *   (from hand, or by another card's effect) it is a plain attack.
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
        chooseOne(option("Take 2 damage to repeat this ability", TAKE_TWO), option("Do not repeat")),
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

  "35010.lunging-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy("enemy"),
    ifThen(
      playedVia(query("upgrade", { name: "Wolverine's Claws" })),
      attack(8, chosen("enemy"), { keywords: ["overkill"] }),
      attack(8, chosen("enemy")),
    ),
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
