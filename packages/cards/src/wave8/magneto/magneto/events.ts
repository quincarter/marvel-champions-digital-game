import type { AbilityRegistry } from "@mc/engine";
import {
  aScheme,
  andThen,
  anAttackableEnemy,
  anEnemy,
  attack,
  chooseTarget,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  giveTough,
  heroAction,
  ifThen,
  not,
  query,
  stun,
  threatAtLeast,
  thwart,
  varAtLeast,
  yourIdentity,
} from "../../../dsl/index.js";

/**
 * Magneto signature events (docs/phase7-wave8.md section 7.5, 3.76, 3.77, 3.81).
 *
 * **Metal Shards (49009)**: a Hero Action (attack): 7 damage to an enemy the hero may attack (guard applies); if that
 * attack defeated it (`attack`'s `bind` reports `<bind>.defeated`), Magneto gains a tough status card.
 *
 * **Magnetic Missile (49010)**, as errata (RRG 1.8 p. 69, current text "Discard a minion with Wrapped in Metal
 * attached. Then, deal 5 damage to an enemy and stun it."): the discard is the first effect, not a cost, and the damage
 * waits on it (`andThen`). The minion is discarded, not defeated (`discard`); any player's wrapped minion will do. With
 * no wrapped minion in play there is nothing to choose and the event cannot be played. It carries no label, so the 5
 * damage is not an attack: guard does not stop it and retaliate does not answer.
 *
 * **Electromagnetic Blast (49008)** is not registered: see `MAGNETO_EVENTS_DRAFTS` and `MAGNETO_EVENTS_SKIPPED`.
 *
 * Cards (3):
 * - 49008 Electromagnetic Blast (event)
 * - 49009 Metal Shards (event)
 * - 49010 Magnetic Missile (event)
 */
export const MAGNETO_EVENTS: AbilityRegistry = defineAbilities({
  "49009.metal-shards-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    attack(7, chosen("enemy"), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), giveTough(yourIdentity)),
  ),

  "49010.magnetic-missile-action": heroAction(
    chooseTarget("wrapped", query("minion", { hasAttachment: { name: "Wrapped in Metal" } })),
    discard(chosen("wrapped")),
    andThen(anEnemy(), dealDamage(5, chosen("enemy")), stun(chosen("enemy"))),
  ),
});

/**
 * Electromagnetic Blast as close as today's vocabulary writes it, unregistered. It lacks `TargetQuery.printsAbility`
 * (section 3.77, engine task 13, not built): "an attachment with the text 'Hero Action' or 'Hero Response'" cannot be
 * told from any other attachment, so the draft offers every attachment in play. Once the engine has the field, replace
 * `query("attachment")` by `query("attachment", { printsAbility: { kinds: ["action", "response"], form: "hero" } })`,
 * register this and turn the `it.fails` of `events.test.ts` into `it`. "If this removes the last threat" is read as the
 * scheme having no threat left after the thwart.
 */
export const MAGNETO_EVENTS_DRAFTS: AbilityRegistry = defineAbilities({
  "49008.electromagnetic-blast-action": heroAction(
    { label: "thwart" },
    aScheme(),
    thwart(3, chosen("scheme")),
    ifThen(
      not(threatAtLeast(chosen("scheme"), 1)),
      chooseTarget("attachment", query("attachment"), { optional: true }),
      discard(chosen("attachment")),
    ),
  ),
});

/** Refs of this group left unregistered, each with its reason. */
export const MAGNETO_EVENTS_SKIPPED: Readonly<Record<string, string>> = {
  "49008.electromagnetic-blast-action":
    "no way to pick an attachment by the ability labels it prints (TargetQuery.printsAbility, docs/phase7-wave8.md section 3.77, engine task 13, not built)",
};
