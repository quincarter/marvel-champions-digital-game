/**
 * The log is built from a real Core game's events, not hand-written fixtures,
 * so it is exercised against the shapes the engine actually emits.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, PlayerId } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { appendEvents, emptyLog, logLine, type LogState } from "./log-lines.js";

/** Plays a real Rhino solo game far enough to produce a villain phase. */
async function playedGame(): Promise<{ log: LogState; state: GameState; viewer: PlayerId }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });

  let log = emptyLog();
  const viewer = store.state.game!.players[0]!.playerId;
  const record = (): void => {
    log = appendEvents(log, store.state.lastEvents, store.state.game!, viewer);
  };
  record();

  for (let step = 0; step < 60 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      const entry = legal.actions.legal.find((e) => e.action.kind === "endTurn") ?? legal.actions.legal[0];
      if (!entry) break;
      await store.dispatch(entry.example);
    } else break;
    record();
  }

  return { log, state: store.state.game!, viewer };
}

describe("game log", () => {
  let played: Awaited<ReturnType<typeof playedGame>>;

  beforeAll(async () => {
    played = await playedGame();
  }, 60_000);

  test("produces readable beats with round references", () => {
    const { lines } = played.log;

    expect(lines.length).toBeGreaterThan(5);
    for (const line of lines) {
      expect(line.ref).toMatch(/^R\d+\.\d+$/);
      expect(line.text.length).toBeGreaterThan(0);
      // No line may leak an engine id: those are the bookkeeping we drop.
      expect(line.text).not.toMatch(/\b(inst|frame|choice)-\d+/);
    }
  });

  test("addresses the perspective seat in the second person and names the rest", () => {
    const mine = played.log.lines.find((line) => line.text.startsWith("You "));
    expect(mine).toBeDefined();
  });

  test("numbers beats within a round and restarts them on the next round", () => {
    const byRound = new Map<number, string[]>();
    for (const line of played.log.lines) {
      byRound.set(line.round, [...(byRound.get(line.round) ?? []), line.ref]);
    }
    for (const [round, refs] of byRound) {
      // Beats are 1-based and strictly increasing inside a round.
      const beats = refs.map((ref) => Number(ref.split(".")[1]));
      expect(beats[0], `round ${round}`).toBe(round === 0 ? beats[0] : 1);
      for (let i = 1; i < beats.length; i++) expect(beats[i]).toBe(beats[i - 1]! + 1);
    }
  });

  test("drops engine bookkeeping rather than printing an engine trace", () => {
    const noisy: GameEvent[] = [
      { type: "framePushed", frameId: "frame-1" as never, frame: "event", description: "x" },
      { type: "framePopped", frameId: "frame-1" as never, frame: "event" },
      { type: "targetChosen", slot: "target", instanceIds: [] },
      { type: "abilityUseRecorded", instanceId: "inst-1" as never, abilityId: "a" as never, uses: 1 },
    ];

    for (const event of noisy) {
      expect(logLine(event, played.state, played.viewer), event.type).toBeNull();
    }
  });

  test("a spent Tough is struck through, so a 0-damage hit never looks like a bug", () => {
    const beat = logLine(
      { type: "damagePrevented", targetInstanceId: played.state.villain.instanceId, amount: 3, reason: "tough" },
      played.state,
      played.viewer,
    );

    expect(beat).not.toBeNull();
    expect(beat!.tags).toEqual([{ status: "tough", spent: true }]);
    expect(beat!.text).toContain("took 0 damage");
  });

  test("a status being given is tagged, not struck", () => {
    const beat = logLine(
      { type: "statusGiven", instanceId: played.state.villain.instanceId, status: "stunned" },
      played.state,
      played.viewer,
    );

    expect(beat!.tags).toEqual([{ status: "stunned", spent: false }]);
  });

  /**
   * RRG 1.8 "Unique Icon". The board shows no change when an entry is refused,
   * so the log line is the only thing that stops it reading as a bug — the same
   * reason `threatRemovalBlocked` earns a line.
   */
  test("a refused unique entry says what blocked it, and whether the card was discarded", () => {
    const villain = played.state.villain.instanceId;
    const scheme = played.state.mainScheme.instanceId;

    const noEffect = logLine(
      { type: "uniqueEntryBlocked", instanceId: scheme, cardId: played.state.instances[scheme]!.cardId, matchedInstanceId: villain, disposition: "noEffect" },
      played.state,
      played.viewer,
    );
    expect(noEffect!.text).toContain("can't enter play");
    expect(noEffect!.text).not.toContain("discarded");

    const discarded = logLine(
      { type: "uniqueEntryBlocked", instanceId: scheme, cardId: played.state.instances[scheme]!.cardId, matchedInstanceId: villain, disposition: "discarded" },
      played.state,
      played.viewer,
    );
    expect(discarded!.text).toContain("is discarded");
    expect(discarded!.voice).toBe("scenario");
  });

  test("keeps only the most recent lines so the list never grows without bound", () => {
    const many: GameEvent[] = Array.from({ length: 30 }, (_u, i) => ({ type: "roundStarted", round: i + 1 }));
    const capped = appendEvents(emptyLog(), many, played.state, played.viewer, 10);

    expect(capped.lines).toHaveLength(10);
    expect(capped.lines.at(-1)!.text).toContain("Round 30");
    // Ids stay unique across the trim, so a virtualized list can key on them.
    expect(new Set(capped.lines.map((line) => line.id)).size).toBe(10);
  });
});
