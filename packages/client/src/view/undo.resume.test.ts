/**
 * Undo across a reload (the owner, 2026-10-14: "I was in round 2 for rhino, exited, went back in, played 2 cards, and
 * Undo took me all the way back to Round 1"). A resumed game's trail used to start empty while the store's version
 * was the replayed command count, so a trail index was read as a command count and `rewindTo(0)` rewound the whole
 * game. The resume now hands back each replayed command's own events and RNG counts, so the trail is the one a live
 * game would have, boundaries included.
 */
import { describe, expect, it } from "vitest";
import type { Command } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { SessionConfig } from "../engine/host.js";
import { SessionStore } from "../store/session-store.js";
import { undoOf, undoTargetsOf } from "./undo.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

/** Answers choices the plain way until it is the hero's turn to act. */
async function toTurn(store: SessionStore): Promise<void> {
  for (let guard = 0; guard < 60; guard += 1) {
    const legal = store.state.legal!.actions;
    if (legal.kind === "turn") return;
    if (legal.kind !== "choice") throw new Error(`unexpected legal kind ${legal.kind}`);
    await store.dispatch({
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId),
    });
  }
  throw new Error("never reached the hero's turn");
}

function exampleOf(store: SessionStore, kind: string): Command | undefined {
  const legal = store.state.legal!.actions;
  return legal.kind === "turn" ? legal.legal.find((a) => a.action.kind === kind)?.example : undefined;
}

/** A cheap move that spends no randomness: a form change, else a basic power. */
async function playOneMove(store: SessionStore): Promise<void> {
  const command = exampleOf(store, "changeForm") ?? exampleOf(store, "basicRecover") ?? exampleOf(store, "basicThwart");
  if (!command) throw new Error("no simple move available");
  expect(await store.dispatch(command)).toBe(true);
  await toTurn(store);
}

describe("Undo after a resume", () => {
  it("never rewinds past the start of the turn it resumed into, nor into an earlier round", async () => {
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const store = new SessionStore(host);
    await store.start(RHINO_SOLO);
    await toTurn(store);
    await playOneMove(store);
    expect(await store.dispatch(exampleOf(store, "endTurn")!)).toBe(true);
    await toTurn(store);
    expect(store.state.game!.round).toBe(2);
    await host.flushed();

    const reloaded = new SessionStore(new LocalEngineHost(storage));
    await reloaded.resume((await storage.list())[0]!.id);
    const resumedVersion = reloaded.state.version;
    const me = reloaded.state.perspectiveId!;
    expect(reloaded.state.game!.round).toBe(2);
    // The trail lines up with the version again, so a trail index is a command count.
    expect(reloaded.state.commandTrail).toHaveLength(resumedVersion);

    await playOneMove(reloaded);
    const afterFirst = reloaded.state.version;
    await playOneMove(reloaded);
    const lowest = undoTargetsOf(reloaded.state.commandTrail, reloaded.state.game!, me).at(-1);
    expect(lowest).toBeGreaterThanOrEqual(resumedVersion);

    for (let guard = 0; guard < 10; guard += 1) {
      const offer = undoOf(reloaded.state.commandTrail, reloaded.state.game!, me);
      if (offer?.kind !== "available") break;
      expect(offer.target).toBeGreaterThanOrEqual(resumedVersion);
      expect(await reloaded.rewindTo(offer.target)).toBe(true);
      expect(reloaded.state.game!.round).toBe(2);
    }
    expect(reloaded.state.version).toBeGreaterThanOrEqual(resumedVersion);
    expect(reloaded.state.version).toBeLessThanOrEqual(afterFirst);
    expect(reloaded.state.game!.round).toBe(2);
  });
});
