import {
  after,
  cards,
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
 * **Not scripted (genuine engine gaps — see `../coverage.test.ts`'s `KNOWN_SKIPPED.hood`):**
 * - **Beast Mode (24014, `beast-mode-forced-interrupt`)**: "Forced Interrupt: When a stunned or confused friendly
 *   character would take any amount of damage, increase that amount by 1" needs a way to modify the amount of an
 *   in-flight damage event before it applies, keyed off the target's own current status. No `EffectSpec` does this
 *   without losing the original event's own source/overkill/piercing bookkeeping (`preventDamage`/
 *   `replaceTriggeringEvent` cancel or replace the event outright, not adjust its amount in place).
 * - **Mandrill (24016, `mandrill-constant`)**: "Mandrill gains retaliate X, where X is equal to the number of
 *   confused characters (friendly or enemy) in play" needs a `KeywordGrantSpec.keyword.value` that reads a
 *   `ValueSpec` (a live count) rather than the fixed number `@mc/content`'s `KeywordInstance` carries — every other
 *   granted-keyword value in this codebase is a printed constant (`{ name: "retaliate", value: 1 }`).
 */

export const BEASTY_BOYS = defineAbilities({
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

  // Mandrill (24016, minion) — When Revealed: confuse each character you control. (Its own "gains retaliate X" is
  // the skipped `24016.mandrill-constant` above.)
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
