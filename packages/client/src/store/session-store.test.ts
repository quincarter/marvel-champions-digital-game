/**
 * The client's spine, exercised against real Core Set content: the session
 * store talks to an `EngineHost`, the host runs the engine, and the store never
 * decides a rule. Playing a few real turns here proves the boundary holds.
 */

import { beforeEach, describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import type { EngineHost, SessionConfig } from "../engine/host.js";
import { SessionStore } from "./session-store.js";

const RHINO_SOLO: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 2026,
};

const KLAW_TWO: SessionConfig = {
  scenarioId: "klaw",
  difficulty: "standard",
  players: [{ starterDeckId: "core-she-hulk-aggression" }, { starterDeckId: "core-black-panther-protection" }],
  seed: 77,
};

describe("SessionStore", () => {
  let host: EngineHost;
  let store: SessionStore;

  beforeEach(() => {
    host = new LocalEngineHost();
    store = new SessionStore(host);
  });

  test("starts a real Core game and publishes a complete state", async () => {
    await store.start(RHINO_SOLO);
    const { status, game, version, error } = store.state;

    expect(status).toBe("playing");
    expect(error).toBeNull();
    expect(version).toBe(0);
    expect(game).not.toBeNull();
    // The card pool is re-attached on this side of the boundary, so every
    // `@mc/engine` query helper works against what the store holds.
    expect(game!.cardPool[game!.villain.cardId]).toBeDefined();
    expect(game!.cardPool[game!.mainScheme.cardId]).toBeDefined();
    expect(game!.cardPool[game!.players[0]!.identity.cardId]).toBeDefined();
    expect(game!.players).toHaveLength(1);
    expect(game!.villain.defeated).toBe(false);
  });

  test("prefetches legal actions for the player who must act", async () => {
    await store.start(RHINO_SOLO);
    const { legal, game, perspectiveId } = store.state;

    expect(legal).not.toBeNull();
    // Setup parks on the mulligan choice, so the acting player is the one it
    // is addressed to, and the board's perspective follows them.
    expect(legal!.playerId).toBe(game!.pendingChoice!.playerId);
    expect(perspectiveId).toBe(legal!.playerId);
    expect(legal!.actions.kind).toBe("choice");
  });

  test("resolveChoice answers as the player the engine names, not as 'the human'", async () => {
    await store.start(KLAW_TWO);
    const choice = store.state.game!.pendingChoice!;
    const decidingPlayer = choice.playerId;

    expect(await store.resolveChoice([])).toBe(true);

    const { commands } = await store.save();
    expect(commands).toEqual([
      { type: "resolveChoice", playerId: decidingPlayer, choiceId: choice.choiceId, selectedOptionIds: [] },
    ]);
  });

  test("plays real turns: every command comes from the engine's own legal list", async () => {
    await store.start(RHINO_SOLO);

    // Take the mulligan choice, then walk turns by only ever issuing an
    // `example` command the engine itself listed as legal.
    for (let step = 0; step < 40 && !store.state.game!.outcome; step++) {
      const { legal } = store.state;
      if (!legal) break;
      const actions = legal.actions;
      if (actions.kind === "choice") {
        const min = actions.choice.minSelections;
        const picks = actions.choice.options.slice(0, min).map((option) => option.optionId);
        expect(await store.resolveChoice(picks)).toBe(true);
        continue;
      }
      if (actions.kind !== "turn") break;
      // Prefer a real action over ending the turn, so the game actually moves.
      const acting = actions.legal.find((entry) => entry.action.kind !== "endTurn") ?? actions.legal[0];
      expect(acting).toBeDefined();
      expect(await store.dispatch(acting!.example)).toBe(true);
      expect(store.state.error).toBeNull();
    }

    const { game, version } = store.state;
    expect(version).toBeGreaterThan(3);
    expect(game!.round).toBeGreaterThanOrEqual(1);
  }, 60_000);

  test("a rejected command changes nothing and reports the engine's own message", async () => {
    await store.start(RHINO_SOLO);
    const before = store.state;

    // Recovering is illegal during the mulligan choice; the engine says so.
    const accepted = await store.dispatch({ type: "basicRecover", playerId: before.game!.players[0]!.playerId });

    expect(accepted).toBe(false);
    expect(store.state.game).toBe(before.game);
    expect(store.state.version).toBe(before.version);
    expect(store.state.error).toMatch(/choice/i);
    expect(store.state.inFlight).toBe(false);
  });

  test("the save is a replayable log of exactly the commands issued", async () => {
    await store.start(RHINO_SOLO);
    await store.resolveChoice([]);

    const saved = await store.save();
    expect(saved.commands).toHaveLength(1);
    expect(saved.initialState.cardPool).toBeDefined();
    expect(saved.initialState.round).toBe(1);
  });

  test("subscribers get the current state immediately and on every change", async () => {
    const seen: number[] = [];
    store.subscribe((state) => seen.push(state.version));

    await store.start(RHINO_SOLO);
    await store.resolveChoice([]);

    expect(seen[0]).toBe(-1); // the initial delivery, before any game exists
    expect(seen.at(-1)).toBe(store.state.version);
    expect(store.state.version).toBe(1);
  });
});
