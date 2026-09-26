/**
 * The client's spine, exercised against real Core Set content: the session
 * store talks to an `EngineHost`, the host runs the engine, and the store never
 * decides a rule. Playing a few real turns here proves the boundary holds.
 */

import { activeVillain } from "@mc/engine";
import { beforeEach, describe, expect, test } from "vitest";
import { CORE_POOL_VERSION, CORE_STARTER_DECKS, deckFromStarterDeck } from "@mc/content";
import { LocalEngineHost } from "../engine/local-host.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import type { EngineHost, SessionConfig } from "../engine/host.js";
import { corePlayerFromDeck } from "../view/deck-seat.js";
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
    expect(game!.cardPool[activeVillain(game!).cardId]).toBeDefined();
    expect(game!.cardPool[game!.mainScheme.cardId]).toBeDefined();
    expect(game!.cardPool[game!.players[0]!.identity.cardId]).toBeDefined();
    expect(game!.players).toHaveLength(1);
    expect(activeVillain(game!).defeated).toBe(false);
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

  /** Walks a real game forward: answers choices with the minimum, otherwise ends the turn. */
  const advance = async (target: SessionStore, steps: number): Promise<void> => {
    for (let step = 0; step < steps && !target.state.game!.outcome; step++) {
      const { legal } = target.state;
      if (!legal) break;
      if (legal.actions.kind === "choice") {
        const { choice } = legal.actions;
        await target.resolveChoice(choice.options.slice(0, choice.minSelections).map((option) => option.optionId));
        continue;
      }
      if (legal.actions.kind !== "turn") break;
      const end = legal.actions.legal.find((entry) => entry.action.kind === "endTurn") ?? legal.actions.legal[0];
      if (!end) break;
      await target.dispatch(end.example);
    }
  };

  /**
   * The reason saves exist: refreshing the page used to lose the game. A second
   * host on the same storage is the in-thread stand-in for a reload — nothing
   * in memory carries over, only what was written.
   */
  test("a game survives a refresh: resuming restores the same state, position and record", async () => {
    const storage = new MemoryGameStorage();
    const firstHost = new LocalEngineHost(storage);
    const played = new SessionStore(firstHost);
    await played.start(RHINO_SOLO);
    // Four commands: a table that only ends its turn loses to this seed's
    // scheme on the fifth, and a finished game is never offered to resume.
    await advance(played, 4);
    await firstHost.flushed();
    const before = played.state;
    expect(before.game!.outcome).toBeNull();
    expect(before.version).toBeGreaterThan(2);

    const reloaded = new SessionStore(new LocalEngineHost(storage));
    const offered = await reloaded.latestSave();
    expect(offered).not.toBeNull();
    expect(offered!.commandCount).toBe(before.version);
    expect(offered!.round).toBe(before.game!.round);

    await reloaded.resume(offered!.id);
    const after = reloaded.state;
    expect(after.status).toBe("playing");
    expect(after.error).toBeNull();
    expect(after.version).toBe(before.version);
    expect(after.game).toEqual(before.game);
    // Derived from the replayed log, not saved beside it — and still identical.
    expect(after.record).toEqual(before.record);
    // A resumed game arrives at its position; it doesn't replay the animations of getting there.
    expect(after.lastEvents).toEqual([]);
    expect(after.saveError).toBeNull();
  }, 60_000);

  test("a resumed game keeps saving, so a second refresh picks up the newer position", async () => {
    const storage = new MemoryGameStorage();
    const first = new SessionStore(new LocalEngineHost(storage));
    await first.start(RHINO_SOLO);
    await advance(first, 2);

    const secondHost = new LocalEngineHost(storage);
    const second = new SessionStore(secondHost);
    await second.resume((await second.latestSave())!.id);
    await advance(second, 2);
    await secondHost.flushed();
    expect(second.state.game!.outcome).toBeNull();

    const third = new SessionStore(new LocalEngineHost(storage));
    const offered = await third.latestSave();
    expect(offered!.commandCount).toBe(second.state.version);
    await third.resume(offered!.id);
    expect(third.state.game).toEqual(second.state.game);
  }, 60_000);

  test("a finished game is recorded as over and is not offered as Continue", async () => {
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const played = new SessionStore(host);
    await played.start(RHINO_SOLO);
    await advance(played, 40);
    await host.flushed();

    const outcome = played.state.game!.outcome;
    expect(outcome).not.toBeNull();
    const [saved] = await storage.list();
    expect(saved!.status).toBe(outcome!.result === "win" ? "won" : "lost");
    expect(saved!.outcome).toEqual(outcome);
    expect(await new SessionStore(new LocalEngineHost(storage)).latestSave()).toBeNull();
  }, 60_000);

  test("a save that no longer replays fails with the reason, and is never offered again", async () => {
    const storage = new MemoryGameStorage();
    const host = new LocalEngineHost(storage);
    const played = new SessionStore(host);
    await played.start(RHINO_SOLO);
    await played.resolveChoice([]);
    await host.flushed();

    // A command this build's engine rejects — what a card changing under an old save looks like.
    const saved = (await storage.latestActive())!;
    await storage.append(saved.id, saved.commandCount, { type: "basicRecover", playerId: "nobody" } as never, {
      round: saved.round,
      commandCount: saved.commandCount + 1,
      updatedAt: saved.updatedAt + 1,
      status: "active",
      outcome: null,
    });

    const reloaded = new SessionStore(new LocalEngineHost(storage));
    await reloaded.resume(saved.id);
    expect(reloaded.state.status).toBe("failed");
    expect(reloaded.state.error).toMatch(/no longer replays/);
    expect(await reloaded.latestSave()).toBeNull();
  });

  /**
   * PLAN.md Phase 9: `SessionConfig.players` already accepted a custom deck
   * (`CorePlayer`'s `{ identityCardId, deck, aspects }` case) before a Decks
   * screen existed to produce one — this is what a save now records once a
   * seat is a saved/imported deck rather than a precon, and it must resume
   * exactly like a `{ starterDeckId }` seat always has.
   */
  test("a game seated with a custom deck (not a starter-deck id) survives a refresh", async () => {
    const spiderMan = deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION);
    const config: SessionConfig = {
      scenarioId: "rhino",
      difficulty: "standard",
      players: [corePlayerFromDeck(spiderMan)],
      seed: 2026,
    };

    const storage = new MemoryGameStorage();
    const firstHost = new LocalEngineHost(storage);
    const played = new SessionStore(firstHost);
    await played.start(config);
    await advance(played, 4);
    await firstHost.flushed();
    const before = played.state;
    expect(before.game!.outcome).toBeNull();
    expect(before.status).toBe("playing");

    const reloaded = new SessionStore(new LocalEngineHost(storage));
    const offered = await reloaded.latestSave();
    expect(offered!.config.players).toEqual(config.players);

    await reloaded.resume(offered!.id);
    expect(reloaded.state.status).toBe("playing");
    expect(reloaded.state.error).toBeNull();
    expect(reloaded.state.game).toEqual(before.game);
  }, 60_000);

  /**
   * `Setup` currently only ever offers legal, seatable decks (Title dims and
   * blocks the rest), but `createGame` enforces `requireLegalDecks` regardless
   * — this proves a refusal that reaches the store all the way from the
   * engine still names the illegal seat, so a caller can route to "fix this
   * deck" rather than a generic failure (PLAN.md Phase 9).
   */
  test("seating an illegal deck fails with the engine's illegal_deck code and names the seat", async () => {
    const illegal = { ...deckFromStarterDeck(CORE_STARTER_DECKS[0]!, CORE_POOL_VERSION), cards: [] };
    const config: SessionConfig = {
      scenarioId: "rhino",
      difficulty: "standard",
      players: [corePlayerFromDeck(illegal)],
      seed: 2026,
    };

    await store.start(config);
    expect(store.state.status).toBe("failed");
    expect(store.state.error).toMatch(/deck/i);
    expect(store.state.setupError?.code).toBe("illegal_deck");
    expect(store.state.setupError?.illegalDecks).toHaveLength(1);
    expect(store.state.setupError?.illegalDecks[0]?.seatIndex).toBe(0);
  });

  test("commandTrail records one entry per dispatched command, resets on a fresh start, and rewindTo truncates it", async () => {
    await store.start(RHINO_SOLO);
    expect(store.state.commandTrail).toEqual([]);

    const dispatchOne = async (): Promise<void> => {
      const legal = store.state.legal!.actions;
      const command =
        legal.kind === "choice"
          ? {
              type: "resolveChoice" as const,
              playerId: legal.choice.playerId,
              choiceId: legal.choice.choiceId,
              selectedOptionIds: legal.choice.options.slice(0, legal.choice.minSelections).map((o) => o.optionId),
            }
          : legal.kind === "turn"
            ? (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0])!.example
            : (() => {
                throw new Error(`unexpected legal kind ${legal.kind}`);
              })();
      const ok = await store.dispatch(command);
      expect(ok).toBe(true);
    };

    await dispatchOne();
    await dispatchOne();
    await dispatchOne();
    expect(store.state.commandTrail).toHaveLength(3);
    expect(store.state.commandTrail.length).toBe(store.state.version);
    const afterOne = store.state.commandTrail[0]!;

    const ok = await store.rewindTo(1);
    expect(ok).toBe(true);
    expect(store.state.version).toBe(1);
    expect(store.state.commandTrail).toHaveLength(1);
    expect(store.state.commandTrail[0]).toEqual(afterOne);
  });
});
