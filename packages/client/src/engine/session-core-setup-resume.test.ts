/**
 * Resuming a game saved during setup: the deal is part of the stored baseline and a mulligan is one logged
 * command, so a reload replays neither twice. A deck-import browser check once reported a Board hand that differed
 * from the mulligan screen's; that was the mulligan itself (the screen shows the hand before it), and these tests
 * pin the part that must never change: resume reproduces the saved state exactly.
 */
import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "cap-leadership" }],
  seed: 2026,
};

const handsOf = (state: { readonly players: readonly { readonly hand: readonly unknown[] }[] }) =>
  state.players.map((player) => player.hand);

describe("a game saved during setup", () => {
  test("resumes at the mulligan screen with the hands the player was shown", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(CONFIG);
    const saved = await storage.latestActive();
    const resumed = await new EngineSessionCore({ storage }).resume(saved!.id);
    expect(resumed.snapshot.state).toEqual(started.snapshot.state);
    expect(handsOf(resumed.snapshot.state)).toEqual(handsOf(started.snapshot.state));
    expect(resumed.snapshot.legal?.playerId).toBe(started.snapshot.legal?.playerId);
  });

  test("resumes after one seat's mulligan with that mulligan applied exactly once", async () => {
    const storage = new MemoryGameStorage();
    const first = new EngineSessionCore({ storage });
    const started = await first.start(CONFIG);
    const choice = started.snapshot.legal!.actions;
    if (choice.kind !== "choice") throw new Error("expected the mulligan choice");
    const dispatched = first.dispatch({
      type: "resolveChoice",
      playerId: choice.choice.playerId,
      choiceId: choice.choice.choiceId,
      selectedOptionIds: [choice.choice.options[0]!.optionId],
    });
    expect(dispatched.ok).toBe(true);
    if (!dispatched.ok) return;
    await first.flushed();
    const saved = await storage.latestActive();
    expect(saved?.commandCount).toBe(1);
    const resumed = await new EngineSessionCore({ storage }).resume(saved!.id);
    expect(resumed.snapshot.state).toEqual(dispatched.snapshot.state);
    const seat = dispatched.snapshot.state.players.find((player) => player.playerId === choice.choice.playerId)!;
    expect(seat.discard).toHaveLength(1);
  });
});
