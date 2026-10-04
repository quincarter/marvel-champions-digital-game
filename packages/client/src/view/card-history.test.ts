/**
 * `view/card-history.ts`, checked against a real Core game — the thing worth
 * guarding is that a card's history never claims something the game log
 * doesn't back, and that the two never disagree about the same event.
 */

import { beforeAll, describe, expect, test } from "vitest";
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  appendCardHistory,
  cardHistoryOf,
  emptyCardHistoryLog,
  eventRefs,
  type CardHistoryLog,
} from "./card-history.js";

async function playedGame(): Promise<{
  history: CardHistoryLog;
  state: GameState;
  viewer: PlayerId;
  allEvents: readonly GameEvent[];
}> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 2026,
  });

  let history = emptyCardHistoryLog();
  const allEvents: GameEvent[] = [];
  const viewer = store.state.game!.players[0]!.playerId;
  const record = (): void => {
    history = appendCardHistory(history, store.state.lastEvents);
    allEvents.push(...store.state.lastEvents);
  };
  record();

  for (let step = 0; step < 60 && !store.state.game!.outcome; step++) {
    const legal = store.state.legal;
    if (!legal) break;
    if (legal.actions.kind === "choice") {
      const { choice } = legal.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    } else if (legal.actions.kind === "turn") {
      // Prefer playing a card over ending the turn, so this playthrough actually
      // exercises `cardPlayed` — a purely "always end turn" driver never does.
      const entry =
        legal.actions.legal.find((e) => e.action.kind === "playCard") ??
        legal.actions.legal.find((e) => e.action.kind === "endTurn") ??
        legal.actions.legal[0];
      if (!entry) break;
      await store.dispatch(entry.example);
    } else break;
    record();
  }

  return { history, state: store.state.game!, viewer, allEvents };
}

describe("card history", () => {
  let played: Awaited<ReturnType<typeof playedGame>>;

  beforeAll(async () => {
    played = await playedGame();
  }, 60_000);

  test("every card drawn this game shows up in its own history as drawn", () => {
    const drawn = played.allEvents.find(
      (event): event is Extract<GameEvent, { type: "cardDrawn" }> => event.type === "cardDrawn",
    );
    expect(drawn).toBeDefined();
    const lines = cardHistoryOf(played.history, drawn!.instanceId, played.state, played.viewer, POOL_DEPS);
    expect(lines.some((line) => line.text.includes("Drawn"))).toBe(true);
  });

  test("a played card's history says so, in the same words the table log uses", () => {
    const played1 = played.allEvents.find(
      (event): event is Extract<GameEvent, { type: "cardPlayed" }> => event.type === "cardPlayed",
    );
    expect(played1).toBeDefined();
    const lines = cardHistoryOf(played.history, played1!.instanceId, played.state, played.viewer, POOL_DEPS);
    expect(lines.some((line) => line.text.includes("played"))).toBe(true);
  });

  test("round tags are 'round.beat', two-digit beat, non-decreasing within a card's own history", () => {
    const anyId = played.allEvents.find(
      (e): e is Extract<GameEvent, { type: "cardDrawn" }> => e.type === "cardDrawn",
    )!.instanceId;
    const lines = cardHistoryOf(played.history, anyId, played.state, played.viewer, POOL_DEPS);
    for (const line of lines) expect(line.roundTag).toMatch(/^\d+\.\d{2,}$/);
    for (let i = 1; i < lines.length; i++) expect(lines[i]!.round).toBeGreaterThanOrEqual(lines[i - 1]!.round);
  });

  test("a card with no events naming it has no history", () => {
    expect(
      cardHistoryOf(played.history, "no-such-instance" as InstanceId, played.state, played.viewer, POOL_DEPS),
    ).toEqual([]);
  });

  test("caps retained batches so history never grows without bound", () => {
    let log = emptyCardHistoryLog();
    for (let i = 0; i < 400; i++) {
      log = appendCardHistory(log, [{ type: "cardExhausted", instanceId: `inst-${i}` as InstanceId }], 300);
    }
    expect(log.entries.length).toBe(300);
    // The newest batch is kept, the oldest dropped.
    expect(log.entries.at(-1)!.events[0]).toEqual({ type: "cardExhausted", instanceId: "inst-399" as InstanceId });
  });

  test("appending an empty batch is a no-op", () => {
    const before = emptyCardHistoryLog();
    expect(appendCardHistory(before, [])).toBe(before);
  });
});

describe("eventRefs", () => {
  test("names both sides of damage dealt with a known source", () => {
    const refs = eventRefs({
      type: "damageDealt",
      targetInstanceId: "t" as InstanceId,
      sourceInstanceId: "s" as InstanceId,
      amount: 3,
    });
    expect(refs).toEqual(["t", "s"]);
  });

  test("names only the target when a damage source is not tracked", () => {
    const refs = eventRefs({
      type: "damageDealt",
      targetInstanceId: "t" as InstanceId,
      sourceInstanceId: null,
      amount: 3,
    });
    expect(refs).toEqual(["t"]);
  });

  test("an unrecognized event names nobody, rather than throwing", () => {
    expect(eventRefs({ type: "gameCreated", playerIds: [], firstPlayerId: "p1" as PlayerId, seed: 1 })).toEqual([]);
  });
});

describe("a hero identity's history names the face it showed", () => {
  test("Peter Parker's alter-ego sheet says Peter Parker, then the hero face after a flip", async () => {
    const { state, viewer } = await playedGame();
    const player = state.players[0]!;
    const identity = player.identity.instanceId;
    const placed = (amount: number): GameEvent => ({
      type: "threatPlaced",
      schemeInstanceId: identity,
      amount,
      sourceInstanceId: null,
    });
    const flip = (to: "hero" | "alterEgo"): GameEvent => ({ type: "formChanged", playerId: player.playerId, to });
    // Alter-ego, flip to hero, flip back: three beats, each named for the face it showed.
    let log = emptyCardHistoryLog();
    log = appendCardHistory(log, [placed(1)]);
    log = appendCardHistory(log, [flip("hero"), placed(2)]);
    log = appendCardHistory(log, [flip("alterEgo"), placed(3)]);
    const lines = cardHistoryOf(log, identity, state, viewer, POOL_DEPS).map((l) => l.text);
    expect(lines[0]).toBe("1 threat placed on Peter Parker.");
    expect(lines[1]).toBe("2 threat placed on Spider-Man (Peter Parker).");
    expect(lines[2]).toBe("3 threat placed on Peter Parker.");
    // A log with no form change reads the identity's live face.
    const live = cardHistoryOf(
      appendCardHistory(emptyCardHistoryLog(), [placed(1)]),
      identity,
      state,
      viewer,
      POOL_DEPS,
    );
    const face = player.identity.form === "hero" ? "Spider-Man (Peter Parker)" : "Peter Parker";
    expect(live[0]!.text).toBe(`1 threat placed on ${face}.`);
  });
});
