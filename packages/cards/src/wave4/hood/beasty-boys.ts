import {
  after,
  anyOf,
  cards,
  constant,
  countOf,
  forcedInterrupt,
  gainsKeywordX,
  increaseDamage,
  isConfused,
  isStunned,
  on,
  chosen,
  chooseTarget,
  confuse,
  defineAbilities,
  each,
  eventTarget,
  exists,
  forcedResponse,
  ifThen,
  moveCards,
  query,
  self,
  stun,
  whenDefeated,
  whenRevealed,
  boost,
} from "../../dsl/index.js";

/**
 * The Beasty Boys modular set (`hood` 24014-24017, docs/phase7-wave4.md §2.3): a side scheme (Beast Mode), two
 * minions (Griffin, Mandrill) and a treachery (Double Trouble).
 *
 * Beast Mode's "increase that amount by 1" is `increaseDamage` (docs/phase7-wave4.md §3.52), gated on the target being
 * stunned or confused by the rules (`isStunned`/`isConfused`, steady-aware). Mandrill's "retaliate X" is a live keyword
 * value (`gainsKeywordX`, §3.53).
 */

export const BEASTY_BOYS = defineAbilities({
  // Beast Mode (24014, side scheme) — Forced Interrupt: when a stunned or confused friendly character would take any
  // amount of damage, increase that amount by 1.
  "24014.beast-mode-forced-interrupt": forcedInterrupt(
    on.damage(query(["identity", "ally"])),
    ifThen(anyOf(isStunned(eventTarget), isConfused(eventTarget)), increaseDamage(1)),
  ),
  // Mandrill (24016, minion) — Mandrill gains retaliate X, where X is equal to the number of confused characters
  // (friendly or enemy) in play. "Confused" counts a confused status card, as `hasStatus` reads it.
  "24016.mandrill-constant": constant(
    gainsKeywordX("retaliate", countOf(query("character", { hasStatus: "confused" })), { self: true }),
  ),

  // Griffin (24015, minion; Quickstrike is data) — [star] Forced Response: after Griffin attacks and damages a
  // character, stun that character. When Defeated: if there is a stunned friendly character in play, shuffle
  // Griffin into the encounter deck.
  "24015.griffin-forced-response": forcedResponse(after.enemyAttacks("self", { damages: true }), stun(eventTarget)),
  "24015.when-defeated": whenDefeated(
    ifThen(
      exists(query(["identity", "ally"], { hasStatus: "stunned" })),
      moveCards(cards(self), "encounterDeckShuffle"),
    ),
  ),

  // Mandrill (24016, minion) — When Revealed: confuse each character you control.
  "24016.when-revealed": whenRevealed(confuse(each(query("character", { controller: "you" })))),

  // Double Trouble (24017, treachery; starIcon is data) — When Revealed: stun a character you control. Confuse a
  // character you control. [star] Boost: resolve this card's own When Revealed ability.
  "24017.when-revealed": whenRevealed(
    chooseTarget("stunned", query("character", { controller: "you" })),
    stun(chosen("stunned")),
    chooseTarget("confused", query("character", { controller: "you" })),
    confuse(chosen("confused")),
  ),
  "24017.boost": boost(
    chooseTarget("stunned2", query("character", { controller: "you" })),
    stun(chosen("stunned2")),
    chooseTarget("confused2", query("character", { controller: "you" })),
    confuse(chosen("confused2")),
  ),
});
