import { describe, expect, test } from "vitest";
import type { FrameId, GameEvent, GameState, InstanceId, PlayerId, StackFrameKind } from "@mc/engine";
import { LocalEngineHost } from "./local-host.js";
import { emptyRecord, recordEvents, type GameRecord } from "./game-record.js";
import { PARKED_LIMIT, actingPlayer, initActor, settleActor, stepActor, type ActorState } from "./record-actor.js";

const P1 = "p1" as PlayerId;
const P2 = "p2" as PlayerId;

const pushed = (id: string, frame: StackFrameKind = "effects"): GameEvent => ({
  type: "framePushed",
  frameId: id as FrameId,
  frame,
  description: id,
});
const popped = (id: string, frame: StackFrameKind = "effects"): GameEvent => ({
  type: "framePopped",
  frameId: id as FrameId,
  frame,
});
const resolved = (controllerId: PlayerId | null): GameEvent => ({
  type: "abilityResolved",
  instanceId: "card" as InstanceId,
  abilityId: "ability" as Extract<GameEvent, { type: "abilityResolved" }>["abilityId"],
  controllerId,
});
const played = (playerId: PlayerId): GameEvent =>
  ({
    type: "cardPlayed",
    playerId,
    instanceId: "card" as InstanceId,
    cardId: "01001",
    resourcesPaid: 0,
    paid: { physical: 0, mental: 0, energy: 0, wild: 0 },
  }) as GameEvent;
const other: GameEvent = { type: "roundStarted", round: 2 } as GameEvent;

/** Folds the events, answering the acting player after each one. */
function actors(
  events: readonly GameEvent[],
  from: ActorState = initActor(),
): { trail: (PlayerId | null)[]; state: ActorState } {
  let state = from;
  const trail: (PlayerId | null)[] = [];
  for (const event of events) {
    state = stepActor(state, event);
    trail.push(actingPlayer(state));
  }
  return { trail, state };
}

const stackOf = (...ids: string[]): GameState["stack"] =>
  ids.map((id) => ({ frameId: id as FrameId, kind: "effects" })) as unknown as GameState["stack"];

describe("record actor", () => {
  test("an ability's frame names its controller, and the frames it pushes act for them until it closes", () => {
    const { trail, state } = actors([
      pushed("a", "ability"),
      resolved(P1),
      other,
      pushed("e"),
      other,
      popped("e"),
      popped("a", "ability"),
    ]);
    expect(trail).toEqual([null, P1, P1, P1, P1, P1, null]);
    expect(state.open).toEqual([]);
  });

  test("an encounter card's ability inside a player's frame acts for nobody, and the player again once it closes", () => {
    const { trail } = actors([
      pushed("a", "ability"),
      resolved(P1),
      pushed("v", "ability"),
      other,
      resolved(null),
      popped("v", "ability"),
    ]);
    expect(trail).toEqual([null, P1, P1, P1, null, P1]);
  });

  test("a played card acts for its player from the play, then through its play frame", () => {
    const { trail } = actors([played(P2), other, pushed("play", "playCard"), other, popped("play", "playCard")]);
    expect(trail).toEqual([P2, P2, P2, P2, null]);
  });

  test("frames pushed together are stacked top first: the first one's ability names its own frame", () => {
    // `pushFrames([x, y])` puts x on top and logs x then y.
    const { state, trail } = actors([
      pushed("x", "ability"),
      pushed("y", "ability"),
      resolved(P2),
      popped("x", "ability"),
    ]);
    expect(trail).toEqual([null, null, P2, null]);
    expect(state.open.map((entry) => entry.frameId)).toEqual(["y"]);
  });

  test("a frame popped to wait and pushed again under its id keeps its actor", () => {
    const { trail } = actors([
      pushed("a", "ability"),
      resolved(P1),
      popped("a", "ability"),
      other,
      pushed("a", "ability"),
    ]);
    expect(trail).toEqual([null, P1, null, null, P1]);
  });

  test("settling orders the frames as the real stack does, and parks a known frame that left it", () => {
    const { state } = actors([pushed("a", "ability"), resolved(P1), other, pushed("b"), other, pushed("c", "ability")]);
    const settled = settleActor(state, stackOf("b", "c"));
    // The state's stack is top first: b is on top, c beneath it; a is gone.
    expect(settled.open.map((entry) => entry.frameId)).toEqual(["c", "b"]);
    expect(settled.parked).toEqual([{ frameId: "a", actor: P1 }]);
    expect(actingPlayer(settled)).toBeNull();
    expect(actingPlayer(stepActor(settled, pushed("a", "ability")))).toBe(P1);
  });

  test("settling ends a play waiting for its frame and keeps only the newest parked frames", () => {
    let state = stepActor(initActor(), played(P1));
    expect(actingPlayer(settleActor(state, []))).toBeNull();
    state = initActor();
    for (let index = 0; index <= PARKED_LIMIT; index++) {
      state = actors([pushed(`f${index}`, "ability"), resolved(P1), popped(`f${index}`, "ability")], state).state;
    }
    expect(state.parked).toHaveLength(PARKED_LIMIT);
    expect(state.parked![0]!.frameId).toBe("f1");
  });

  test("the tracker is plain data", () => {
    const { state } = actors([pushed("a", "ability"), resolved(P1), pushed("b")]);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  test("in a real game the record's tracker holds exactly the stack's frames after every command", async () => {
    const host = new LocalEngineHost();
    let record: GameRecord = emptyRecord();
    let state: GameState | null = null;
    const mismatches: string[] = [];
    host.subscribe((update) => {
      record = recordEvents(record, update.events, update.state);
      state = update.state;
      const tracked = (record.actor?.open ?? []).map((entry) => entry.frameId);
      const stack = [...update.state.stack].reverse().map((frame) => frame.frameId);
      if (tracked.join() !== stack.join()) mismatches.push(`${tracked.join()} vs ${stack.join()}`);
    });
    await host.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-spider-man-justice" }],
      seed: 43523,
    });
    for (let step = 0; step < 200 && !state!.outcome; step++) {
      const choice = state!.pendingChoice;
      if (choice) {
        await host.dispatch({
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: choice.options.slice(0, choice.minSelections).map((option) => option.optionId),
        });
        continue;
      }
      const legal = await host.legalActions(state!.players[0]!.playerId);
      if (legal.kind !== "turn") break;
      const end = legal.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) break;
      await host.dispatch(end.example);
    }
    expect(mismatches).toEqual([]);
    expect(record.actor).toBeDefined();
  }, 120_000);
});
