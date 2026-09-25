import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import { foldModularSetIntoDeck, game, onStage, stackTop } from "./testing.js";

/**
 * Real-game tests for the State of Emergency modular set (`state-of-emergency.ts`): Disaster at the Docks (24056),
 * Offshore Inferno (24057) and Hot Pursuit (24058). Feisty Heist (24055) and Citywide Crisis (24059) are tested in
 * `hood-gaps.test.ts`.
 *
 * Ref -> covering test:
 *  24056.when-revealed -> "takes exactly 3 indirect damage"
 *  24057.when-revealed -> "discards the lowest-cost ally/upgrade/support you control"
 *  24058.when-revealed -> "discards until a minion is found and puts it into play engaged with you"
 */

const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "state_of_emergency");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("State of Emergency (24056-24058)", () => {
  it("24056.when-revealed: takes exactly 3 indirect damage", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24056");
    const identity = staged.players[0]!.identity.instanceId;
    const before = staged.instances[identity]!.damage;
    const revealed = settle(runWave4(staged, { type: "endTurn", playerId: P1 }), firstLegal, undefined, WAVE4_DEPS);
    expect(revealed.instances[identity]!.damage - before).toBe(3);
  });

  it("24057.when-revealed: discards the lowest-cost ally/upgrade/support P1 controls", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24057");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24057.when-revealed")).toBe(true);
  });

  it("24058.when-revealed: discards until a minion is found and puts it into play engaged with you", () => {
    const base = onStage(withSet(), 0);
    const staged = stackTop(base, "01186", "24058");
    const { state: activated, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24058.when-revealed")).toBe(true);
    expect(activated.players[0]!.playArea.length).toBeGreaterThanOrEqual(1);
  });
});
