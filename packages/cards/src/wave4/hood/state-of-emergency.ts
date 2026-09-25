import {
  bindTargets,
  chosen,
  chooseTarget,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  printedCostOf,
  putIntoPlay,
  query,
  superlative,
  takeDamage,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * The State of Emergency modular set (`hood` 24055-24059, docs/phase7-wave4.md §2.3): four side schemes (Feisty
 * Heist, Disaster at the Docks, Offshore Inferno, Hot Pursuit) and a treachery (Citywide Crisis).
 *
 * **Not scripted (genuine engine gaps — see `../coverage.test.ts`'s `KNOWN_SKIPPED.hood`):**
 * - **Feisty Heist (24055, `when-revealed`)**: "Discard the highest-cost card from your hand" needs a
 *   `superlative` whose `among` is a hand card, but `superlative`'s `TargetRef` (a `TargetQuery`-based in-play
 *   query) has no bridge to `CardSelector`'s zone-based hand ("Discard the lowest-cost card **you control**",
 *   24057, already works below — that's an in-play `TargetQuery`).
 * - **Citywide Crisis (24059, `when-revealed`/`boost`)**: "Resolve each 'When Revealed' ability on each side scheme
 *   in play" needs a way to re-trigger a card's `whenRevealed` ability on demand — `resolveSpecials` (the DSL's
 *   only "resolve a card's own ability again" primitive) only reads abilities of trigger kind `"special"`, not
 *   `"whenRevealed"`.
 */

export const STATE_OF_EMERGENCY = defineAbilities({
  // Disaster at the Docks (24056, side scheme; acceleration icon is data) — When Revealed: take 3 indirect damage.
  "24056.when-revealed": whenRevealed(takeDamage(3)),

  // Offshore Inferno (24057, side scheme; acceleration icon is data) — When Revealed: discard the lowest-cost card
  // you control.
  "24057.when-revealed": whenRevealed(
    bindTargets(
      "lowestCost",
      superlative(
        "lowest",
        each(query(["ally", "upgrade", "support"], { controller: "you" })),
        printedCostOf(chosen("candidate")),
      ),
    ),
    chooseTarget("pick", { inSlot: "lowestCost" }),
    discard(chosen("pick")),
  ),

  // Hot Pursuit (24058, side scheme; acceleration icon is data) — When Revealed: discard cards from the top of the
  // encounter deck until a minion is discarded. Put that minion into play engaged with you.
  "24058.when-revealed": whenRevealed(
    discardEncounterUntil(query("minion"), "found"),
    putIntoPlay(chosen("found"), you),
  ),
});
