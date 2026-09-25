import {
  attacksGainKeywords,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discardEncounterCards,
  forcedInterrupt,
  gainsKeyword,
  gets,
  on,
  preventDamage,
  varOf,
} from "../../dsl/index.js";

/**
 * The Ransacked Armory modular set (`hood` 24037-24041, docs/phase7-wave4.md §2.3): three "attach to the minion
 * with the most remaining hit points" attachments (Holoshield Generator, Jetpack, Tech Gauntlets), Flamethrower
 * (the same host, `attachesTo` is data) and Armored Guard (a plain-stat minion, no ability refs).
 *
 * **Flamethrower (24037, `flamethrower-constant`/`-constant-2`) is not scripted — a genuine engine gap.** "Attached
 * minion's attacks deal indirect damage" needs a way to change an attack's own damage type, which nothing in the
 * DSL's `modifyAttack` (keywords, ATK/overkill bonuses) exposes.
 */

export const RANSACKED_ARMORY = defineAbilities({
  // Holoshield Generator (24038, attachment; ITEM/TECH, attachesTo are data) — Attached minion gets +4 hit points
  // and gains retaliate 2.
  "24038.holoshield-generator-constant": constant(gets("hp", 4, { hostOfSelf: true })),
  "24038.holoshield-generator-constant-2": constant(
    gainsKeyword({ name: "retaliate", value: 2 }, { hostOfSelf: true }),
  ),

  // Jetpack (24039, attachment; ITEM/TECH are data) — "Attach to the minion with the most remaining hit points. If
  // you cannot, this card gains surge" is entirely data (`attachesTo.ifAble`, surge keyword); its own "constant"
  // ref names no further text. Forced Interrupt: when attached minion would take any amount of damage from an
  // attack, discard the top card of the encounter deck; reduce damage from that attack by the number of boost
  // icons discarded this way.
  "24039.jetpack-constant": coveredByEngineRule(),
  "24039.jetpack-forced-interrupt": forcedInterrupt(
    on.damage({ hostOfSelf: true }, { fromAttack: true }),
    discardEncounterCards(1, { bind: "d" }),
    preventDamage(varOf("d.boostIcons")),
  ),

  // Tech Gauntlets (24040, attachment; TECH/WEAPON, statModifiers are data) — "Attach to the minion with the most
  // remaining hit points. If you cannot, this card gains surge" is data (the same shape as Jetpack's own
  // `-constant`); its own ref names no further text. Attached minion gets +3 hit points. [star] Attached minion's
  // attacks gain overkill.
  "24040.tech-gauntlets-constant": coveredByEngineRule(),
  "24040.tech-gauntlets-constant-2": constant(gets("hp", 3, { hostOfSelf: true })),
  "24040.tech-gauntlets-constant-3": constant(attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } })),
});
