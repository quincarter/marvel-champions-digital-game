import {
  applyRuleUntil,
  atEndOfAttack,
  defineAbilities,
  each,
  eventDamageTaken,
  forcedInterrupt,
  ifThen,
  modifyAttack,
  resolveSpecialsOf,
  when,
  whenRevealed,
  YOUR_IDENTITY,
  addCounters,
} from "../../../dsl/index.js";
import { CITY_STREETS } from "./encounter-set.js";

/**
 * Sandman (`sm` 27061–27063, docs/phase7-wave5.md §2.2/§3.4/§3.7/§3.11): three stages, standard I–II, expert II–III.
 *
 * **"Sand Blast"/"Sand Wave" (every stage's own ATK-line ability)** is one Forced Interrupt firing "When Sandman
 * attacks you" with two clauses: the attack gains a property (I/II: "that attack deals indirect damage"; III: "that
 * attack gains overkill"), then "If your identity takes any amount of damage from that attack, resolve the
 * 'Surging Sands' ability on City Streets." Both clauses are one printed ability box, so they are one
 * `AbilityDefinition` (the card carries exactly one ref per stage): the first effect changes the attack in progress,
 * and `atEndOfAttack` defers the second to after the attack (and its damage) has actually resolved.
 *
 * "Your identity takes any amount of damage from that attack" is `eventDamageTaken(each(YOUR_IDENTITY))`, the attack's
 * per-character damage-taken result (docs/phase7-wave5.md §4.1 Q65), not "the attack dealt damage and its attacked
 * character is your identity": RRG 1.8 "Indirect Damage" (p. 24) lets the attacked player divide an indirect attack's
 * damage among every character they control, so on stages I/II an ally can take all of it (no Surging Sands) or part
 * of it (Surging Sands if the identity took any). On stage III an ally that defends and is defeated spills the
 * overkill excess onto the identity (RRG 1.8 "Overkill", p. 31), which is damage the identity takes from that attack.
 * Damage that is prevented, reduced to 0 or absorbed by a tough status card is not taken.
 *
 * `applyRuleUntil(rule, "endOfAttack")` (docs/phase7-wave5.md §4.1 Q59) scopes the indirect-damage rule to the one
 * attack the interrupt is reacting to, `RuleSpec attacksDealIndirectDamage` (docs/phase7-wave3.md §3.16, the mirror
 * of Starshark's own permanent version of the same rule).
 */
const sandBlast = (attackKeyword: "indirect" | "overkill") =>
  forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    attackKeyword === "indirect"
      ? applyRuleUntil({ kind: "attacksDealIndirectDamage", attacker: { self: true } }, "endOfAttack")
      : modifyAttack({ keywords: ["overkill"] }),
    atEndOfAttack(ifThen(eventDamageTaken(each(YOUR_IDENTITY)), resolveSpecialsOf(CITY_STREETS))),
  );

export const SANDMAN = defineAbilities({
  // Sandman (I) (27061) — Sand Blast: see `sandBlast` above.
  "27061.sandman-constant": sandBlast("indirect"),

  // Sandman (II) (27062) — When Revealed: Resolve the "Surging Sands" ability on City Streets. Sand Blast: same as (I).
  "27062.when-revealed": whenRevealed(resolveSpecialsOf(CITY_STREETS)),
  "27062.sandman-constant": sandBlast("indirect"),

  // Sandman (III) (27063) — When Revealed: Place 1 sand counter on City Streets. Resolve its "Surging Sands"
  // ability. Sand Wave: as `sandBlast`, but the attack gains overkill instead of indirect damage.
  "27063.when-revealed": whenRevealed(addCounters("sand", 1, CITY_STREETS), resolveSpecialsOf(CITY_STREETS)),
  "27063.sandman-constant": sandBlast("overkill"),
});
