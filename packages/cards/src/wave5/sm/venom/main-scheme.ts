import {
  chosen,
  defineAbilities,
  encounterCards,
  eventPlayer,
  eventSource,
  firstPlayer,
  forcedInterrupt,
  identityOf,
  moveBoostCards,
  on,
  putIntoPlay,
  query,
  selectCards,
  setup,
} from "../../../dsl/index.js";

/**
 * "Leave Us Alone!" (`sm` 27076a/b, docs/phase7-wave5.md §2.2/§3.6): 1A's Setup and 1B's Forced Interrupt. 1B's own
 * "If this stage is completed, the players lose the game" is data (`completionLoses`).
 */
export const LEAVE_US_ALONE = defineAbilities({
  // 1A (27076a) — Setup: Put the Bell Tower environment into play, QUIET side faceup. No "then shuffle" is printed
  // (unlike a mid-game search), matching `sandman/main-scheme.ts`'s own Setup precedent (Hapless Pedestrians) of not
  // shuffling either. A new instance starts unflipped (its QUIET/`aSide` face), so nothing else is needed to put it
  // in faceup that side.
  "27076a.setup": setup(
    selectCards("tower", encounterCards(["deck"], { name: "Bell Tower" })),
    putIntoPlay(chosen("tower"), firstPlayer),
  ),
  // 1B (27076b) — Forced Interrupt: When Venom activates against you, move each facedown boost card from your
  // identity to Venom (docs/phase7-wave5.md §3.6's own worked example, `wave5-primitives.test.ts`).
  "27076b.leave-us-alone-forced-interrupt": forcedInterrupt(
    on.enemyActivating(query("villain")),
    moveBoostCards(identityOf(eventPlayer), eventSource),
  ),
});
