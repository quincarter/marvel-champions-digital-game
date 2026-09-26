import {
  after,
  allOf,
  atEndOfAttack,
  boost,
  cannotBeReadiedByPlayerCards,
  constant,
  defineAbilities,
  discard,
  each,
  eventDealt,
  eventSource,
  eventTarget,
  exhaust,
  forcedResponse,
  ifThen,
  query,
  refMatches,
  rule,
  self,
  spend,
  stun,
  whenRevealed,
} from "../../dsl/index.js";
import { alterEgoAction } from "../../dsl/abilities.js";

/**
 * Frost Giants (`mts` 21156–21159), Hela's own other recommended modular set (MC21 p. 20; also reused by the Loki
 * scenario). Laufey (an elite minion), Frost Giant (a minion, an exact reprint of `thor` 06029's own card — see
 * that module's own docblock for the `atEndOfAttack` reading), Frozen (an attachment) and Unnatural Storm (a side
 * scheme, docs/phase7-wave4.md §3.19's own "cannot be readied by player card effects" primitive, already landed).
 */
export const FROST_GIANTS = defineAbilities({
  // Laufey (21156) — Toughness (data). [star] Forced Response: After Laufey attacks and damages a character, stun
  // that character.
  "21156.laufey-forced-response": forcedResponse(after.enemyAttacks("self", { damages: true }), stun(eventTarget)),

  // Frost Giant (21157) — Toughness (data, enters play with a tough status card). [star] Boost: If the villain is
  // attacking and this attack deals damage to a character, stun that character. Word-for-word `thor` 06029's own
  // text — `wave1/thor/nemesis.ts`'s own script, reused verbatim (`atEndOfAttack` deferring to the end of the
  // current attack, where `eventSource`/`eventTarget`/`eventDealt` read its own results).
  "21157.boost": boost(
    atEndOfAttack(
      ifThen(
        allOf(
          refMatches(eventSource, query("villain")),
          eventDealt("damage"),
          refMatches(eventTarget, query("character")),
        ),
        stun(eventTarget),
      ),
    ),
  ),

  // Frozen (21158) — Attach to your identity (data). Attached identity cannot ready — unconditional, not just
  // "by player card effects" (Unnatural Storm's own narrower rule, below), so no `bySource` scope.
  "21158.frozen-constant": constant(rule({ kind: "cannotReady", target: { hostOfSelf: true } })),
  // Alter-Ego Action: Spend [energy][physical] resources → discard this card.
  "21158.frozen-action": alterEgoAction({ cost: spend({ energy: 1, physical: 1 }) }, discard(self)),

  // Unnatural Storm (21159) — Heroes and allies cannot be readied by player card effects (docs/phase7-wave4.md
  // §3.19, landed). When Revealed: Exhaust each ally in play.
  "21159.unnatural-storm-constant": constant(cannotBeReadiedByPlayerCards(query(["hero", "ally"]))),
  "21159.when-revealed": whenRevealed(exhaust(each(query("ally")))),
});
