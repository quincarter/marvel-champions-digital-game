import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  boost,
  confuse,
  defeatingPlayer,
  defineAbilities,
  discardFromHandCost,
  hasStatus,
  identityOf,
  ifThen,
  stun,
  takeDamage,
  whenDefeated,
  whenRevealed,
  yourIdentity,
} from "../../dsl/index.js";
import { discardThisObligation } from "../../core/obligations.js";

/**
 * Modular encounter set `dystopian_nightmare` (Age of Apocalypse, docs/phase7-wave8.md §2.4, §3.17, §8.4). Waits on no
 * engine work: every card is existing vocabulary.
 *
 * Hunted is an obligation with no When Revealed text, so it stays in the play area of the player it was dealt to and
 * carries its hazard icon (data) until its Alter-Ego Action discards it. "Already stunned" is read before this card
 * stuns you, the convention of every earlier stun-or-damage card.
 *
 * Cards (3):
 * - 45072 Hunted (obligation)
 * - 45073 War-Weary (treachery)
 * - 45074 Targeted for Extermination (side_scheme)
 */
export const DYSTOPIAN_NIGHTMARE: AbilityRegistry = defineAbilities({
  // Hunted — Alter-Ego Action: Discard a card from your hand → discard this card.
  "45072.obligation": alterEgoAction({ cost: discardFromHandCost(1, 1) }, discardThisObligation),

  // War-Weary — When Revealed: You are stunned. If you were already stunned, take 2 damage instead.
  "45073.when-revealed": whenRevealed(ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2), stun(yourIdentity))),
  // [star] Boost: the same text, for the player the activation is against.
  "45073.boost": boost(ifThen(hasStatus(yourIdentity, "stunned"), takeDamage(2), stun(yourIdentity))),

  // Targeted for Extermination — When Defeated: The player who defeated this scheme confuses their identity.
  "45074.when-defeated": whenDefeated(confuse(identityOf(defeatingPlayer))),
});
