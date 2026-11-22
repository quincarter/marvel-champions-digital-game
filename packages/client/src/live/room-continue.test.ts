import { describe, expect, test } from "vitest";
import type { Command, LegalActions } from "@mc/engine";
import type { ServerMessage } from "@mc/sync-worker/room-protocol";
import { FIRST_TABLE } from "@mc/sync-worker/room-protocol";
import { MemoryGameStorage, isAdjustedSave } from "../engine/game-storage.js";
import { isRoomGuestSave, isRoomSave, mySeatsOf } from "../engine/room-play.js";
import type { SessionConfig } from "../engine/host.js";
import { EngineSessionCore } from "../engine/session-core.js";
import type { PackRuntime } from "../packs/pack-runtime.js";
import { headerOf } from "./live-publisher.js";
import { offersContinue, roomGameSave, saveRoomGame, type RoomGameSaveDeps } from "./room-continue.js";
import { GameMirror } from "./room-game-mirror.js";

const ROOM = "room00000001";
/** A two-seat room's game as the host starts it: the room's own settings ride on the config, never into the header. */
const CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }, { starterDeckId: "core-captain-marvel-leadership" }],
  seed: 2026,
  watchable: true,
  room: ROOM,
  roomPlayMode: "strict",
  roomUndo: "off",
  roomHandsHidden: true,
};

function anyLegalCommand(legal: LegalActions): Command {
  if (legal.kind === "choice") {
    const option = legal.choice.options[0]!;
    return {
      type: "resolveChoice",
      playerId: legal.choice.playerId,
      choiceId: legal.choice.choiceId,
      selectedOptionIds: [option.optionId],
    };
  }
  if (legal.kind !== "turn") throw new Error("nothing legal");
  return (legal.legal.find((a) => a.action.kind === "endTurn") ?? legal.legal[0]!).example;
}

let ids = 0;
const deps = (packs: readonly PackRuntime[] = []): RoomGameSaveDeps => ({
  packs,
  now: () => 5_000,
  newId: () => `continued-${++ids}`,
});

/** The host plays `moves` commands; the guest's mirror receives the room's log for them, as the room sends it. */
async function hostedGame(moves: number, config: SessionConfig = CONFIG) {
  const host = new EngineSessionCore({ storage: new MemoryGameStorage() });
  const started = await host.start(config);
  let legal = started.snapshot.legal!;
  for (let i = 0; i < moves; i++) {
    const result = host.dispatch(anyLegalCommand(host.legalActions(legal.playerId)));
    if (!result.ok) throw new Error("the host's move was refused");
    legal = result.snapshot.legal ?? legal;
  }
  const { game } = host.liveGame()!;
  const mirror = new GameMirror();
  mirror.apply({
    v: 1,
    ch: "game",
    kind: "log",
    table: FIRST_TABLE,
    header: headerOf(game),
    commands: [...game.commands],
    checksums: { ...game.checksums },
  } as ServerMessage);
  return { host, mirror };
}

