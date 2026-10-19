import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  andThen,
  boost,
  cancelIt,
  cards,
  chosen,
  canTakeStatus,
  confuse,
  exists,
  dealDamage,
  dealIndirectDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardFromHand,
  eventTarget,
  forcedInterrupt,
  ifThen,
  moveCards,
  on,
  placeThreat,
  printedCostOf,
  selectCards,
  self,
  query,
  refCount,
  stun,
  theMainScheme,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  zone,
} from "../../../dsl/index.js";

/**
 * "You are stunned. Otherwise, <fallback>": when the identity cannot be given the status (it already has one, stalwart,
 * a "cannot be stunned" rule) the first sentence cannot resolve and "Otherwise" does (RRG 1.8 "Otherwise", p. 31;
 * "Status Cards", p. 41).
 */
const otherwiseUnless = (status: "stunned" | "confused", give: EffectSpec, fallback: EffectSpec): EffectSpec =>
  ifThen(exists(query("identity", { controller: "you", ...canTakeStatus(status) })), give, fallback);
const stunnedOtherwise = (fallback: EffectSpec): EffectSpec => otherwiseUnless("stunned", stun(yourIdentity), fallback);
const confusedOtherwise = (fallback: EffectSpec): EffectSpec =>
  otherwiseUnless("confused", confuse(yourIdentity), fallback);

/**
 * Modular set `scarlet_twins` (Resistance side) (Synthezoid Smackdown, MC57; docs/phase7-synthezoid.md section 8.3).
 * Quickstrike (Speed), Incite 1 (Wiccan) and Hinder 1[per_hero] (Superpowered Siblings) are data keywords.
 *
 * **Speed (57060)**: When Revealed: you are stunned; if you cannot be, deal 2 damage to your identity.
 * **Wiccan (57061)**: When Revealed: you are confused; if you cannot be, 2 threat on the main scheme.
 *
 * **Superspeed (57062)**: When Revealed: discard 1 random card from your hand and take indirect damage equal to its
 * printed cost (the revealer divides it, RRG 1.8 "Indirect Damage"); an empty hand discards nothing and takes none.
 * Boost: discard 1 card from your hand (the defending player's choice).
 *
 * **Spellcasting (57063)**: an obligation, so its "you" is the player whose play area holds it (RRG 1.8 "Obligation",
 * p. 30). Forced Interrupt when that player plays a card: cancel its effects (RRG 1.8 "Cancel", p. 11: the card is
 * still played, its cost paid), discard it, then discard Spellcasting. When the play interrupt resolves the card is on
 * the table, not yet in play; `discard(eventTarget)` discards it (an event is also discarded by the cancel rule
 * itself). "Then" is skipped if the cancel could not happen (RRG 1.8 "Then", p. 44).
 *
 * **Superpowered Siblings (57064)**: When Defeated: the player who defeated it discards 1 card from their hand (their
 * choice). Engine reading: with no defeating player, nobody discards.
 *
 * Cards (5):
 * - 57060 Speed (minion)
 * - 57061 Wiccan (minion)
 * - 57062 Superspeed (treachery)
 * - 57063 Spellcasting (obligation)
 * - 57064 Superpowered Siblings (side_scheme)
 */
export const SYNTHEZOID_MODULAR_SCARLET_TWINS: AbilityRegistry = defineAbilities({
  "57060.when-revealed": whenRevealed(stunnedOtherwise(dealDamage(2, yourIdentity))),
  "57061.when-revealed": whenRevealed(confusedOtherwise(placeThreat(2, theMainScheme))),

  "57062.when-revealed": whenRevealed(
    selectCards("card", zone("hand", you, { random: 1 })),
    moveCards(cards(chosen("card")), "discard"),
    ifThen(valueAtLeast(refCount(chosen("card")), 1), dealIndirectDamage(you, printedCostOf(chosen("card")))),
  ),
  "57062.boost": boost(discardFromHand(1, you)),

  "57063.obligation": forcedInterrupt(on.youPlay({}), cancelIt(), discard(eventTarget), andThen(discard(self))),

  "57064.when-defeated": whenDefeated(discardFromHand(1, defeatingPlayer)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const SYNTHEZOID_MODULAR_SCARLET_TWINS_SKIPPED: Readonly<Record<string, string>> = {};
