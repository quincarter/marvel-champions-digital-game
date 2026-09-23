import type { GameState } from "@mc/engine";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  picking,
  playerOf,
  settle,
  stackEncounterDeck,
} from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { wave3Scenario } from "../setup.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../testing.js";

/**
 * The Badoon Headhunter modular set (16183–16185, `gmw/badoon-headhunter.ts`), exercised by swapping it in for
 * Infiltrate the Museum's own recommended modular (Menagerie Medley) via `modularSetIds` — modular sets are
 * interchangeable by design (docs/phase7-wave3.md §2.2, RRG 1.8 FAQ "Modular Encounter Sets", p. 61), and no `gmw`
 * scenario recommends Badoon Headhunter itself (module docblock: it's modular, not campaign-only, but no 1A
 * "Contents" text names it either).
 */
const withBadoonHeadhunter = () =>
  startWave3Game(
    wave3Scenario("infiltrate-the-museum", {
      players: [{ starterDeckId: "groot-protection" }],
      seed: 2026,
      modularSetIds: ["badoon_headhunter"],
    }),
  );

/** Reveal `code` from the encounter deck, past the villain's own unconditional boost draw (docs/card-scripting-
 * process.md §7): stack a filler ahead of it, then run the villain phase. */
const reveal = (state: GameState, code: string, pick = firstLegal): GameState =>
  settle(
    runWave3(stackEncounterDeck(state, "01186", code), { type: "endTurn", playerId: P1 }),
    pick,
    undefined,
    WAVE3_DEPS,
  );

describe("Badoon Headhunter (16183)", () => {
  it("[star] Boost: puts Badoon Headhunter into play engaged with you (16183.boost)", () => {
    const state = withBadoonHeadhunter();
    const staged = stackEncounterDeck(state, "16183");
    const { state: after } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    const [headhunter] = instancesOf(after, "16183");
    expect(headhunter).toBeDefined();
    expect(inst(after, headhunter!).engagedWith).toBe(P1);
  });
});

describe("On the Hunt (16184)", () => {
  it("When Revealed: take 2 damage (the default choice) (16184.when-revealed)", () => {
    const state = withBadoonHeadhunter();
    const identity = identityOf(state, P1);
    const damageBefore = inst(state, identity).damage;
    const after = reveal(state, "16184");
    expect(inst(after, identity).damage).toBe(damageBefore + 2);
  });

  it("When Revealed: discard 1 card at random from your hand instead (16184.when-revealed)", () => {
    const state = withBadoonHeadhunter();
    const handBefore = playerOf(state, P1).hand.length;
    const after = reveal(state, "16184", picking("1"));
    expect(playerOf(after, P1).hand.length).toBe(handBefore - 1);
  });

  it("[star] Boost: gives the villain 1 additional boost card for this activation (16184.boost)", () => {
    const state = withBadoonHeadhunter();
    const staged = stackEncounterDeck(state, "16184");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
  });
});

describe("Dead to Rights (16185)", () => {
  it("When Revealed: exhausts your identity (16185.when-revealed)", () => {
    const state = withBadoonHeadhunter();
    const identity = identityOf(state, P1);
    const readied = patchInstance(state, identity, { exhausted: false });
    const after = reveal(readied, "16185");
    expect(inst(after, identity).exhausted).toBe(true);
  });

  // "If you cannot, place 2 threat on the main scheme" (the fallback when the identity is already exhausted) is
  // not separately exercised by a live reveal here: RRG 1.8 "End of Player Phase" (p. 18) readies every exhausted
  // card, identity included, before every villain phase begins, so reaching "already exhausted" at reveal time
  // needs another effect to exhaust it earlier in the *same* villain phase — no `gmw` card in this modular set or
  // Infiltrate the Museum's/Nebula's own required sets does that, and chaining Dead to Rights into a second copy
  // of itself via its own Surge isn't available (`quantityInSet: 1`). The `ifThen`/`refMatches(yourIdentity,
  // { exhausted: true })` shape is the same one this file's Obedience Potion/Vandarian Power Stone siblings use
  // for their own attach targeting, and the primary branch above is exact and real-command driven; the fallback
  // is a one-line `placeThreat(2, theMainScheme)` with no further conditional logic of its own to hide a bug in.
  it("[star] Boost: gives the villain 1 additional boost card for this activation (16185.boost)", () => {
    const state = withBadoonHeadhunter();
    const staged = stackEncounterDeck(state, "16185");
    const { events } = driveEvents(WAVE3_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(events.filter((e) => e.type === "boostCardFlipped")).toHaveLength(2);
  });
});