describe("a guest's log as a local saved game", () => {
  test("replays to the same state as the host's, with every seat a local seat and no room left on it", async () => {
    const { host, mirror } = await hostedGame(6);
    const salvage = mirror.salvage()!;
    expect(salvage.commands).toHaveLength(6);

    const storage = new MemoryGameStorage();
    const id = await saveRoomGame(salvage, ROOM, storage, deps());
    expect(id).not.toBeNull();
    const stored = (await storage.load(id!))!;
    expect(stored.commands).toHaveLength(6);
    expect(stored.meta).toMatchObject({ status: "active", commandCount: 6, continuedFromRoom: ROOM, outcome: null });
    for (const key of ["room", "roomPlayMode", "roomUndo", "roomHandsHidden", "roomCheats", "watchable", "packs"])
      expect(stored.meta.config).not.toHaveProperty(key);
    expect(stored.meta.config.players).toHaveLength(2);

    // Single player's own Continue path: the engine host resumes the saved game and replays it.
    const guest = new EngineSessionCore({ storage });
    const resumed = await guest.resume(id!);
    expect(guest.liveChecksum()).toBe(host.liveChecksum());
    expect(guest.save().commands).toEqual(host.save().commands);

    // ... and goes on being played: the next move lands on both, the same way.
    const move = anyLegalCommand(guest.legalActions(resumed.snapshot.legal!.playerId));
    expect(guest.dispatch(move).ok).toBe(true);
    expect(host.dispatch(move).ok).toBe(true);
    expect(guest.liveChecksum()).toBe(host.liveChecksum());
  });

  test("a continued game is no room's: it never streams to a room and is the device's own, counted once", async () => {
    const { mirror } = await hostedGame(2);
    const storage = new MemoryGameStorage();
    const id = (await saveRoomGame(mirror.salvage()!, ROOM, storage, deps()))!;
    const guest = new EngineSessionCore({ storage });
    await guest.resume(id);
    // Nothing of the room reaches the live stream, so the game cannot attach to (or reopen) the lobby room.
    expect(guest.liveGame()).toBeNull();
    const meta = (await storage.list())[0]!;
    expect(isAdjustedSave(meta)).toBe(false);
    expect(await storage.list()).toHaveLength(1);
    // The room-play readers (#909) see a plain solo game: not a room row, not a guest copy, every seat this device's.
    expect(isRoomSave(meta)).toBe(false);
    expect(isRoomGuestSave(meta)).toBe(false);
    expect(mySeatsOf(meta)).toEqual(["p1", "p2"]);
  });

  test("a room played with Cheats on stays adjusted, so the continued game counts for nothing", async () => {
    const { mirror } = await hostedGame(1, { ...CONFIG, roomCheats: true });
    const save = roomGameSave(mirror.salvage()!, ROOM, deps());
    expect(save.ok && save.meta.adjusted).toBe(true);
    expect(save.ok && save.meta.config).not.toHaveProperty("roomCheats");
  });

  test("a host Undo past a reveal (a rewind) keeps the continued game adjusted even though the log shows nothing (#904 review)", async () => {
    const { mirror } = await hostedGame(4);
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 3, adjusted: true } as ServerMessage);
    const salvage = mirror.salvage()!;
    expect(salvage.commands).toHaveLength(3);
    const storage = new MemoryGameStorage();
    const id = (await saveRoomGame(salvage, ROOM, storage, deps()))!;
    // Offline, as the guest's device would open it: the replay is unchanged, the row stays adjusted, and the readers skip it.
    const guest = new EngineSessionCore({ storage });
    await guest.resume(id);
    const meta = (await storage.list())[0]!;
    expect(meta.adjusted).toBe(true);
    expect(isAdjustedSave(meta)).toBe(true);
  });

  test("a guest that missed the flagged rewind in a reconnect gap latches adjusted from the room's log frame", async () => {
    const { mirror } = await hostedGame(4);
    const before = mirror.salvage()!;
    // The link drops; the host's flagged rewind goes out while the guest is away. The reconnect brings the room's log.
    mirror.clear(true);
    mirror.apply({
      v: 1,
      ch: "game",
      kind: "log",
      table: FIRST_TABLE,
      header: before.header,
      commands: before.commands.slice(0, 3),
      checksums: {},
      adjusted: true,
    } as ServerMessage);
    const salvage = mirror.salvage()!;
    expect(salvage.adjusted).toBe(true);
    const save = roomGameSave(salvage, ROOM, deps());
    expect(save.ok && save.meta.adjusted).toBe(true);
    // Without the flag on the log (a game played by the rules), nothing is latched.
    const plain = (await hostedGame(4)).mirror;
    expect(plain.salvage()!.adjusted).toBeUndefined();
  });

  test("an ordinary cutting rewind, without the flag, does not mark the game adjusted", async () => {
    const { mirror } = await hostedGame(4);
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 2 } as ServerMessage);
    expect(mirror.salvage()!.commands).toHaveLength(2);
    expect(mirror.salvage()!.adjusted).toBeUndefined();
  });

  test("a rewind to the current count carrying the flag still latches, and an adjusted end does too", async () => {
    const first = (await hostedGame(3)).mirror;
    first.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 3, adjusted: true } as ServerMessage);
    expect(first.salvage()!.adjusted).toBe(true);
    const second = (await hostedGame(3)).mirror;
    second.apply({ v: 1, ch: "game", kind: "end", table: FIRST_TABLE, outcome: null, adjusted: true } as ServerMessage);
    // The game is over, so there is nothing to continue from; reopening it keeps the latch.
    second.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 3 } as ServerMessage);
    expect(second.salvage()!.adjusted).toBe(true);
  });

  test("a reconnect that brings the same game's log again keeps the latch; a rewind to the same count cuts nothing", async () => {
    const { mirror } = await hostedGame(4);
    const before = mirror.salvage()!;
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 4 } as ServerMessage);
    expect(mirror.salvage()!.adjusted).toBeUndefined();
    mirror.apply({ v: 1, ch: "game", kind: "rewind", table: FIRST_TABLE, to: 2, adjusted: true } as ServerMessage);
    mirror.clear(true);
    mirror.apply({
      v: 1,
      ch: "game",
      kind: "log",
      table: FIRST_TABLE,
      header: before.header,
      commands: before.commands.slice(0, 2),
      checksums: {},
    } as ServerMessage);
    expect(mirror.salvage()!.adjusted).toBe(true);
    // A different game's header starts clean.
    mirror.apply({
      v: 1,
      ch: "game",
      kind: "log",
      table: FIRST_TABLE,
      header: { ...(before.header as object), createdAt: 1 },
      commands: [],
      checksums: {},
    } as ServerMessage);
    expect(mirror.salvage()!.adjusted).toBeUndefined();
  });

  test("a game with a Manual adjust in its log is adjusted too", async () => {
    const { mirror } = await hostedGame(1);
    const salvage = mirror.salvage()!;
    const adjusted = { ...salvage, commands: [...salvage.commands, { type: "adjust", playerId: "p1" }] };
    const save = roomGameSave(adjusted, ROOM, deps());
    expect(save.ok && save.meta.adjusted).toBe(true);
  });

  test("a header that is not a header, a seatless setup or a log of non-commands is unreadable", async () => {
    const { mirror } = await hostedGame(1);
    const good = mirror.salvage()!;
    expect(roomGameSave({ header: { h: 1 }, commands: [] }, ROOM, deps())).toEqual({ ok: false, reason: "unreadable" });
    expect(roomGameSave({ ...good, commands: [1, "x"] }, ROOM, deps())).toEqual({ ok: false, reason: "unreadable" });
    const noSeats = { ...(good.header as object), config: { ...CONFIG, players: [] } };
    expect(roomGameSave({ ...good, header: noSeats }, ROOM, deps())).toEqual({ ok: false, reason: "unreadable" });
    expect(await saveRoomGame({ header: 1, commands: [] }, ROOM, new MemoryGameStorage(), deps())).toBeNull();
  });

  test("a game that used a pack needs that pack installed, by id and version", async () => {
    const { mirror } = await hostedGame(1);
    const good = mirror.salvage()!;
    const withPack = { ...(good.header as object), packs: [{ id: "fan-x", version: "1.0.0" }] };
    const salvage = { ...good, header: withPack };
    expect(roomGameSave(salvage, ROOM, deps())).toEqual({ ok: false, reason: "missingPacks" });
    const installed = { id: "fan-x", version: "1.0.0" } as PackRuntime;
    const save = roomGameSave(salvage, ROOM, deps([installed]));
    expect(save.ok && save.meta.config.packs).toEqual([installed]);
  });

  test("a storage that fails keeps nothing and says so", async () => {
    const { mirror } = await hostedGame(1);
    const broken = {
      importGame: async () => {
        throw new Error("disk full");
      },
    };
    expect(await saveRoomGame(mirror.salvage()!, ROOM, broken, deps())).toBeNull();
  });
});

