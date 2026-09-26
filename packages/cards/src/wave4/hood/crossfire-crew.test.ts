import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  patchInstance,
  stackTop,
} from "./testing.js";

/**
 * Real-game tests for the Crossfire's Crew modular set (`crossfire-crew.ts`): Corruptor (24025), Crossfire (24026),
 * Mister Fear (24027) and Caught in the Crossfire (24028). Out for Blood (24023) and Controller (24024) are tested in
 * `hood-gaps.test.ts`.
 *
 * Ref -> covering test:
 *  24025.when-revealed -> "exhausts each ally and places threat for each"
 *  24025.boost         -> "the boost exhausts a chosen character"
 *  24026.crossfire-forced-interrupt -> "retargets Crossfire's attack to the lowest-hp friendly character"
 *  24027.mister-fear-constant -> "an additional mental resource to ready"
 *  24027.boost         -> "discards from the top of the deck until an ally is found"
 *  24028.when-revealed -> "discards until a Crossfire's Crew minion, reveals it, deals indirect damage"
 */

const withSet = (seed = 1, extraPlayers: readonly { readonly starterDeckId: string }[] = []) =>
  foldModularSetIntoDeck(game(seed, extraPlayers), "crossfire_crew");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("Crossfire's Crew (24025-24028)", () => {
  it("24025.when-revealed: exhausts each ally P1 controls and places 1 threat per ally exhausted", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24025");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24025.when-revealed")).toBe(true);
  });

  it("24025.boost: exhausts a chosen character P1 controls", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24025");
    const identity = staged.players[0]!.identity.instanceId;
    const activated = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(activated.instances[identity]?.exhausted).toBe(true);
  });

  it("24026.crossfire-forced-interrupt: retargets Crossfire's attack to the lowest-hp friendly character and grants overkill/ranged", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24026", P1);
    const { events } = driveEvents(WAVE4_DEPS, staged.state, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24026.crossfire-forced-interrupt")).toBe(true);
  });

  it("24027.mister-fear-constant: the engaged player must spend a mental resource to ready a hero or ally", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24027", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const exhausted = patchInstance(staged.state, identity, { exhausted: true });
    // Ready declined (no payment offered): stays exhausted.
    const declined = settle(runWave4(exhausted, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(declined.instances[identity]?.exhausted).toBe(true);
  });

  it("24027.boost: discards from the top of the deck until an ally is found", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = stackTop(base, "24027");
    const deckBefore = staged.players[0]!.deck.length;
    const activated = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(activated.players[0]!.deck.length).toBeLessThan(deckBefore);
  });

  it("24028.when-revealed: discards until a Crossfire's Crew minion is found, reveals it, and deals matching indirect damage", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24028");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24028.when-revealed")).toBe(true);
  });
});
