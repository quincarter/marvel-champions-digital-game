import {
  allOf,
  applyRuleUntil,
  atEndOfAttack,
  defineAbilities,
  eventDealt,
  forcedInterrupt,
  ifThen,
  modifyAttack,
  refMatches,
  resolveSpecialsOf,
  when,
  whenRevealed,
  YOUR_IDENTITY,
  eventTarget,
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
 * and `atEndOfAttack` defers the second to after the attack (and its damage) has actually resolved — the same shape
 * `core/scenarios/klaw.ts`'s 01123 Boost uses for "if this activation deals damage to you, exhaust your hero"
 * (`atEndOfAttack(ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, YOUR_IDENTITY)), …))`): `eventTarget`
 * is the attack's own "attacked" character (the declared defender, or your identity if undefended — RRG 1.8
 * "Indirect Damage", p. 24), and `eventDealt("damage")` is whether the attack (as a whole) dealt any.
 *
 * **Known imprecision on stages I/II only (indirect damage):** RRG 1.8 "Indirect Damage" (p. 24) lets the attacked
 * player divide indirect damage among every character they control, not only their identity — a controlled ally
 * could take all of it while identity takes none, in which case Surging Sands should not resolve. The engine
 * reports an attack's total damage and its "attacked" character (`eventTarget`/`eventDealt`) but not a
 * per-character breakdown of an indirect attack's shares, so this reading (any damage at all from an attack whose
 * "attacked" character is your identity) over-triggers Surging Sands in the rare case where the attacked player
 * controls another character and chooses to divert the damage there. No engine primitive exists for the precise
 * reading; flagged here rather than guessed at further (a per-target damage report off `attacksDealIndirectDamage`
 * is the missing primitive — `game-rules-architect`). Stage III's "gains overkill" has no such gap: a normal
 * (non-indirect) attack has exactly one attacked character, so the same pattern is exact there.
 *
 * `applyRuleUntil(rule, "endOfAttack")` (docs/phase7-wave5.md §4.1 Q59, built since the doc's "open" note — its own
 * worked example, `sm` 27029 In Cold Blood, is this same box) scopes the indirect-damage rule to the one attack the
 * interrupt is reacting to, `RuleSpec attacksDealIndirectDamage` (docs/phase7-wave3.md §3.16, the mirror of
 * Starshark's own permanent version of the same rule).
 */
const sandBlast = (attackKeyword: "indirect" | "overkill") =>
  forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    attackKeyword === "indirect"
      ? applyRuleUntil({ kind: "attacksDealIndirectDamage", attacker: { self: true } }, "endOfAttack")
      : modifyAttack({ keywords: ["overkill"] }),
    atEndOfAttack(
      ifThen(allOf(eventDealt("damage"), refMatches(eventTarget, YOUR_IDENTITY)), resolveSpecialsOf(CITY_STREETS)),
    ),
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
