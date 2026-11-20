/**
 * One group of an Epic Multiplayer game in the engine session (issue #882), with the real God of Lies scenario: the
 * config's `epic` placement makes the engine a group of a pod with a coordinator outside it, and the session reports
 * what a pod link needs (`livePodGame`, `livePod`, `podInboundCommand`). The engine's own pod rules are tested there.
 */
import { describe, expect, test } from "vitest";
import { MemoryGameStorage } from "./game-storage.js";
import { EngineSessionCore } from "./session-core.js";
import type { SessionConfig } from "./host.js";

const config = (group: string): SessionConfig => ({
  scenarioId: "god-of-lies",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 7,
  watchable: true,
  room: "room00000001",
  epic: { groupId: group, groupIdsInPod: ["t1", "t2"], groupsInGame: 3, playersInGame: 4 },
});

describe("an Epic group in the engine session", () => {
  test("is a group of its pod with a remote coordinator, sized from the whole game", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const { snapshot } = await core.start(config("t2"));
    const pod = snapshot.state.pod;
    expect(pod).toMatchObject({
      groupId: "t2",
      coordinator: "remote",
      groupsInPodAtStart: 2,
      groupsInGameAtStart: 3,
      playersInGameAtStart: 4,
      groupIdsInPod: ["t1", "t2"],
    });
    // The shared record counts the whole game: Loki's hit points per player in the game.
    expect(pod?.shared?.villainHp).toBeGreaterThan(0);
  });

  test("tells the pod link where the group stands, and numbers what a command tells the pod", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const { snapshot } = await core.start(config("t1"));
    const game = core.livePodGame();
    expect(game).toMatchObject({ groupId: "t1", inboundSeq: 0, players: 1 });
    expect(game?.shared?.schemeTarget).toBeGreaterThan(0);
    // Outbound events come from a command's own events, numbered by the engine: none yet for no events.
    expect(core.livePod([])).toEqual({ outbound: [], inboundSeq: 0 });
    expect(snapshot.version).toBe(0);
  });

  test("applies the coordinator's inbound events as the group's own command, once each and in order", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    await core.start(config("t1"));
    const shared = core.livePodGame()!.shared!;
    const first = core.podInboundCommand(1, { kind: "sharedStateChanged", shared: { ...shared, villainDamage: 3 } });
    expect(first).toMatchObject({ type: "externalEvent", sequence: 1 });
    const applied = core.dispatch(first!);
    expect(applied.ok).toBe(true);
    expect(core.livePodGame()?.inboundSeq).toBe(1);
    expect(core.livePod([])?.inboundSeq).toBe(1);
    // It is in the group's own log, so the group replays alone.
    expect(core.liveGame()!.game.commands.at(-1)).toMatchObject({ type: "externalEvent", sequence: 1 });
    // A re-sent number is refused by the engine and changes nothing.
    const again = core.dispatch(core.podInboundCommand(1, { kind: "sharedAck", seq: 1 })!);
    expect(again.ok).toBe(false);
    expect(core.liveGame()!.game.commands).toHaveLength(1);
  });

  test("a game with no epic placement has no pod link", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    await core.start({ ...config("t1"), epic: undefined as never });
    expect(core.livePodGame()).toBeNull();
    expect(core.livePod([])).toBeNull();
    expect(core.podInboundCommand(1, { kind: "gameWon" })).toBeNull();
  });

  test("the live header keeps the placement, so a watcher rebuilds the same group", async () => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    await core.start(config("t1"));
    expect(core.liveGame()?.game.config.epic).toEqual(config("t1").epic);
  });
});
