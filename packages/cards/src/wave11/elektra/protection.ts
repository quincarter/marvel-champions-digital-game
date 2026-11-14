import type { AbilityRegistry } from "@mc/engine";
import { defineAbilities } from "../../dsl/index.js";

/**
 * Wave 11 scripting module `elektra/protection` (docs/phase7-elektra-iron-fist.md).
 *
 * Cards (1):
 * - 63039 Moon Knight (ally)
 *
 * **63039 Moon Knight** is not scripted yet. Ruling (rules-expert): each line applies once if at least one resource of
 * that type was spent, every qualifying line resolves (not per resource, not a choice), as Husk 47012 reads
 * `spendChosen(3)` + `ifThen(paidType(type), …)` (docs/phase7-wave8.md §3.62); a wild left a wild matches no line
 * (owner Q33 = B). The energy line (`modifyAttack({ preventDamage: 2 })`) and the physical line
 * (`dealDamage(2, attackingEnemy)`) compose from existing vocabulary, but the mental line needs an engine primitive:
 * nothing selects or discards the facedown boost cards on an enemy that has not yet flipped them (`discardBoostCard`
 * is only the card being turned up now, and no `CardSelector` reads a boost area). A script without that line would
 * be a wrong Moon Knight, so none is registered.
 */
export const ELEKTRA_PROTECTION: AbilityRegistry = defineAbilities({});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const ELEKTRA_PROTECTION_SKIPPED: Readonly<Record<string, string>> = {
  "63039.moon-knight-interrupt":
    "needs engine primitive: discard 1 facedown boost card from the attacking enemy (an effect or a CardSelector over an enemy's boost area, usable in the defend interrupt); the energy and physical lines already compose",
};