describe("when the notice offers Continue in single player", () => {
  const salvage = { header: {}, commands: [] };
  const base = { problem: "closed-host", role: "guest", started: true, seated: true, salvage } as const;

  test("a seated guest whose room was closed under a running game, with the whole log held", () => {
    expect(offersContinue(base)).toBe(true);
    expect(offersContinue({ ...base, problem: "closed-idle" })).toBe(true);
    expect(offersContinue({ ...base, problem: "closed-disabled" })).toBe(true);
  });

  test("not for a finished game, a room that was never closed, an unseated watcher, a host or a game never started", () => {
    expect(offersContinue({ ...base, salvage: null })).toBe(false);
    expect(offersContinue({ ...base, problem: "closed-ended" })).toBe(false);
    for (const problem of ["replaced", "gone", "not-found", "full", "unavailable"] as const)
      expect(offersContinue({ ...base, problem })).toBe(false);
    expect(offersContinue({ ...base, seated: false })).toBe(false);
    expect(offersContinue({ ...base, role: "host" })).toBe(false);
    expect(offersContinue({ ...base, started: false })).toBe(false);
  });
});

describe("what a guest holds of the room", () => {
  test("the header the guest salvages is the one the host streamed, without the room's own settings", async () => {
    const { mirror } = await hostedGame(0);
    const text = JSON.stringify(mirror.salvage()!.header);
    expect(text).not.toContain(ROOM);
    expect(text).not.toContain("roomPlayMode");
  });
});
