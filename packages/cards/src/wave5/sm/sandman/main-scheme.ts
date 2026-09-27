import {
  addCounters,
  chosen,
  defineAbilities,
  dealIndirectDamage,
  encounterCards,
  firstPlayer,
  forcedResponse,
  on,
  putIntoPlay,
  selectCards,
  setup,
} from "../../../dsl/index.js";

/**
 * Hapless Pedestrians (`sm` 27064a/b, docs/phase7-wave5.md §2.2/§3.4): 1A's Setup and 1B's Forced Response. 1B's own
 * "If this stage is completed, the players lose the game" is data (`completionLoses`).
 */
export const HAPLESS_PEDESTRIANS = defineAbilities({
  // 1A (27064a) — Setup: Search the encounter deck for the City Streets environment and put it into play. Place 4
  // sand counters on it. No "then shuffle" is printed (unlike a mid-game search), matching `escape-the-museum.ts`'s
  // own Setup precedent (Library Labyrinth) of not shuffling either.
  "27064a.setup": setup(
    selectCards("streets", encounterCards(["deck"], { name: "City Streets" })),
    putIntoPlay(chosen("streets"), firstPlayer),
    addCounters("sand", 4, chosen("streets")),
  ),
  // 1B (27064b) — Forced Response: After an acceleration token is placed on this scheme, deal 3 indirect damage to
  // the first player (docs/phase7-wave5.md §3.4's own worked example, `wave5-primitives.test.ts`).
  "27064b.hapless-pedestrians-forced-response": forcedResponse(
    on.accelerationTokenPlaced("self"),
    dealIndirectDamage(firstPlayer, 3),
  ),
});
